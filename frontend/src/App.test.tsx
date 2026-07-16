import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("./api", () => ({
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
}));

describe("App", () => {
  it("renders the local-first home shell", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText("DAILY")).toBeInTheDocument();
    expect(await screen.findByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NEETCODE" })).toHaveAttribute("href", "/neetcode");
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
