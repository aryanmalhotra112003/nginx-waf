import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const API_URL = `${API_BASE_URL}/api/alerts`;
const WAF_MODE_URL = `${API_BASE_URL}/api/waf/mode`;
const EDGE_BLOCKING_SAVINGS_PER_ATTACK = 0.005;
const AWS_FIXED_COST = 5.0;
const AWS_PER_MILLION_REQUESTS = 1.0;
const AZURE_BASE_MONTHLY_COST = 130.0;

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
  const estimatedAwsCost = useMemo(
    () => AWS_FIXED_COST + (count / 1_000_000) * AWS_PER_MILLION_REQUESTS,
    [count]
  );
  const systemHealthLabel = apiHealthy ? "Healthy" : "Degraded";

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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
            AI-Assisted WAF - Phase 4
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">
            Observability Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Live telemetry feed from Coraza + AI summaries, refreshed every 3 seconds.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="text-sm">
              <span className="text-slate-400">WAF Mode:</span>{" "}
              <span className={wafMode === "On" ? "text-emerald-300" : "text-amber-300"}>{wafMode}</span>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm disabled:opacity-50"
                disabled={modeLoading || wafMode === "DetectionOnly"}
                onClick={() => {
                  void updateWafMode("DetectionOnly");
                }}
              >
                Detection Only
              </button>
              <button
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm disabled:opacity-50"
                disabled={modeLoading || wafMode === "On"}
                onClick={() => {
                  void updateWafMode("On");
                }}
              >
                Active Blocking
              </button>
            </div>
            {modeError ? <span className="text-xs text-rose-300">{modeError}</span> : null}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950">
            <p className="text-sm text-slate-400">Total Attacks Blocked</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">{count.toLocaleString()}</p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950">
            <p className="text-sm text-slate-400">System Health</p>
            <p className={`mt-2 text-3xl font-bold ${apiHealthy ? "text-emerald-400" : "text-rose-400"}`}>
              {systemHealthLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Last API success: {lastSuccessAt ? lastSuccessAt.toLocaleTimeString() : "n/a"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950">
            <p className="text-sm text-slate-400">Compute Waste Prevented</p>
            <p className="mt-2 text-3xl font-bold text-cyan-400">
              {formatCurrency(computeWastePrevented)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Based on {formatCurrency(EDGE_BLOCKING_SAVINGS_PER_ATTACK)} saved per blocked request.
            </p>
          </article>

          <article className="rounded-2xl border border-indigo-700/40 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-5 shadow-lg shadow-slate-950">
            <p className="text-sm text-slate-300">Competitor Cost Comparison</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-emerald-900/30 px-3 py-2">
                <span>Your Cost</span>
                <span className="font-semibold text-emerald-300">$0.00</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2">
                <span>AWS WAF (est.)</span>
                <span className="font-semibold text-amber-300">{formatCurrency(estimatedAwsCost)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2">
                <span>Azure WAF (base)</span>
                <span className="font-semibold text-rose-300">{formatCurrency(AZURE_BASE_MONTHLY_COST)}</span>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-100">Threat Feed</h2>
            <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">
              {loading ? "Loading..." : `${alerts.length} alerts shown`}
            </span>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-700/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              Failed to poll API: {error}
            </div>
          ) : null}

          {!loading && alerts.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-8 text-center text-slate-400">
              No alerts yet. Generate traffic through the WAF to populate this feed.
            </div>
          ) : null}

          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <article
                key={`${alert.timestamp ?? "missing"}-${alert.client_ip ?? "unknown"}-${index}`}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{formatTimestamp(alert.timestamp)}</span>
                  <span className="text-slate-600">|</span>
                  <span>Attacker IP: {alert.client_ip || "Unknown IP"}</span>
                </div>

                <p className="mt-2 text-base font-medium leading-relaxed text-slate-100">
                  {alert.ai_summary || "No AI summary available"}
                </p>

                <details className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium text-cyan-300">
                    View Raw Logs
                  </summary>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>
                      <span className="text-slate-400">URI:</span> {alert.uri || "N/A"}
                    </p>
                    <div>
                      <p className="mb-1 text-slate-400">Messages:</p>
                      <ul className="list-disc space-y-1 pl-5 text-slate-300">
                        {(Array.isArray(alert.messages) ? alert.messages : []).map((message, messageIndex) => (
                          <li key={`${message}-${messageIndex}`}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
