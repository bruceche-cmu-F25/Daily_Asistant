import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("./api", () => ({
  loadDashboard: () => Promise.resolve({
    date: "2026-07-15",
    generated_at: "2026-07-15T09:00:00-07:00",
    weekly_plan: { title: "Week 1", url: "https://notion.so/week" },
    metrics: { calendar_events: 1, notion_tasks: 1, fresh_jobs: 1 },
    source_status: [{ name: "Calendar", ok: true, detail: "Updated" }],
    stale_sources: [],
    events: [{ key: "event:one", id: "", title: "Focus", start_date: "2026-07-15", start_time: "10:00", end_date: "2026-07-15", end_time: "11:00", location: "", description: "", calendar: "Work", url: "https://calendar.google.com", all_day: false }],
    links: { study: [], jobs: [] },
    weekly: [{ text: "Ship it", key: "notion:one", checked: false, is_todo: true }],
    notion: [], jobs: [], news: [], job_groups: {},
    quick_actions: [{ title: "Gmail", subtitle: "Inbox / 邮件", url: "https://mail.google.com/mail/u/0/#inbox", kind: "hot" }],
    quiet_links: [{ title: "LinkedIn", url: "https://www.linkedin.com/in/chi-cheng921/", kind: "profile", label: "Profile" }],
    target_copy: "Target", target_copy_cn: "目标",
  }),
  loadNeetCode: () => Promise.resolve({
    problems: [{ key: "leetcode:two-sum", title: "Two Sum", topic: "Arrays & Hashing", difficulty: "Easy", minutes: 25, start_url: "https://neetcode.io/problems/two-integer-sum/question?list=neetcode150" }],
    progress: {},
    attempts: [],
    topics: [{ name: "Arrays & Hashing", total: 1, completed: 0 }],
    summary: { completed: 0, total: 1, stuck: 0 },
  }),
  loadWorkspace: () => Promise.resolve({ draft: null, attempts: [] }),
  saveWorkingDraft: () => Promise.resolve({ ok: true, updated_at: "2026-07-15T09:00:00-07:00" }),
  createAttempt: () => Promise.resolve({ ok: true, attempt: {} }),
  loadTodos: () => Promise.resolve([]),
  saveTodo: () => Promise.resolve({ item_key: "", source: "", title: "", completed: true, updated_at: "" }),
}));

afterEach(cleanup);

describe("App", () => {
  it("renders the local-first home shell", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText("Daily")).toBeInTheDocument();
    expect(await screen.findByText(/Focus/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NEETCODE" })).toHaveAttribute("href", "/neetcode");
    expect(screen.getByRole("link", { name: /去刷题/ })).toHaveAttribute("href", "/neetcode");
    expect(screen.getByRole("link", { name: /看活动/ })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: /Gmail/ })).toHaveAttribute("href", "https://mail.google.com/mail/u/0/#inbox");
    expect(screen.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", "https://www.linkedin.com/in/chi-cheng921/");
  });

  it("finds migrated resources in global search", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const search = screen.getByRole("searchbox", { name: "Global search" });
    fireEvent.change(search, { target: { value: "linkedin" } });
    expect(await screen.findByText(/Profile \+ job search/)).toBeInTheDocument();
  });

  it("requires a solution before marking a problem solved", async () => {
    render(<MemoryRouter initialEntries={["/neetcode"]}><App /></MemoryRouter>);
    const editor = await screen.findByLabelText("Solution is required to mark Solved");
    const solved = screen.getByRole("button", { name: "MARK SOLVED" });
    expect(solved).toBeDisabled();
    fireEvent.change(editor, { target: { value: "def two_sum():\n    return []" } });
    expect(solved).toBeEnabled();
  });
});
