import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDailyAgentSession, loadDailyAgentHistory } from "../api";
import { DailyAgent } from "./DailyAgent";


vi.mock("../api", () => ({
  loadDailyAgentStatus: () => Promise.resolve({
    configured: true,
    model: "gemini-2.5-flash",
    detail: "Ready · gemini-2.5-flash",
  }),
  loadDailyAgentSessions: () => Promise.resolve([
    { id: 1, title: "Today planning", created_at: "2026-08-10T12:00:00-07:00", updated_at: "2026-08-10T12:00:01-07:00" },
    { id: 2, title: "Job search", created_at: "2026-08-09T12:00:00-07:00", updated_at: "2026-08-09T12:00:01-07:00" },
  ]),
  createDailyAgentSession: vi.fn(() => Promise.resolve({
    id: 3,
    title: "New chat",
    created_at: "2026-08-10T13:00:00-07:00",
    updated_at: "2026-08-10T13:00:00-07:00",
  })),
  renameDailyAgentSession: vi.fn(),
  deleteDailyAgentSession: vi.fn(),
  loadDailyAgentHistory: vi.fn((sessionId: number) => Promise.resolve(sessionId === 2 ? [{
    id: 2,
    session_id: 2,
    role: "assistant",
    content: "只属于求职聊天。",
    tool_calls: [],
    created_at: "2026-08-09T12:00:00-07:00",
    drafts: [],
    trace: null,
  }] : sessionId === 3 ? [] : [{
    id: 1,
    session_id: 1,
    role: "assistant",
    content: "今天有一个重点任务。",
    tool_calls: [],
    created_at: "2026-08-10T12:00:00-07:00",
    drafts: [],
    trace: {
      status: "completed",
      model: "gemini-2.5-flash",
      started_at: "2026-08-10T12:00:00-07:00",
      completed_at: "2026-08-10T12:00:01-07:00",
      duration_ms: 1_240,
      model_calls: 2,
      prompt_tokens: 1_000,
      completion_tokens: 250,
      total_tokens: 1_250,
      cached_tokens: 400,
      tool_calls: 1,
      rounds: [{
        round: 1,
        status: "completed",
        started_at: "2026-08-10T12:00:00-07:00",
        completed_at: "2026-08-10T12:00:01-07:00",
        duration_ms: 720,
        prompt_tokens: 1_000,
        completion_tokens: 100,
        total_tokens: 1_100,
        cached_tokens: 400,
        tools: ["get_today"],
      }],
    },
  }])),
  loadDailyAgentSettings: () => Promise.resolve({
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    has_api_key: true,
    has_saved_api_key: true,
    source: "saved",
  }),
  saveDailyAgentSettings: vi.fn(),
  testDailyAgentSettings: vi.fn(),
  clearDailyAgentHistory: vi.fn(),
  streamDailyAgentMessage: vi.fn(),
  approveDailyAgentDraft: vi.fn(),
  dismissDailyAgentDraft: vi.fn(),
}));


afterEach(cleanup);

describe("Daily Agent trace", () => {
  it("shows compact telemetry and expandable per-round details", async () => {
    render(<DailyAgent />);
    fireEvent.click(screen.getByRole("button", { name: "Open Daily Agent" }));

    expect(await screen.findByText("1,250 TOKENS")).toBeInTheDocument();
    expect(screen.getByText("1.2 S")).toBeInTheDocument();
    expect(screen.getByText("2 MODEL CALLS")).toBeInTheDocument();
    expect(screen.getByText("1 TOOL CALL")).toBeInTheDocument();

    fireEvent.click(screen.getByText("MODEL TRACE"));
    expect(screen.getByText("ROUND 1")).toBeInTheDocument();
    expect(screen.getByText("IN 1,000")).toBeInTheDocument();
    expect(screen.getByText("TOOLS · get_today")).toBeInTheDocument();
  });

  it("switches isolated chats and creates a new session", async () => {
    render(<DailyAgent />);
    fireEvent.click(screen.getByRole("button", { name: "Open Daily Agent" }));

    expect(await screen.findByText("今天有一个重点任务。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Job search/ }));
    expect(await screen.findByText("只属于求职聊天。")).toBeInTheDocument();
    expect(screen.queryByText("今天有一个重点任务。")).not.toBeInTheDocument();
    expect(vi.mocked(loadDailyAgentHistory)).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole("button", { name: "+ SESSION" }));
    expect(await screen.findByText("daily-agent ready")).toBeInTheDocument();
    expect(vi.mocked(createDailyAgentSession)).toHaveBeenCalled();
    expect(screen.getByLabelText("Message Daily Agent")).toBeEnabled();
  });
});
