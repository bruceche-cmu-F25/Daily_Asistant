import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("./api", () => ({
  loadNeetCode: () => Promise.resolve({
    problems: [{ key: "leetcode:two-sum", title: "Two Sum", topic: "Arrays & Hashing", difficulty: "Easy", minutes: 25, start_url: "https://neetcode.io/problems/two-integer-sum/question?list=neetcode150" }],
    progress: {},
    topics: [{ name: "Arrays & Hashing", total: 1, completed: 0 }],
    summary: { completed: 0, total: 1, stuck: 0 },
  }),
}));

describe("App", () => {
  it("renders the local-first home shell", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText("DAILY")).toBeInTheDocument();
    expect(await screen.findByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NEETCODE" })).toHaveAttribute("href", "/neetcode");
  });
});
