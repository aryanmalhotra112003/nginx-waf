import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const API_URL = `${API_BASE_URL}/api/alerts`;
const WAF_MODE_URL = `${API_BASE_URL}/api/waf/mode`;
const EDGE_BLOCKING_SAVINGS_PER_ATTACK = 0.01;
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
  const [theme, setTheme] = useState("dark");
  const [searchText, setSearchText] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("dashboard-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dashboard-theme", theme);
  }, [theme]);

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
  const threatCountLabel = loading ? "Loading..." : `${filteredAlerts.length} / ${alerts.length} alerts`;
  const rootThemeClass =
    theme === "dark"
      ? "min-h-screen bg-slate-950 text-slate-100"
      : "min-h-screen bg-slate-100 text-slate-900";
  const panelClass =
    theme === "dark"
      ? "border-slate-800 bg-slate-900/70 shadow-slate-950"
      : "border-slate-200 bg-white/90 shadow-slate-300/60";
  const subtleTextClass = theme === "dark" ? "text-slate-400" : "text-slate-500";
  const feedCardClass =
    theme === "dark"
      ? "border-slate-800 bg-slate-950/60"
      : "border-slate-200 bg-white";
  const detailsClass =
    theme === "dark"
      ? "border-slate-800 bg-slate-900/50"
      : "border-slate-200 bg-slate-50";
  const headerBadgeClass =
    theme === "dark"
      ? "border-cyan-800/60 bg-cyan-900/30 text-cyan-300"
      : "border-cyan-200 bg-cyan-50 text-cyan-700";

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
    <main className={rootThemeClass}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className={`mb-8 rounded-2xl border p-6 shadow-xl ${panelClass}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
              AI-Assisted WAF
            </p>
            <button
              type="button"
              className={`rounded-md border px-3 py-1 text-xs font-medium ${headerBadgeClass}`}
              onClick={() => {
                setTheme((prev) => (prev === "dark" ? "light" : "dark"));
              }}
            >
              {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
            </button>
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
              <span className={wafMode === "On" ? "text-emerald-300" : "text-amber-300"}>{wafMode}</span>
            </div>
            <div className="flex gap-2">
              <button
                className={`rounded-md border px-3 py-1 text-sm disabled:opacity-50 ${
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800"
                    : "border-slate-300 bg-white"
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
                    ? "border-slate-700 bg-slate-800"
                    : "border-slate-300 bg-white"
                }`}
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
          <article className={`rounded-2xl border p-5 shadow-lg ${panelClass}`}>
            <p className={`text-sm ${subtleTextClass}`}>Total Attacks Blocked</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">{count.toLocaleString()}</p>
          </article>

          <article className={`rounded-2xl border p-5 shadow-lg ${panelClass}`}>
            <p className={`text-sm ${subtleTextClass}`}>System Health</p>
            <p className={`mt-2 text-3xl font-bold ${apiHealthy ? "text-emerald-400" : "text-rose-400"}`}>
              {systemHealthLabel}
            </p>
            <p className={`mt-1 text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>
              Last API success: {lastSuccessAt ? lastSuccessAt.toLocaleTimeString() : "n/a"}
            </p>
          </article>

          <article className={`rounded-2xl border p-5 shadow-lg ${panelClass}`}>
            <p className={`text-sm ${subtleTextClass}`}>Compute Waste Prevented</p>
            <p className="mt-2 text-3xl font-bold text-cyan-400">
              {formatCurrency(computeWastePrevented)}
            </p>
            <p className={`mt-1 text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>
              Based on {formatCurrency(EDGE_BLOCKING_SAVINGS_PER_ATTACK)} saved per blocked request.
            </p>
          </article>

          <article
            className={`rounded-2xl border p-5 shadow-lg ${
              theme === "dark"
                ? "border-indigo-700/40 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 shadow-slate-950"
                : "border-indigo-200 bg-gradient-to-br from-white via-slate-50 to-indigo-100/60 shadow-slate-300/60"
            }`}
          >
            <p className={`text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>Competitor Cost Comparison</p>
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
                <span>AWS WAF (est.)</span>
                <span className="font-semibold text-amber-300">{formatCurrency(estimatedAwsCost)}</span>
              </div>
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  theme === "dark" ? "bg-slate-800/80" : "bg-white"
                }`}
              >
                <span>Azure WAF (base)</span>
                <span className="font-semibold text-rose-300">{formatCurrency(AZURE_BASE_MONTHLY_COST)}</span>
              </div>
            </div>
          </article>
        </section>

        <section className={`mt-8 rounded-2xl border p-5 shadow-xl ${panelClass}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Threat Feed</h2>
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
                  : "border-slate-300 bg-white text-slate-800 placeholder:text-slate-400"
              }`}
            />
            <label
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                theme === "dark" ? "border-slate-700 bg-slate-900/70" : "border-slate-300 bg-white"
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
                  : "border-slate-300 bg-white text-slate-700"
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
            {filteredAlerts.map((alert, index) => (
              <article
                key={`${alert.timestamp ?? "missing"}-${alert.client_ip ?? "unknown"}-${index}`}
                className={`rounded-xl border p-4 ${feedCardClass}`}
              >
                <div className={`flex flex-wrap items-center gap-2 text-xs ${subtleTextClass}`}>
                  <span>{formatTimestamp(alert.timestamp)}</span>
                  <span className={theme === "dark" ? "text-slate-600" : "text-slate-400"}>|</span>
                  <span>Attacker IP: {alert.client_ip || "Unknown IP"}</span>
                  <span
                    className={`ml-auto rounded px-2 py-0.5 text-[11px] font-medium ${
                      alert.is_critical
                        ? "bg-rose-500/20 text-rose-300"
                        : theme === "dark"
                          ? "bg-slate-700 text-slate-300"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {alert.is_critical ? "Critical" : "Non-critical"}
                  </span>
                </div>

                <p className="mt-2 text-base font-medium leading-relaxed">
                  {alert.ai_summary || "No AI summary available"}
                </p>

                <details className={`mt-3 rounded-lg border px-3 py-2 ${detailsClass}`}>
                  <summary className="cursor-pointer text-sm font-medium text-cyan-300">
                    View Raw Logs
                  </summary>
                  <div className={`mt-3 space-y-2 text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
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
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
