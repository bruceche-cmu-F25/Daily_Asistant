import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";

import {
  approveDailyAgentDraft,
  clearDailyAgentHistory,
  dismissDailyAgentDraft,
  loadDailyAgentHistory,
  loadDailyAgentSettings,
  loadDailyAgentStatus,
  saveDailyAgentSettings,
  streamDailyAgentMessage,
  testDailyAgentSettings,
  type DailyAgentSettings,
  type DailyAgentStatus,
  type DailyAgentStreamEvent,
} from "../api";
import type { DailyAgentDraft, DailyAgentMessage } from "../types";


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
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [status, setStatus] = useState(emptyStatus);
  const [messages, setMessages] = useState<DailyAgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTools, setActiveTools] = useState<string[]>([]);
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
    setError("");
    Promise.all([loadDailyAgentStatus(), loadDailyAgentHistory()])
      .then(([nextStatus, history]) => {
        setStatus(nextStatus);
        setMessages(history);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load Daily Agent"));
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, streamingText, activeTools]);

  const updateDraft = (resolved: DailyAgentDraft) => {
    setMessages((current) => current.map((message) => ({
      ...message,
      drafts: message.drafts.map((draft) => draft.id === resolved.id ? resolved : draft),
    })));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading || !status.configured) return;
    const optimistic: DailyAgentMessage = {
      id: -Date.now(),
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
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamDailyAgentMessage(text, controller.signal, (streamEvent: DailyAgentStreamEvent) => {
        if (streamEvent.type === "tools") setActiveTools(streamEvent.names);
        if (streamEvent.type === "text") setStreamingText(streamEvent.text);
        if (streamEvent.type === "error") setError(streamEvent.error);
      });
      setMessages(await loadDailyAgentHistory());
      setStreamingText("");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        setError("Stopped.");
      } else {
        setError(reason instanceof Error ? reason.message : "Daily Agent request failed");
      }
      setMessages(await loadDailyAgentHistory().catch(() => messages));
    } finally {
      setActiveTools([]);
      setLoading(false);
      abortRef.current = null;
    }
  };

  const clear = async () => {
    if (!window.confirm("Clear the local Daily Agent conversation and its unresolved drafts?")) return;
    await clearDailyAgentHistory();
    setMessages([]);
    setStreamingText("");
    setError("");
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
        className={`daily-agent-launcher${open ? " active" : ""}`}
        type="button"
        aria-label={open ? "Close Daily Agent" : "Open Daily Agent"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>&gt;_</span>
        <b>DAILY AGENT</b>
        <small>⌘J</small>
      </button>
      {open && (
        <aside className="daily-agent-panel" role="dialog" aria-label="Daily Agent" aria-modal="false">
          <header>
            <div className="daily-agent-title">
              <span>LOCAL · DOMAIN-SCOPED</span>
              <h2>Daily Agent</h2>
              <small>YOUR DAILY OS COPILOT</small>
            </div>
            <div className="daily-agent-header-actions">
              {view === "chat" ? (
                <>
                  <button type="button" onClick={() => void openSettings()}>SETTINGS</button>
                  <button type="button" onClick={() => void clear()} disabled={!messages.length}>CLEAR</button>
                </>
              ) : (
                <button type="button" onClick={() => setView("chat")}>← BACK</button>
              )}
              <button type="button" aria-label="Close Daily Agent" onClick={() => setOpen(false)}>×</button>
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
          {view === "settings" ? (
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
          ) : <>
          <div className="daily-agent-messages" aria-live="polite">
            {!messages.length && !streamingText && (
              <div className="daily-agent-empty">
                <span className="daily-agent-empty-mark">DA</span>
                <strong>Ask against real Daily data.</strong>
                <p>“今天有什么？”<br />“哪些申请该 follow up？”<br />“周三提醒我预约牙医。”</p>
                <small>Reads run directly. Writes always wait for confirmation.</small>
              </div>
            )}
            {messages.map((message) => (
              <article className={`daily-agent-message ${message.role}`} key={message.id}>
                <span>{message.role === "user" ? "YOU" : "DAILY"}</span>
                <MessageContent content={message.content} />
                {message.drafts.map((draft) => <DraftCard draft={draft} onResolve={updateDraft} key={draft.id} />)}
              </article>
            ))}
            {(streamingText || loading) && (
              <article className="daily-agent-message assistant streaming">
                <span>DAILY</span>
                {activeTools.length ? <small>USING {activeTools.join(", ").toUpperCase()}…</small> : null}
                {streamingText ? <MessageContent content={streamingText} /> : <i>Thinking…</i>}
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
                placeholder={status.configured ? "Ask Daily anything…" : "Open Settings to add an API key and model"}
                aria-label="Message Daily Agent"
                disabled={!status.configured || loading}
                rows={3}
              />
              <small>ENTER TO SEND · SHIFT + ENTER FOR A NEW LINE</small>
            </div>
            {loading ? (
              <button type="button" onClick={() => abortRef.current?.abort()}>STOP</button>
            ) : (
              <button type="submit" disabled={!status.configured || !input.trim()}>SEND ↗</button>
            )}
          </form>
          </>}
        </aside>
      )}
    </>
  );
}
