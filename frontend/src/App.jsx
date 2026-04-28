import { useEffect, useMemo, useState } from "react";
import ComingSoon from "./ComingSoon";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const API_URL = `${API_BASE_URL}/api/alerts`;
const WAF_MODE_URL = `${API_BASE_URL}/api/waf/mode`;
const EDGE_BLOCKING_SAVINGS_PER_ATTACK = 0.005;
const AWS_BASE_MONTHLY_COST = 25.0;
const AZURE_BASE_MONTHLY_COST = 323.0;
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "findings", label: "Findings" },
  { id: "integrations", label: "Integrations" }
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown time";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleString();
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function scoreToLevel(score) {
  if (score >= 75) {
    return "Critical";
  }
  if (score >= 50) {
    return "Elevated";
  }
  if (score >= 25) {
    return "Medium";
  }
  return "Low";
}

function getAlertSeverity(alert) {
  if (alert?.is_critical) {
    return "Critical";
  }

  const uri = (alert?.uri || "").toLowerCase();
  const messageBlob = (Array.isArray(alert?.messages) ? alert.messages : []).join(" ").toLowerCase();
  const combined = `${uri} ${messageBlob}`;

  const mediumSignals = [
    "anomaly",
    "../",
    "%2f",
    "union",
    "select",
    "script"
  ];
  const lowSignals = ["suspicious", "probe", "scan", "test", "debug", "token", "telemetry"];
  const hasMessages = Array.isArray(alert?.messages) && alert.messages.length > 0;

  if (hasMessages || mediumSignals.some((signal) => combined.includes(signal))) {
    return "Medium";
  }

  if (lowSignals.some((signal) => combined.includes(signal))) {
    return "Low";
  }

  return "Non-critical";
}

function getSeverityClass(severity) {
  if (severity === "Critical") {
    return "bg-rose-500/20 text-rose-300";
  }
  if (severity === "Medium") {
    return "bg-amber-500/20 text-amber-300";
  }
  if (severity === "Low") {
    return "bg-emerald-500/20 text-emerald-300";
  }
  return "bg-slate-700 text-slate-200";
}

function App() {
  const [alerts, setAlerts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [apiHealthy, setApiHealthy] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const [wafMode, setWafMode] = useState("On");
  const [modeLoading, setModeLoading] = useState(false);
  const [modeError, setModeError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const theme = "dark";

  useEffect(() => {
    let active = true;

    const fetchAlerts = async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }
        const data = await response.json();
        if (!active) {
          return;
        }
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        setCount(Number.isFinite(data.count) ? data.count : 0);
        setError("");
        setApiHealthy(true);
        setLastSuccessAt(new Date());
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError(fetchError.message || "Failed to fetch alerts");
        setApiHealthy(false);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const fetchWafMode = async () => {
      try {
        const response = await fetch(WAF_MODE_URL);
        if (!response.ok) {
          throw new Error(`Mode endpoint returned ${response.status}`);
        }
        const data = await response.json();
        if (!active) {
          return;
        }
        if (data?.mode === "On" || data?.mode === "DetectionOnly") {
          setWafMode(data.mode);
          setModeError("");
        }
      } catch {
        if (active) {
          setModeError("WAF mode endpoint unavailable");
        }
      }
    };

    void fetchAlerts();
    void fetchWafMode();
    const intervalId = setInterval(() => {
      void fetchAlerts();
    }, 3000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  const computeWastePrevented = useMemo(
    () => count * EDGE_BLOCKING_SAVINGS_PER_ATTACK,
    [count]
  );
  const systemHealthLabel = apiHealthy ? "Healthy" : "Degraded";
  const filteredAlerts = useMemo(() => {
    const loweredSearch = searchText.trim().toLowerCase();
    return alerts.filter((alert) => {
      const criticalMatch = !criticalOnly || Boolean(alert.is_critical);
      if (!loweredSearch) {
        return criticalMatch;
      }
      const haystack = [
        alert.client_ip,
        alert.uri,
        alert.ai_summary,
        ...(Array.isArray(alert.messages) ? alert.messages : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return criticalMatch && haystack.includes(loweredSearch);
    });
  }, [alerts, criticalOnly, searchText]);
  const attackSurface = useMemo(() => {
    let anomalyScore = 12;
    let injectionScore = 12;
    let exposureScore = 8;

    for (const alert of alerts.slice(0, 80)) {
      const messageBlob = (Array.isArray(alert.messages) ? alert.messages : []).join(" ").toLowerCase();
      const summary = (alert.ai_summary || "").toLowerCase();
      const uri = (alert.uri || "").toLowerCase();
      const combined = `${messageBlob} ${summary} ${uri}`;
      const baseWeight = alert.is_critical ? 10 : 4;

      if (combined.includes("anomaly score") || combined.includes("protocol") || combined.includes("malformed")) {
        anomalyScore += baseWeight + 4;
      }
      if (
        combined.includes("sql injection") ||
        combined.includes("libinjection") ||
        combined.includes("xss") ||
        combined.includes("command injection") ||
        combined.includes("remote command")
      ) {
        injectionScore += baseWeight + 6;
      }
      if (
        combined.includes("file inclusion") ||
        combined.includes("../") ||
        combined.includes("/admin") ||
        combined.includes("/.env") ||
        combined.includes("sensitive")
      ) {
        exposureScore += baseWeight + 5;
      }
    }

    return {
      anomaly: clampScore(anomalyScore),
      injection: clampScore(injectionScore),
      exposure: clampScore(exposureScore)
    };
  }, [alerts]);
  const radarPoints = useMemo(() => {
    const center = 80;
    const radius = 58;
    const values = [
      attackSurface.anomaly / 100,
      attackSurface.injection / 100,
      attackSurface.exposure / 100
    ];
    const angles = [-90, 30, 150];

    return values
      .map((value, index) => {
        const radians = (angles[index] * Math.PI) / 180;
        const x = center + Math.cos(radians) * radius * value;
        const y = center + Math.sin(radians) * radius * value;
        return `${x},${y}`;
      })
      .join(" ");
  }, [attackSurface]);
  const threatCountLabel = loading ? "Loading..." : `${filteredAlerts.length} / ${alerts.length} alerts`;
  const rootThemeClass = "min-h-screen bg-[#0F172A] text-slate-100";
  const panelClass = "border-slate-700/80 bg-slate-900/55 shadow-black/35 backdrop-blur-xl";
  const subtleTextClass = "text-slate-300";
  const feedCardClass = "border-slate-700/80 bg-slate-900/70 backdrop-blur-md";
  const detailsClass = "border-slate-700/80 bg-slate-900/45";
  const headerBadgeClass = "border-sky-400/25 bg-sky-400/10 text-sky-200";
  const appBgClass =
    "bg-[radial-gradient(900px_360px_at_75%_-10%,rgba(56,189,248,0.10),transparent),radial-gradient(720px_300px_at_20%_0%,rgba(99,102,241,0.12),transparent),radial-gradient(680px_260px_at_30%_120%,rgba(20,184,166,0.08),transparent)]";
  const shellClass = "border-slate-700/80 bg-slate-900/45 backdrop-blur-2xl";
  const sidebarClass = "border-slate-700/80 bg-slate-900/70 backdrop-blur-xl";
  const brandTextClass = "text-cyan-400";
  const modeTextClass = wafMode === "On" ? "text-emerald-300" : "text-amber-300";

  const updateWafMode = async (nextMode) => {
    try {
      setModeLoading(true);
      setModeError("");
      const response = await fetch(WAF_MODE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mode: nextMode })
      });
      if (!response.ok) {
        throw new Error(`Failed to set mode: ${response.status}`);
      }
      const data = await response.json();
      if (data?.mode === "On" || data?.mode === "DetectionOnly") {
        setWafMode(data.mode);
      }
    } catch (requestError) {
      setModeError(requestError.message || "Failed to update WAF mode");
    } finally {
      setModeLoading(false);
    }
  };

  return (
    <main className={`${rootThemeClass} ${appBgClass}`}>
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <section className={`grid min-h-[82vh] gap-5 rounded-3xl border p-4 shadow-2xl lg:grid-cols-[240px_1fr] ${shellClass}`}>
          <aside className={`rounded-2xl border p-4 ${sidebarClass}`}>
            <div className="mb-4 border-b border-inherit pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">vigiles | Cloudkeeper</p>
              <h2 className="mt-1 text-lg font-semibold">Security Command Center</h2>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveView(item.id === "dashboard" ? "dashboard" : "comingSoon");
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                    (activeView === "dashboard" && item.id === "dashboard") ||
                    (activeView === "comingSoon" && item.id !== "dashboard")
                      ? theme === "dark"
                        ? "bg-gradient-to-r from-cyan-500/15 to-violet-500/15 text-slate-100 ring-1 ring-cyan-500/20"
                        : "bg-slate-900 text-white shadow-sm"
                      : theme === "dark"
                        ? "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        : "text-slate-700 hover:bg-slate-200 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="mt-10 border-t border-inherit pt-4 text-xs">
              <p className={subtleTextClass}>Help & Docs</p>
            </div>
          </aside>

          <div>
            <header className={`mb-5 rounded-2xl border p-6 shadow-xl ${panelClass}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs uppercase tracking-[0.2em] ${brandTextClass}`}>vigiles | Cloudkeeper</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Observability Dashboard
          </h1>
          <p className={`mt-2 text-sm ${subtleTextClass}`}>
            Live telemetry feed from Coraza + AI summaries, refreshed every 3 seconds.
          </p>
          <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${detailsClass}`}>
            <div className="text-sm">
              <span className={subtleTextClass}>WAF Mode:</span>{" "}
              <span className={modeTextClass}>{wafMode}</span>
            </div>
            <div className="flex gap-2">
              <button
                className={`rounded-md border px-3 py-1 text-sm disabled:opacity-50 ${
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 text-slate-100"
                    : "border-slate-300 bg-white text-slate-900"
                }`}
                disabled={modeLoading || wafMode === "DetectionOnly"}
                onClick={() => {
                  void updateWafMode("DetectionOnly");
                }}
              >
                Detection Only
              </button>
              <button
                className={`rounded-md border px-3 py-1 text-sm disabled:opacity-50 ${
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 text-slate-100"
                    : "border-slate-300 bg-white text-slate-900"
                }`}
                disabled={modeLoading || wafMode === "On"}
                onClick={() => {
                  void updateWafMode("On");
                }}
              >
                Active Blocking
              </button>
            </div>
            {modeError ? (
              <span className={`text-xs ${theme === "dark" ? "text-rose-300" : "text-rose-700"}`}>{modeError}</span>
            ) : null}
          </div>
            </header>

            {activeView === "dashboard" ? (
              <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className={`rounded-2xl border p-5 shadow-lg ${panelClass}`}>
            <p className={`text-sm ${subtleTextClass}`}>Total Attacks Blocked</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">{count.toLocaleString()}</p>
                <div className={`mt-4 h-8 w-full rounded-md ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`} />
              </article>

              <article className={`rounded-2xl border p-5 shadow-lg ${panelClass}`}>
            <p className={`text-sm ${subtleTextClass}`}>System Health</p>
            <p className={`mt-2 text-3xl font-bold ${apiHealthy ? "text-emerald-400" : "text-rose-400"}`}>
              {systemHealthLabel}
            </p>
            <p className={`mt-1 text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-700"}`}>
              Last API success: {lastSuccessAt ? lastSuccessAt.toLocaleTimeString() : "n/a"}
            </p>
                <div className={`mt-4 h-8 w-full rounded-md ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`} />
              </article>

              <article className={`rounded-2xl border p-5 shadow-lg ${panelClass}`}>
            <p className={`text-sm ${subtleTextClass}`}>Backend Compute Waste Prevented</p>
            <p className="mt-2 text-3xl font-bold text-cyan-400">
              {formatCurrency(computeWastePrevented)}
            </p>
            <p className={`mt-1 text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-700"}`}>
              Estimated savings assuming $0.005 per request for API Gateway, Serverless Compute, and DB lookup waste.
            </p>
              </article>

              <article
                className={`rounded-2xl border p-5 shadow-lg ${
                  theme === "dark"
                    ? "border-indigo-700/40 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 shadow-slate-950"
                    : "border-indigo-200 bg-gradient-to-br from-white via-slate-50 to-indigo-100/60 shadow-slate-300/60"
                }`}
              >
                <p className={`text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-800"}`}>Competitor Cost Comparison</p>
                <p className={`mt-1 text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-700"}`}>
                  *Estimated standard monthly base cost (excluding traffic volume)
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <div
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      theme === "dark" ? "bg-emerald-900/30" : "bg-emerald-100"
                    }`}
                  >
                    <span>Your Cost</span>
                    <span className="font-semibold text-emerald-500">$0.00</span>
                  </div>
                  <div
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      theme === "dark" ? "bg-slate-800/80" : "bg-white"
                    }`}
                  >
                    <span>AWS WAF (base)</span>
                    <span className={theme === "dark" ? "font-semibold text-amber-300" : "font-semibold text-amber-600"}>
                      {formatCurrency(AWS_BASE_MONTHLY_COST)}
                    </span>
                  </div>
                  <div
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      theme === "dark" ? "bg-slate-800/80" : "bg-white"
                    }`}
                  >
                    <span>Azure WAF (base)</span>
                    <span className={theme === "dark" ? "font-semibold text-rose-300" : "font-semibold text-rose-600"}>
                      {formatCurrency(AZURE_BASE_MONTHLY_COST)}
                    </span>
                  </div>
                </div>
              </article>
            </section>

            <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_280px]">
              <div className={`rounded-2xl border p-5 shadow-xl ${panelClass}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Logs</h2>
            <span
              className={`rounded-md border px-2 py-1 text-xs ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-800 text-slate-300"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              {threatCountLabel}
            </span>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <input
              type="text"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
              }}
              placeholder="Search by IP, URI, summary, message..."
              className={`rounded-lg border px-3 py-2 text-sm ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-900/70 text-slate-200 placeholder:text-slate-500"
                  : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"
              }`}
            />
            <label
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-900/70 text-slate-200"
                  : "border-slate-300 bg-white text-slate-900"
              }`}
            >
              <input
                type="checkbox"
                checked={criticalOnly}
                onChange={(event) => {
                  setCriticalOnly(event.target.checked);
                }}
              />
              Show critical threats only
            </label>
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-900/70 text-slate-200"
                  : "border-slate-300 bg-white text-slate-900"
              }`}
              onClick={() => {
                setSearchText("");
                setCriticalOnly(false);
              }}
            >
              Reset Filters
            </button>
          </div>

          {error ? (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                theme === "dark"
                  ? "border-rose-700/50 bg-rose-950/40 text-rose-200"
                  : "border-rose-300 bg-rose-50 text-rose-700"
              }`}
            >
              Failed to poll API: {error}
            </div>
          ) : null}

          {!loading && filteredAlerts.length === 0 ? (
            <div
              className={`rounded-lg border px-4 py-8 text-center ${
                theme === "dark"
                  ? "border-slate-800 bg-slate-950/60 text-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              No alerts yet. Generate traffic through the WAF to populate this feed.
            </div>
          ) : null}

          <div className="space-y-3">
            {filteredAlerts.map((alert, index) => {
              const severity = getAlertSeverity(alert);
              const severityClass = getSeverityClass(severity);

              return (
                <article
                  key={`${alert.timestamp ?? "missing"}-${alert.client_ip ?? "unknown"}-${index}`}
                  className={`rounded-xl border p-4 ${feedCardClass}`}
                >
                  <div className={`flex flex-wrap items-center gap-2 text-xs ${subtleTextClass}`}>
                    <span>{formatTimestamp(alert.timestamp)}</span>
                    <span className="text-slate-600">|</span>
                    <span>Attacker IP: {alert.client_ip || "Unknown IP"}</span>
                    <span className={`ml-auto rounded px-2 py-0.5 text-[11px] font-medium ${severityClass}`}>{severity}</span>
                  </div>

                  <p className="mt-2 text-base font-medium leading-relaxed">
                    {alert.ai_summary || "No AI summary available"}
                  </p>

                  <details className={`mt-3 rounded-lg border px-3 py-2 ${detailsClass}`}>
                    <summary className="cursor-pointer text-sm font-medium text-cyan-300">
                      View Raw Logs
                    </summary>
                    <div className={`mt-3 space-y-2 text-sm text-slate-300`}>
                      <p>
                        <span className={subtleTextClass}>URI:</span> {alert.uri || "N/A"}
                      </p>
                      <div>
                        <p className={`mb-1 ${subtleTextClass}`}>Messages:</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {(Array.isArray(alert.messages) ? alert.messages : []).map((message, messageIndex) => (
                            <li key={`${message}-${messageIndex}`}>{message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
              </div>
              <aside className={`rounded-2xl border p-4 shadow-xl ${panelClass}`}>
                <h3 className="text-sm font-semibold">Attack Surface Analysis</h3>
                <p className={`mt-1 text-xs ${subtleTextClass}`}>Observed vs expected risk distribution</p>
                <div
                  className={`mt-3 grid h-56 place-items-center rounded-xl border ${
                    theme === "dark" ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-white"
                  }`}
                >
                  <svg viewBox="0 0 160 160" className="h-40 w-40">
                    <circle cx="80" cy="80" r="58" fill="none" stroke="rgba(245,158,11,0.35)" />
                    <circle cx="80" cy="80" r="40" fill="none" stroke="rgba(245,158,11,0.25)" />
                    <circle cx="80" cy="80" r="22" fill="none" stroke="rgba(245,158,11,0.15)" />
                    <line x1="80" y1="22" x2="80" y2="80" stroke="rgba(148,163,184,0.4)" />
                    <line x1="130" y1="109" x2="80" y2="80" stroke="rgba(148,163,184,0.4)" />
                    <line x1="30" y1="109" x2="80" y2="80" stroke="rgba(148,163,184,0.4)" />
                    <polygon points={radarPoints} fill="rgba(244,63,94,0.25)" stroke="rgba(251,146,60,0.9)" strokeWidth="1.5" />
                    <circle cx="80" cy="80" r="2" fill="rgba(251,146,60,0.9)" />
                  </svg>
                </div>
                <div className={`mt-3 space-y-1 text-xs ${subtleTextClass}`}>
                  <p>
                    Request Anomaly:{" "}
                    <span className="font-semibold">{scoreToLevel(attackSurface.anomaly)} ({attackSurface.anomaly}%)</span>
                  </p>
                  <p>
                    Injection Risk:{" "}
                    <span className="font-semibold">{scoreToLevel(attackSurface.injection)} ({attackSurface.injection}%)</span>
                  </p>
                  <p>
                    Asset Exposure:{" "}
                    <span className="font-semibold">{scoreToLevel(attackSurface.exposure)} ({attackSurface.exposure}%)</span>
                  </p>
                </div>
              </aside>
            </section>
              </>
            ) : (
              <ComingSoon />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
