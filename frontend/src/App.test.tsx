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
    notion: [], jobs: [], news: [{ title: "AI ships", link: "https://example.com/news", snippet: "A useful signal." }],
    discover_events: [{ title: "Silicon Valley AI Builders", link: "https://luma.com/example", snippet: "Meet local AI builders in Mountain View.", source: "Luma" }],
    job_groups: {},
    quick_actions: [{ title: "Gmail", subtitle: "Inbox / 邮件", url: "https://mail.google.com/mail/u/0/#inbox", kind: "hot" }],
    quiet_links: [{ title: "LinkedIn", url: "https://www.linkedin.com/in/chi-cheng921/", kind: "profile", label: "Profile" }],
    target_copy: "Target", target_copy_cn: "目标",
  }),
  loadNeetCode: () => Promise.resolve({
    problems: [
      { key: "leetcode:two-sum", title: "Two Sum", topic: "Arrays & Hashing", difficulty: "Easy", minutes: 25, start_url: "https://neetcode.io/problems/two-integer-sum/question?list=neetcode150" },
      { key: "leetcode:valid-palindrome", title: "Valid Palindrome", topic: "Two Pointers", difficulty: "Easy", minutes: 25, start_url: "https://neetcode.io/problems/is-palindrome/question?list=neetcode150" },
    ],
    progress: {},
    attempts: [{
      id: 7,
      problem_key: "leetcode:two-sum",
      status: "solved",
      language: "python",
      solution: "def two_sum(nums, target):\n    return []",
      reflection: "Use a complement map.",
      source: "native",
      created_at: "2026-07-15T20:38:32-07:00",
      updated_at: "2026-07-15T20:38:32-07:00",
    }],
    topics: [
      { name: "Arrays & Hashing", total: 1, completed: 0 },
      { name: "Two Pointers", total: 1, completed: 0 },
    ],
    summary: { completed: 0, total: 2, stuck: 0, attempts: 1 },
  }),
  loadWorkspace: () => Promise.resolve({ draft: null, attempts: [] }),
  saveWorkingDraft: () => Promise.resolve({ ok: true, updated_at: "2026-07-15T09:00:00-07:00" }),
  createAttempt: () => Promise.resolve({ ok: true, attempt: {} }),
  loadTodos: () => Promise.resolve([]),
  saveTodo: () => Promise.resolve({ item_key: "", source: "", title: "", completed: true, updated_at: "" }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("App", () => {
  it("renders the local-first home shell", async () => {
    const { container } = render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText("Daily")).toBeInTheDocument();
    expect(await screen.findByText(/Focus/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NEETCODE" })).toHaveAttribute("href", "/neetcode");
    expect(screen.getByRole("link", { name: /去刷题/ })).toHaveAttribute("href", "/neetcode");
    expect(screen.getByRole("link", { name: /去学习/ })).toHaveAttribute("href", "/learn");
    expect(screen.getByRole("link", { name: /看活动/ })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: /Gmail/ })).toHaveAttribute("href", "https://mail.google.com/mail/u/0/#inbox");
    expect(screen.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", "https://www.linkedin.com/in/chi-cheng921/");
    expect(container.querySelector('[data-brand-logo="gmail"] svg')).toBeInTheDocument();
    expect(container.querySelector('[data-brand-logo="linkedin"] svg')).toBeInTheDocument();
  });

  it("finds migrated resources in global search", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const search = screen.getByRole("searchbox", { name: "Global search" });
    fireEvent.change(search, { target: { value: "linkedin" } });
    expect(await screen.findByText(/Profile \+ job search/)).toBeInTheDocument();
  });

  it("renders the read-only activity radar and news feed", async () => {
    render(<MemoryRouter initialEntries={["/discover"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Events / 活动雷达" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Silicon Valley AI Builders/ })).toHaveAttribute("href", "https://luma.com/example");
    expect(screen.getByRole("link", { name: /Bay Area AI on Luma/ })).toHaveAttribute("href", "https://luma.com/discover/sf/ai");
    expect(screen.getByRole("link", { name: /CMU Silicon Valley/ })).toHaveAttribute("href", "https://events.cmu.edu/sv/");
    expect(screen.getByRole("link", { name: /AI ships/ })).toHaveAttribute("href", "https://example.com/news");
    expect(screen.getByText(/只读发现/)).toBeInTheDocument();
  });

  it("renders embedded JavaScript and TypeScript learning tracks with local progress", async () => {
    render(<MemoryRouter initialEntries={["/learn"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("LearningLab");
    expect(screen.getByTitle("JavaScript Foundations course player")).toHaveAttribute("src", expect.stringContaining("jS4aFq5-91M"));
    expect(screen.getByRole("link", { name: /JavaScript V9/ })).toHaveAttribute("href", "https://www.freecodecamp.org/learn/javascript-v9/");
    expect(screen.getByRole("link", { name: /Front End Development Libraries V9/ })).toHaveAttribute("href", "https://www.freecodecamp.org/learn/front-end-development-libraries-v9/");
    expect(screen.getByRole("link", { name: /FastAPI Tutorial/ })).toHaveAttribute("href", "https://fastapi.tiangolo.com/tutorial/");
    expect(screen.queryByText(/One useful note/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Advanced TypeScript/ }));
    expect(screen.getByTitle("Advanced TypeScript course player")).toHaveAttribute("src", expect.stringContaining("PLIvujZeVDLMx040"));
    fireEvent.click(screen.getByRole("button", { name: /MARK TODAY DONE/ }));
    expect(screen.getByRole("button", { name: "✓ DONE TODAY / 已完成" })).toBeInTheDocument();
    expect(window.localStorage.getItem("daily-dashboard:learning-progress:v1")).toContain("typescript");
  });

  it("migrates the previous React learning record into the JavaScript track", async () => {
    window.localStorage.setItem("daily-dashboard:learning-progress:v1", JSON.stringify({
      react: { sessions: ["2026-07-15"] },
      typescript: { sessions: [] },
    }));
    render(<MemoryRouter initialEntries={["/learn"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /JavaScript Foundations/ })).toHaveTextContent("1 SESSIONS");
  });

  it("asks for the solution only after the user finishes the problem", async () => {
    render(<MemoryRouter initialEntries={["/neetcode"]}><App /></MemoryRouter>);
    expect(screen.queryByLabelText("Solution is required to mark Solved")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "完成并写心得" }));
    expect(screen.getByRole("dialog", { name: "保存刷题记录" })).toBeInTheDocument();
    const editor = screen.getByLabelText("Solution is required to mark Solved");
    const solved = screen.getByRole("button", { name: "MARK SOLVED" });
    expect(solved).toBeDisabled();
    fireEvent.change(editor, { target: { value: "def two_sum():\n    return []" } });
    expect(solved).toBeEnabled();
  });

  it("renders the NeetCode topic dependency graph", async () => {
    render(<MemoryRouter initialEntries={["/neetcode"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("region", { name: "NeetCode 150 topic graph" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Two Pointers: 0 of 1 completed" }));
    expect(screen.getByRole("link", { name: "Valid Palindrome" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "DO NOW" }));
    expect(screen.getByRole("heading", { name: "Valid Palindrome" })).toBeInTheDocument();
  });

  it("renders complete attempt history with stats and saved notes", async () => {
    render(<MemoryRouter initialEntries={["/neetcode#history"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("region", { name: "Problem history" })).toBeInTheDocument();
    expect(screen.getByLabelText("Problem history summary")).toBeInTheDocument();
    expect(screen.getByText("Use a complement map.")).toBeInTheDocument();
    expect(screen.getByText(/def two_sum/)).toBeInTheDocument();
  });
});
