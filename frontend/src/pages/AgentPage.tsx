import { useCallback, useEffect, useState } from "react";

import { loadPiWebStatus, type PiWebStatus } from "../api";


const PI_WEB_URL = "http://127.0.0.1:30141";
const STATUS_REFRESH_MS = 10_000;

export function AgentPage() {
  const [status, setStatus] = useState<PiWebStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [frameKey, setFrameKey] = useState(0);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await loadPiWebStatus());
    } catch {
      setStatus({
        online: false,
        url: PI_WEB_URL,
        latency_ms: null,
        detail: "Unable to check the Pi Web sidecar",
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), STATUS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  const reloadWorkspace = () => {
    setFrameKey((current) => current + 1);
    void refreshStatus();
  };

  const online = status?.online === true;
  const statusLabel = checking && status === null ? "CHECKING" : online ? "ONLINE" : "OFFLINE";

  return (
    <main className="agent-module-page">
      <section className="agent-module-bar" aria-labelledby="agent-module-title">
        <div>
          <p className="eyebrow">LOCAL SIDECAR · PORT 30141</p>
          <h1 id="agent-module-title">Pi Agent</h1>
          <p>Full Pi Web workspace inside Daily OS. Sessions, models, skills, tools, and project files stay in the Pi runtime.</p>
        </div>
        <div className="agent-module-actions">
          <span className={`agent-runtime-status ${online ? "online" : "offline"}`}>
            <i aria-hidden="true" />
            {statusLabel}
            {online && status?.latency_ms !== null ? <small>{status?.latency_ms}ms</small> : null}
          </span>
          <button type="button" onClick={reloadWorkspace}>RELOAD</button>
          <a href={status?.url ?? PI_WEB_URL} target="_blank" rel="noopener noreferrer">OPEN IN NEW WINDOW ↗</a>
        </div>
      </section>

      <section className="agent-frame-shell" aria-label="Pi Agent workspace">
        {online ? (
          <iframe
            key={frameKey}
            src={status?.url ?? PI_WEB_URL}
            title="Pi Agent workspace"
            allow="clipboard-read; clipboard-write"
            referrerPolicy="no-referrer"
            onLoad={() => window.scrollTo({ top: 0, behavior: "auto" })}
          />
        ) : (
          <div className="agent-offline-state" role="status">
            <span>&gt;_</span>
            <h2>{checking ? "Checking Pi Web…" : "Pi Web is offline"}</h2>
            <p>{status?.detail ?? "Daily OS is checking the local sidecar."}</p>
            {!checking && <button type="button" onClick={refreshStatus}>CHECK AGAIN</button>}
          </div>
        )}
      </section>
    </main>
  );
}
