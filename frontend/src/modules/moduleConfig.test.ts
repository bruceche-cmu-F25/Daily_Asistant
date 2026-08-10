import { describe, expect, it } from "vitest";

import { learningComponentRegistry } from "./learningModule";
import { applyLayoutOperations, compileLayoutInstruction, normalizeLayoutConfig } from "./moduleConfig";

describe("module layout configuration", () => {
  it("compiles Chinese natural language into constrained layout operations", () => {
    const result = compileLayoutInstruction(
      "把今日学习放到最上面，隐藏 JavaScript 课程",
      learningComponentRegistry,
    );

    expect(result.errors).toEqual([]);
    expect(result.operations).toMatchObject([
      { type: "move", componentId: "today", position: "first" },
      { type: "visibility", componentId: "course-workspace", visible: false },
    ]);
  });

  it("applies operations without inventing component ids", () => {
    const config = normalizeLayoutConfig(null, learningComponentRegistry);
    const next = applyLayoutOperations(config, [
      { type: "move", componentId: "project-gym", position: "first", summary: "" },
      { type: "visibility", componentId: "resource-library", visible: false, summary: "" },
    ]);

    expect(next.order[0]).toBe("project-gym");
    expect(next.hidden).toEqual(["resource-library"]);
    expect(next.order).toHaveLength(learningComponentRegistry.length);
  });

  it("returns an explicit error when a requested component is unavailable", () => {
    const result = compileLayoutInstruction("添加一个每周学习图表", learningComponentRegistry);

    expect(result.operations).toEqual([]);
    expect(result.errors[0]).toContain("找不到");
  });
});
