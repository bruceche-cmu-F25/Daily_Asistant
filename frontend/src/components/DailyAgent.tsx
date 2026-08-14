import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  approveDailyAgentDraft,
  clearDailyAgentHistory,
  createDailyAgentSession,
  deleteDailyAgentSession,
  dismissDailyAgentDraft,
  loadDailyAgentHistory,
  loadDailyAgentSessions,
  loadDailyAgentSettings,
  loadDailyAgentStatus,
  renameDailyAgentSession,
  saveDailyAgentSettings,
  streamDailyAgentMessage,
  testDailyAgentSettings,
  type DailyAgentSettings,
  type DailyAgentStatus,
  type DailyAgentStreamEvent,
} from "../api";
import type { DailyAgentDraft, DailyAgentMessage, DailyAgentSession, DailyAgentTrace } from "../types";


const emptyStatus: DailyAgentStatus = {
  configured: false,
  model: null,
  detail: "Checking local agent…",
};

const emptySettings: DailyAgentSettings = {
  base_url: "https://api.openai.com/v1",
  model: "",
  has_api_key: false,
  has_saved_api_key: false,
  source: "default",
};

type ProviderId = "openai" | "gemini" | "openrouter" | "groq" | "deepseek" | "xai" | "mistral" | "custom";

const providers: Array<{
  id: ProviderId;
  name: string;
  baseUrl: string;
  portal: string;
  defaultModel: string;
  models: string[];
}> = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    portal: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-5.6-terra",
    models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    portal: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    portal: "https://openrouter.ai/settings/keys",
    defaultModel: "google/gemini-2.5-flash",
    models: ["google/gemini-2.5-flash", "openai/gpt-5.6-terra", "deepseek/deepseek-chat"],
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    portal: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    portal: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat"],
  },
  {
    id: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    portal: "https://console.x.ai/",
    defaultModel: "grok-4-fast-reasoning",
    models: ["grok-4-fast-reasoning", "grok-4-fast-non-reasoning"],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    portal: "https://console.mistral.ai/api-keys",
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
  },
  {
    id: "custom",
    name: "Custom / Local",
    baseUrl: "",
    portal: "",
    defaultModel: "",
    models: [],
  },
];

function providerForBaseUrl(baseUrl: string): ProviderId {
  return providers.find((provider) => provider.baseUrl && provider.baseUrl === baseUrl.replace(/\/$/, ""))?.id ?? "custom";
}

function dueLabel(value: string | null) {
  if (!value) return "Someday / 未排期";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: value.includes("T") ? "numeric" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(date);
}

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => (
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function MessageContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {list.map((item, index) => <li key={`${item}-${index}`}>{inlineMarkdown(item)}</li>)}
      </ul>,
    );
    list = [];
  };

  content.split(/\r?\n/).forEach((line) => {
    const item = line.match(/^\s*[-*•]\s+(.+)$/);
    if (item) {
      list.push(item[1]);
      return;
    }
    flushList();
    if (line.trim()) blocks.push(<p key={`line-${blocks.length}`}>{inlineMarkdown(line)}</p>);
  });
  flushList();
  return <div className="daily-agent-message-content">{blocks}</div>;
}

function traceTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function traceDuration(milliseconds: number) {
  if (milliseconds < 1_000) return `${milliseconds} MS`;
  return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} S`;
}

function tokenCount(value: number | null) {
  return value === null ? "N/A" : new Intl.NumberFormat("en-US").format(value);
}

function MessageTrace({ createdAt, trace }: { createdAt: string; trace?: DailyAgentTrace | null }) {
  return (
    <footer className={`daily-agent-trace${trace?.status === "failed" ? " failed" : ""}`}>
      <div className="daily-agent-trace-summary">
        <time dateTime={createdAt}>{traceTime(createdAt)}</time>
        {trace && (
          <>
            <b>{traceDuration(trace.duration_ms)}</b>
            <b>{tokenCount(trace.total_tokens)} TOKENS</b>
            <b>{trace.model_calls} MODEL {trace.model_calls === 1 ? "CALL" : "CALLS"}</b>
            <b>{trace.tool_calls} TOOL {trace.tool_calls === 1 ? "CALL" : "CALLS"}</b>
          </>
        )}
      </div>
      {trace?.rounds.length ? (
        <details>
          <summary>MODEL TRACE <span aria-hidden="true">＋</span></summary>
          <div className="daily-agent-trace-rounds">
            {trace.rounds.map((round) => (
              <div className="daily-agent-trace-round" key={round.round}>
                <div>
                  <strong>ROUND {round.round}</strong>
                  <em>{round.status.toUpperCase()}</em>
                  <time dateTime={round.started_at}>{traceTime(round.started_at)}</time>
                </div>
                <p>
                  <span>{traceDuration(round.duration_ms)}</span>
                  <span>IN {tokenCount(round.prompt_tokens)}</span>
                  <span>OUT {tokenCount(round.completion_tokens)}</span>
                  {round.cached_tokens !== null && <span>CACHE {tokenCount(round.cached_tokens)}</span>}
                </p>
                {round.tools.length > 0 && (
                  <small>TOOLS · {round.tools.join(" · ")}</small>
                )}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </footer>
  );
}

function DraftCard({
  draft,
  onResolve,
}: {
  draft: DailyAgentDraft;
  onResolve: (draft: DailyAgentDraft) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resolve = async (decision: "approve" | "dismiss") => {
    setBusy(true);
    setError("");
    try {
      const result = decision === "approve"
        ? await approveDailyAgentDraft(draft.id)
        : await dismissDailyAgentDraft(draft.id);
      onResolve(result.draft);
      if (decision === "approve") window.dispatchEvent(new Event("daily-agent:changed"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to resolve draft");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`daily-agent-draft ${draft.status}`} aria-label={`Life task draft: ${draft.summary}`}>
      <span className="daily-agent-draft-kind">LIFE TASK DRAFT</span>
      <strong>{draft.payload.title}</strong>
      <small>{draft.payload.category.toUpperCase()} · {dueLabel(draft.payload.due_at)}</small>
      {draft.payload.notes && <p>{draft.payload.notes}</p>}
      {draft.status === "pending" ? (
        <div className="daily-agent-draft-actions">
          <button type="button" disabled={busy} onClick={() => void resolve("approve")}>CONFIRM & ADD</button>
          <button type="button" disabled={busy} onClick={() => void resolve("dismiss")}>DISMISS</button>
        </div>
      ) : <span className="daily-agent-draft-result">{draft.status.toUpperCase()}</span>}
      {error && <p className="daily-agent-inline-error">{error}</p>}
    </article>
  );
}

export function DailyAgent() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "settings" | "help">("chat");
  const [status, setStatus] = useState(emptyStatus);
  const [sessions, setSessions] = useState<DailyAgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [messages, setMessages] = useState<DailyAgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runElapsedMs, setRunElapsedMs] = useState(0);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(emptySettings);
  const [providerId, setProviderId] = useState<ProviderId>("openai");
  const [settingsForm, setSettingsForm] = useState({
    base_url: emptySettings.base_url,
    model: "",
    api_key: "",
  });
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const historyRequestRef = useRef(0);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : launcherRef.current;
    document.body.classList.add("daily-agent-open");
    const focusFrame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("[data-agent-initial-focus]")?.focus();
    });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled):not([tabindex="-1"]), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", trapFocus);
      document.body.classList.remove("daily-agent-open");
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSessionBusy(true);
    const requestId = ++historyRequestRef.current;
    void (async () => {
      try {
        const [nextStatus, loadedSessions] = await Promise.all([
          loadDailyAgentStatus(),
          loadDailyAgentSessions(),
        ]);
        let nextSessions = loadedSessions;
        let nextActive = activeSessionId !== null
          ? loadedSessions.find((item) => item.id === activeSessionId) ?? null
          : null;
        if (!nextActive) nextActive = loadedSessions[0] ?? null;
        if (!nextActive) {
          nextActive = await createDailyAgentSession();
          nextSessions = [nextActive];
        }
        const history = await loadDailyAgentHistory(nextActive.id);
        if (requestId !== historyRequestRef.current) return;
        setStatus(nextStatus);
        setSessions(nextSessions);
        setActiveSessionId(nextActive.id);
        setMessages(history);
      } catch (reason) {
        if (requestId === historyRequestRef.current) {
          setError(reason instanceof Error ? reason.message : "Unable to load Daily Agent");
        }
      } finally {
        if (requestId === historyRequestRef.current) setSessionBusy(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, streamingText, activeTools]);

  useEffect(() => {
    if (!loading || !runStartedAt) return;
    const started = Date.now();
    setRunElapsedMs(0);
    const timer = window.setInterval(() => setRunElapsedMs(Date.now() - started), 100);
    return () => window.clearInterval(timer);
  }, [loading, runStartedAt]);

  const updateDraft = (resolved: DailyAgentDraft) => {
    setMessages((current) => current.map((message) => ({
      ...message,
      drafts: message.drafts.map((draft) => draft.id === resolved.id ? resolved : draft),
    })));
  };

  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? null;

  const switchSession = async (sessionId: number) => {
    if (loading || sessionBusy) return;
    if (sessionId === activeSessionId) {
      setSessionsOpen(false);
      return;
    }
    const requestId = ++historyRequestRef.current;
    setSessionBusy(true);
    setError("");
    setStreamingText("");
    try {
      const history = await loadDailyAgentHistory(sessionId);
      if (requestId !== historyRequestRef.current) return;
      setActiveSessionId(sessionId);
      setMessages(history);
      setSessionsOpen(false);
    } catch (reason) {
      if (requestId === historyRequestRef.current) {
        setError(reason instanceof Error ? reason.message : "Unable to switch chat");
      }
    } finally {
      if (requestId === historyRequestRef.current) setSessionBusy(false);
    }
  };

  const addSession = async () => {
    if (loading || sessionBusy) return;
    setSessionBusy(true);
    setError("");
    try {
      const created = await createDailyAgentSession();
      setSessions((current) => [created, ...current]);
      setActiveSessionId(created.id);
      setMessages([]);
      setStreamingText("");
      setSessionsOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create chat");
    } finally {
      setSessionBusy(false);
    }
  };

  const editSessionTitle = async () => {
    if (!activeSession || loading || sessionBusy) return;
    const title = window.prompt("Rename this chat", activeSession.title)?.trim();
    if (!title || title === activeSession.title) return;
    setSessionBusy(true);
    setError("");
    try {
      const renamed = await renameDailyAgentSession(activeSession.id, title);
      setSessions((current) => current.map((item) => item.id === renamed.id ? renamed : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to rename chat");
    } finally {
      setSessionBusy(false);
    }
  };

  const removeSession = async () => {
    if (!activeSession || loading || sessionBusy) return;
    if (!window.confirm(`Delete “${activeSession.title}” and all of its messages and drafts?`)) return;
    setSessionBusy(true);
    setError("");
    try {
      await deleteDailyAgentSession(activeSession.id);
      let remaining = sessions.filter((item) => item.id !== activeSession.id);
      let next = remaining[0] ?? null;
      if (!next) {
        next = await createDailyAgentSession();
        remaining = [next];
      }
      const history = await loadDailyAgentHistory(next.id);
      setSessions(remaining);
      setActiveSessionId(next.id);
      setMessages(history);
      setStreamingText("");
      setSessionsOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete chat");
    } finally {
      setSessionBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading || !status.configured || activeSessionId === null) return;
    const sessionId = activeSessionId;
    const optimistic: DailyAgentMessage = {
      id: -Date.now(),
      session_id: sessionId,
      role: "user",
      content: text,
      tool_calls: [],
      created_at: new Date().toISOString(),
      drafts: [],
    };
    setMessages((current) => [...current, optimistic]);
    setInput("");
    setError("");
    setStreamingText("");
    setRunStartedAt(new Date().toISOString());
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamDailyAgentMessage(sessionId, text, controller.signal, (streamEvent: DailyAgentStreamEvent) => {
        if (streamEvent.type === "tools") setActiveTools(streamEvent.names);
        if (streamEvent.type === "text") setStreamingText(streamEvent.text);
        if (streamEvent.type === "error") setError(streamEvent.error);
      });
      const [history, nextSessions] = await Promise.all([
        loadDailyAgentHistory(sessionId),
        loadDailyAgentSessions(),
      ]);
      setMessages(history);
      setSessions(nextSessions);
      setStreamingText("");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        setError("Stopped.");
      } else {
        setError(reason instanceof Error ? reason.message : "Daily Agent request failed");
      }
      setMessages(await loadDailyAgentHistory(sessionId).catch(() => messages));
    } finally {
      setActiveTools([]);
      setLoading(false);
      setRunStartedAt(null);
      setRunElapsedMs(0);
      abortRef.current = null;
    }
  };

  const clear = async () => {
    if (activeSessionId === null || loading || sessionBusy) return;
    if (!window.confirm("Clear this chat and its unresolved drafts? Other chats will be kept.")) return;
    setSessionBusy(true);
    try {
      await clearDailyAgentHistory(activeSessionId);
      setMessages([]);
      setStreamingText("");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to clear chat");
    } finally {
      setSessionBusy(false);
    }
  };

  const refreshStatus = async () => setStatus(await loadDailyAgentStatus());

  const openSettings = async () => {
    setView("settings");
    setSettingsError("");
    setSettingsNotice("");
    setSettingsBusy(true);
    try {
      const next = await loadDailyAgentSettings();
      setSettings(next);
      setProviderId(providerForBaseUrl(next.base_url));
      setSettingsForm({ base_url: next.base_url, model: next.model, api_key: "" });
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "Unable to load settings");
    } finally {
      setSettingsBusy(false);
    }
  };

  const selectProvider = (nextId: ProviderId) => {
    setProviderId(nextId);
    const provider = providers.find((item) => item.id === nextId);
    if (!provider || nextId === "custom") return;
    setSettingsForm((current) => ({
      ...current,
      base_url: provider.baseUrl,
      model: provider.defaultModel,
    }));
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsNotice("");
    try {
      const next = await saveDailyAgentSettings({
        base_url: settingsForm.base_url,
        model: settingsForm.model,
        api_key: settingsForm.api_key || undefined,
      });
      setSettings(next);
      setSettingsForm((current) => ({ ...current, api_key: "" }));
      await refreshStatus();
      setSettingsNotice("Saved locally. The API key will not be shown again.");
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "Unable to save settings");
    } finally {
      setSettingsBusy(false);
    }
  };

  const testSettings = async () => {
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsNotice("");
    try {
      const result = await testDailyAgentSettings({
        base_url: settingsForm.base_url,
        model: settingsForm.model,
        api_key: settingsForm.api_key || undefined,
      });
      setSettingsNotice(`Connection works · ${result.model}`);
      await refreshStatus();
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "Connection test failed");
    } finally {
      setSettingsBusy(false);
    }
  };

  const clearSavedKey = async () => {
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsNotice("");
    try {
      const next = await saveDailyAgentSettings({
        base_url: settingsForm.base_url,
        model: settingsForm.model,
        clear_api_key: true,
      });
      setSettings(next);
      setSettingsForm((current) => ({ ...current, api_key: "" }));
      await refreshStatus();
      setSettingsNotice(next.has_api_key
        ? "Saved key cleared. The environment key is still available."
        : "Saved API key cleared.");
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "Unable to clear API key");
    } finally {
      setSettingsBusy(false);
    }
  };

  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? providers[providers.length - 1];

  return (
    <>
      <button
        ref={launcherRef}
        className={`daily-agent-launcher${open ? " active" : ""}`}
        type="button"
        aria-label="Open Daily Agent"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>&gt;_</span>
        <b>DAILY AGENT</b>
        <small>⌘J</small>
      </button>
      {open && createPortal(
        <aside ref={panelRef} className="daily-agent-panel" role="dialog" aria-label="Daily Agent" aria-modal="true">
          <header>
            <div className="daily-agent-title">
              <span>LOCAL RUNTIME / SESSION ATTACHED</span>
              <h2><b aria-hidden="true">&gt;_</b> daily-agent</h2>
              <small>INTERACTIVE DAILY SHELL</small>
            </div>
            <div className="daily-agent-header-actions">
              {view === "chat" ? (
                <>
                  <button type="button" onClick={() => void openSettings()}>SETTINGS</button>
                  <button type="button" onClick={() => void clear()} disabled={!messages.length || loading || sessionBusy}>CLEAR</button>
                </>
              ) : (
                <button type="button" onClick={() => setView("chat")}>← BACK</button>
              )}
              <button data-agent-initial-focus type="button" aria-label="Close Daily Agent" onClick={() => setOpen(false)}>×</button>
            </div>
          </header>
          <div className={`daily-agent-status ${status.configured ? "online" : "offline"}`}>
            <i />
            <div>
              <span>{status.configured ? status.model : "NOT CONFIGURED"}</span>
              <small>{status.detail}</small>
            </div>
            <em>{status.configured ? "READY" : "SETUP REQUIRED"}</em>
          </div>
          {view === "help" ? (
            <section className="daily-agent-help" aria-label="Daily Agent capabilities">
              <div className="daily-agent-help-intro">
                <span>REFERENCE / REGISTERED TOOLS</span>
                <h3><b aria-hidden="true">$</b> daily-agent --help</h3>
                <p>Use natural language. Current Dashboard data is read through registered local tools before answering.</p>
              </div>
              <div className="daily-agent-help-grid">
                <article>
                  <code>get_today</code>
                  <strong>查看今天</strong>
                  <p>日历事件、Weekly / Notion 事项、Dashboard 指标和数据新鲜度。</p>
                  <small>“今天有什么？” · “帮我排一下今天的优先级。”</small>
                </article>
                <article>
                  <code>list_life_tasks</code>
                  <strong>查看 Life Tasks</strong>
                  <p>读取未完成、到期或全部生活事项。</p>
                  <small>“这周有哪些生活事项？” · “把已完成的也列出来。”</small>
                </article>
                <article>
                  <code>list_applications</code>
                  <strong>检查求职进度</strong>
                  <p>查看公司、职位、阶段、下一步、Follow-up 和 Deadline。</p>
                  <small>“哪些申请该 follow up？” · “最近的 deadline 是什么？”</small>
                </article>
                <article>
                  <code>get_neetcode_progress</code>
                  <strong>查看刷题进度</strong>
                  <p>读取完成统计、Topic 分布和最近 Attempts。</p>
                  <small>“我最近刷题进度怎么样？” · “下一步练哪个 topic？”</small>
                </article>
                <article>
                  <code>draft_life_task</code>
                  <strong>起草 Life Task</strong>
                  <p>一次最多起草三个；只生成待确认卡片，不会直接写入。</p>
                  <small>“起草一个周三预约牙医的任务。”</small>
                </article>
              </div>
              <div className="daily-agent-help-limits">
                <span>BOUNDARIES</span>
                <p>不能直接修改 Calendar、Notion、求职记录、NeetCode、文件系统；不能执行 Shell 或访问任意网络。读取可直接运行，写入只限确认后的 Life Task Draft。</p>
              </div>
            </section>
          ) : view === "settings" ? (
            <form className="daily-agent-settings" onSubmit={(event) => void saveSettings(event)}>
              <div className="daily-agent-settings-intro">
                <span>MODEL CONNECTION</span>
                <strong>OpenAI-compatible API</strong>
                <p>Choose the endpoint and model used by Daily Agent. Settings are stored only in this dashboard's local SQLite database.</p>
              </div>
              <label>
                <span>PROVIDER</span>
                <select
                  aria-label="PROVIDER"
                  value={providerId}
                  onChange={(event) => selectProvider(event.target.value as ProviderId)}
                  disabled={settingsBusy}
                >
                  {providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}
                </select>
                {selectedProvider.portal ? (
                  <a
                    className="daily-agent-provider-portal"
                    href={selectedProvider.portal}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GET {selectedProvider.name.toUpperCase()} API KEY ↗
                  </a>
                ) : <small>Use any OpenAI-compatible Chat Completions endpoint.</small>}
              </label>
              <label>
                <span>BASE URL</span>
                <input
                  aria-label="BASE URL"
                  type="url"
                  value={settingsForm.base_url}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, base_url: event.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  disabled={settingsBusy}
                  required
                />
                <small>Must expose /chat/completions.</small>
              </label>
              <label>
                <span>MODEL</span>
                <input
                  aria-label="MODEL"
                  value={settingsForm.model}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, model: event.target.value }))}
                  placeholder="Enter provider model ID"
                  list="daily-agent-models"
                  disabled={settingsBusy}
                  required
                />
                <datalist id="daily-agent-models">
                  {selectedProvider.models.map((model) => <option value={model} key={model} />)}
                </datalist>
              </label>
              <label>
                <span>API KEY</span>
                <input
                  aria-label="API KEY"
                  type="password"
                  value={settingsForm.api_key}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, api_key: event.target.value }))}
                  placeholder={settings.has_api_key ? "Leave blank to keep current key" : "Paste API key"}
                  autoComplete="new-password"
                  disabled={settingsBusy}
                />
                <small className={settings.has_api_key ? "available" : ""}>
                  {settings.has_saved_api_key
                    ? "● A key is saved locally; its value cannot be read back."
                    : settings.has_api_key
                      ? "● A key is available from an environment variable."
                      : "○ No API key configured."}
                </small>
              </label>
              <div className="daily-agent-settings-note">
                API usage is billed separately by the model provider; a ChatGPT subscription does not supply an API key.
              </div>
              {settingsError && <div className="daily-agent-error" role="alert">{settingsError}</div>}
              {settingsNotice && <div className="daily-agent-settings-success" role="status">{settingsNotice}</div>}
              <div className="daily-agent-settings-actions">
                <button type="submit" disabled={settingsBusy || !settingsForm.base_url.trim() || !settingsForm.model.trim()}>SAVE</button>
                <button type="button" onClick={() => void testSettings()} disabled={settingsBusy || !settingsForm.base_url.trim() || !settingsForm.model.trim()}>TEST CONNECTION</button>
                <button type="button" onClick={() => void clearSavedKey()} disabled={settingsBusy || !settings.has_saved_api_key}>CLEAR SAVED KEY</button>
              </div>
            </form>
          ) : (
          <div className={`daily-agent-workspace${sessionsOpen ? " sessions-open" : ""}`}>
            <button
              className="daily-agent-session-scrim"
              type="button"
              aria-label="Close chat history"
              aria-hidden={!sessionsOpen}
              tabIndex={sessionsOpen ? 0 : -1}
              onClick={() => setSessionsOpen(false)}
            />
            <nav className="daily-agent-sessions" aria-label="Daily Agent chats">
              <div className="daily-agent-sessions-heading">
                <div>
                  <span>CONVERSATIONS</span>
                  <small>{sessions.length} LOCAL</small>
                </div>
                <button
                  type="button"
                  onClick={() => void addSession()}
                  disabled={loading || sessionBusy}
                >
                  + SESSION
                </button>
              </div>
              <div className="daily-agent-session-list">
                {sessions.map((item, index) => (
                  <button
                    className={item.id === activeSessionId ? "active" : ""}
                    type="button"
                    aria-current={item.id === activeSessionId ? "page" : undefined}
                    onClick={() => void switchSession(item.id)}
                    disabled={loading || sessionBusy}
                    key={item.id}
                  >
                    <span className="daily-agent-session-mark">{String(index + 1).padStart(2, "0")}</span>
                    <span className="daily-agent-session-meta">
                      <b>{item.title}</b>
                      <time dateTime={item.updated_at}>{traceTime(item.updated_at)}</time>
                    </span>
                  </button>
                ))}
              </div>
              <p>Each chat keeps its own messages and drafts.</p>
            </nav>
            <section className="daily-agent-conversation" aria-label={activeSession?.title ?? "Current chat"}>
              <div className="daily-agent-conversation-bar">
                <button
                  className="daily-agent-drawer-toggle"
                  type="button"
                  aria-expanded={sessionsOpen}
                  aria-label="Open chat history"
                  onClick={() => setSessionsOpen(true)}
                >
                  CHATS
                </button>
                <div>
                  <span>CURRENT SESSION</span>
                  <strong>{activeSession?.title ?? (sessionBusy ? "Loading…" : "New chat")}</strong>
                </div>
                <div className="daily-agent-session-actions">
                  <button type="button" onClick={() => setView("help")}>HELP</button>
                  <button
                    type="button"
                    onClick={() => void editSessionTitle()}
                    disabled={!activeSession || loading || sessionBusy}
                  >
                    RENAME
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeSession()}
                    disabled={!activeSession || loading || sessionBusy}
                  >
                    DELETE
                  </button>
                </div>
              </div>
          <div className="daily-agent-messages" aria-live="polite" aria-busy={sessionBusy}>
            {!messages.length && !streamingText && (
              <div className="daily-agent-empty">
                <span className="daily-agent-empty-mark">&gt;_</span>
                <strong>daily-agent ready</strong>
                <p><span>$</span> 今天有什么？<br /><span>$</span> 哪些申请该 follow up？<br /><span>$</span> 周三提醒我预约牙医。</p>
                <small>READS: DIRECT · WRITES: CONFIRMATION REQUIRED</small>
              </div>
            )}
            {messages.map((message) => (
              <article className={`daily-agent-message ${message.role}`} key={message.id}>
                <span>{message.role === "user" ? "INPUT" : "OUTPUT"}</span>
                <MessageContent content={message.content} />
                {message.drafts.map((draft) => <DraftCard draft={draft} onResolve={updateDraft} key={draft.id} />)}
                <MessageTrace createdAt={message.created_at} trace={message.role === "assistant" ? message.trace : null} />
              </article>
            ))}
            {(streamingText || loading) && (
              <article className="daily-agent-message assistant streaming">
                <span>OUTPUT</span>
                {activeTools.length ? <small>RUNNING {activeTools.join(", ").toUpperCase()}…</small> : null}
                {streamingText ? <MessageContent content={streamingText} /> : <i>waiting for output_</i>}
                {runStartedAt && (
                  <footer className="daily-agent-trace active">
                    <div className="daily-agent-trace-summary">
                      <time dateTime={runStartedAt}>{traceTime(runStartedAt)}</time>
                      <b>{traceDuration(runElapsedMs)}</b>
                      <b>{activeTools.length ? `${activeTools.length} ACTIVE TOOLS` : "PROCESS ACTIVE"}</b>
                    </div>
                  </footer>
                )}
              </article>
            )}
            {error && <div className="daily-agent-error" role="alert">{error}</div>}
            <div ref={endRef} />
          </div>
          <form className="daily-agent-composer" onSubmit={(event) => void submit(event)}>
            <div className="daily-agent-composer-field">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={status.configured ? "Type a command or ask about your day…" : "Open Settings to add an API key and model"}
                aria-label="Message Daily Agent"
                disabled={!status.configured || loading || sessionBusy || activeSessionId === null}
                rows={3}
              />
              <small>ENTER TO RUN · SHIFT + ENTER FOR A NEW LINE</small>
            </div>
            {loading ? (
              <button type="button" onClick={() => abortRef.current?.abort()}>STOP</button>
            ) : (
              <button type="submit" disabled={!status.configured || !input.trim() || sessionBusy || activeSessionId === null}>RUN ↗</button>
            )}
          </form>
            </section>
          </div>
          )}
        </aside>,
        document.body,
      )}
    </>
  );
}
