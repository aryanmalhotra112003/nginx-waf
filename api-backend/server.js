require("dotenv").config();

const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { promisify } = require("util");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 3000);
const MAX_ALERTS = Number(process.env.MAX_ALERTS || 50);
const AUDIT_LOG_PATH =
  process.env.AUDIT_LOG_PATH || path.resolve(__dirname, "../logs/audit.log");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_GEMINI_MODEL = "gemini-2.0-flash";
const WAF_CONFIG_PATH = process.env.WAF_CONFIG_PATH || "/waf-config/coraza.conf";
const WAF_CONTAINER_NAME = process.env.WAF_CONTAINER_NAME || "waf";
const VALID_WAF_MODES = new Set(["On", "DetectionOnly"]);
const CRITICAL_THREAT_KEYWORDS = [
  "inbound anomaly score exceeded",
  "sql injection",
  "xss",
  "remote command execution",
  "command injection",
  "local file inclusion",
  "remote file inclusion",
  "protocol attack"
];

const alerts = [];
let filePosition = 0;
let genAI = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn("GEMINI_API_KEY is not set. Falling back to default summaries.");
}

function pushAlert(alert) {
  alerts.unshift(alert);
  if (alerts.length > MAX_ALERTS) {
    alerts.length = MAX_ALERTS;
  }
}

function extractMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== "object") {
    return null;
  }

  if (typeof rawMessage.msg === "string" && rawMessage.msg.trim()) {
    return rawMessage.msg.trim();
  }

  if (typeof rawMessage.error_message === "string" && rawMessage.error_message.trim()) {
    const match = rawMessage.error_message.match(/\[msg "([^"]+)"\]/);
    if (match && match[1]) {
      return match[1];
    }
    return rawMessage.error_message.trim();
  }

  return null;
}

function parseAuditLine(line) {
  if (!line || !line.trim()) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  const tx = parsed.transaction || {};
  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  const extractedMessages = messages.map(extractMessage).filter(Boolean);
  const loweredMessageBlob = extractedMessages.join(" ").toLowerCase();
  const isCriticalThreat = CRITICAL_THREAT_KEYWORDS.some((keyword) =>
    loweredMessageBlob.includes(keyword)
  );

  return {
    timestamp: tx.timestamp || null,
    client_ip: tx.client_ip || null,
    uri: tx.request?.uri || null,
    messages: extractedMessages,
    is_critical: isCriticalThreat,
    ai_summary: "Analyzing threat..."
  };
}

async function generateAISummary(uri, messages) {
  if (!genAI) {
    return "AI summary unavailable: GEMINI_API_KEY is not configured.";
  }

  const cleanUri = uri || "(missing uri)";
  const cleanMessages = Array.isArray(messages) && messages.length
    ? messages.join("; ")
    : "(no rule messages)";

  const prompt = [
    "You are a SecOps assistant.",
    "Given the suspicious request URI and triggered OWASP messages, explain in plain English what the attacker appears to be trying to do.",
    "Keep it to 1-2 short sentences, avoid dense jargon, and be concise.",
    `URI: ${cleanUri}`,
    `OWASP messages: ${cleanMessages}`
  ].join("\n");

  const model = genAI.getGenerativeModel({ model: PRIMARY_GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) {
    return "AI summary unavailable: empty response from model.";
  }

  return text;
}

function isRateLimitError(error) {
  const message = (error && error.message ? String(error.message) : "").toLowerCase();
  return message.includes("429") || message.includes("quota") || message.includes("rate limit");
}

async function enrichAlertWithAI(alert) {
  try {
    const summary = await generateAISummary(alert.uri, alert.messages);
    alert.ai_summary = summary;
  } catch (error) {
    console.error("Gemini enrichment error:", error);
    if (isRateLimitError(error)) {
      alert.ai_summary = "API Rate Limit Exceeded - Please wait a minute";
      return;
    }
    alert.ai_summary = "AI summary failed: temporary AI provider error";
  }
}

async function processAppendedChunk(start, end) {
  if (end <= start) {
    return;
  }

  const stream = fs.createReadStream(AUDIT_LOG_PATH, {
    encoding: "utf8",
    start,
    end: end - 1
  });

  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const alert = parseAuditLine(line);
    if (alert) {
      pushAlert(alert);
      if (alert.is_critical) {
        void enrichAlertWithAI(alert);
      } else {
        alert.ai_summary = "AI summary skipped: non-critical threat.";
      }
    }
  }
}

async function scanNewContent() {
  try {
    const stats = await fs.promises.stat(AUDIT_LOG_PATH);

    if (stats.size < filePosition) {
      // Log rotated/truncated; start from beginning.
      filePosition = 0;
    }

    if (stats.size > filePosition) {
      const previous = filePosition;
      filePosition = stats.size;
      await processAppendedChunk(previous, stats.size);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to scan audit log:", error.message);
    }
  }
}

async function startWatcher() {
  try {
    const stats = await fs.promises.stat(AUDIT_LOG_PATH);
    // Ignore historical backlog and only process new appended content after startup.
    filePosition = stats.size;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to initialize audit log watcher:", error.message);
    }
    filePosition = 0;
  }

  fs.watchFile(
    AUDIT_LOG_PATH,
    { interval: 1000 },
    async () => {
      await scanNewContent();
    }
  );

  console.log(`Watching Coraza audit log: ${AUDIT_LOG_PATH}`);
}

const app = express();
app.use(express.json());

async function getCurrentWafMode() {
  const conf = await fs.promises.readFile(WAF_CONFIG_PATH, "utf8");
  const match = conf.match(/^\s*SecRuleEngine\s+(\S+)\s*$/m);
  if (!match) {
    throw new Error("SecRuleEngine directive not found");
  }
  return match[1];
}

async function setWafMode(mode) {
  if (!VALID_WAF_MODES.has(mode)) {
    throw new Error("Invalid mode. Use 'On' or 'DetectionOnly'.");
  }

  let conf = await fs.promises.readFile(WAF_CONFIG_PATH, "utf8");
  if (/^\s*SecRuleEngine\s+\S+\s*$/m.test(conf)) {
    conf = conf.replace(/^\s*SecRuleEngine\s+\S+\s*$/m, `SecRuleEngine ${mode}`);
  } else {
    conf = `SecRuleEngine ${mode}\n${conf}`;
  }
  await fs.promises.writeFile(WAF_CONFIG_PATH, conf, "utf8");

  await execFileAsync("docker", ["kill", "-s", "HUP", WAF_CONTAINER_NAME]);
  return mode;
}

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.get("/api/alerts", (req, res) => {
  res.json({
    count: alerts.length,
    alerts
  });
});

app.get("/api/waf/mode", async (req, res) => {
  try {
    const mode = await getCurrentWafMode();
    res.json({ mode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/waf/mode", async (req, res) => {
  try {
    const requestedMode = req.body?.mode;
    const mode = await setWafMode(requestedMode);
    res.json({ ok: true, mode });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`API backend listening on port ${PORT}`);
  await startWatcher();
});
