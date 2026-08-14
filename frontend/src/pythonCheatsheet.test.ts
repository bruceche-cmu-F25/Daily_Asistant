import { describe, expect, it } from "vitest";

import { pythonCheatMatches, pythonCheatsheet } from "./pythonCheatsheet";

const officialMethods = [
  "str.capitalize", "str.casefold", "str.center", "str.count", "str.encode", "str.endswith",
  "str.expandtabs", "str.find", "str.format", "str.format_map", "str.index", "str.isalnum",
  "str.isalpha", "str.isascii", "str.isdecimal", "str.isdigit", "str.isidentifier", "str.islower",
  "str.isnumeric", "str.isprintable", "str.isspace", "str.istitle", "str.isupper", "str.join",
  "str.ljust", "str.lower", "str.lstrip", "str.maketrans", "str.partition", "str.removeprefix",
  "str.removesuffix", "str.replace", "str.rfind", "str.rindex", "str.rjust", "str.rpartition",
  "str.rsplit", "str.rstrip", "str.split", "str.splitlines", "str.startswith", "str.strip",
  "str.swapcase", "str.title", "str.translate", "str.upper", "str.zfill",
  "list.count", "list.index", "list.append", "list.clear", "list.copy", "list.extend", "list.insert",
  "list.pop", "list.remove", "list.reverse", "list.sort",
  "dict.clear", "dict.copy", "dict.fromkeys", "dict.get", "dict.items", "dict.keys", "dict.pop",
  "dict.popitem", "dict.setdefault", "dict.update", "dict.values",
  "set.isdisjoint", "set.issubset", "set.issuperset", "set.union", "set.intersection",
  "set.difference", "set.symmetric_difference", "set.copy", "set.update", "set.intersection_update",
  "set.difference_update", "set.symmetric_difference_update", "set.add", "set.remove", "set.discard",
  "set.pop", "set.clear", "tuple.count", "tuple.index",
] as const;

describe("Python cheatsheet", () => {
  it("provides a unique 181-operation reference from syntax through production", () => {
    expect(pythonCheatsheet).toHaveLength(181);
    expect(new Set(pythonCheatsheet.map((item) => item.id)).size).toBe(181);
    expect(pythonCheatsheet.filter((item) => item.category === "OOP")).toHaveLength(18);
    expect(pythonCheatsheet.filter((item) => item.category === "Core Patterns")).toHaveLength(12);
    expect(pythonCheatsheet.filter((item) => item.category === "Project Engineering")).toHaveLength(24);
    expect(pythonCheatsheet.filter((item) => item.category === "Interview Patterns")).toHaveLength(18);
    expect(pythonCheatsheet.filter((item) => item.category === "Engineering Design")).toHaveLength(9);
    const newGuidedCards = pythonCheatsheet.filter((item) => ["Core Patterns", "Project Engineering", "Interview Patterns", "Engineering Design"].includes(item.category));
    expect(newGuidedCards).toHaveLength(63);
    expect(newGuidedCards.every((item) => Boolean(item.whenToUse && item.commonMistake))).toBe(true);
    const implementations = pythonCheatsheet.filter((item) => item.category === "Data Structures" || item.category === "Algorithms");
    expect(implementations).toHaveLength(40);
    expect(implementations.every((item) => Boolean(item.complexity))).toBe(true);
  });

  it("indexes every official str, list, dict, set and tuple method", () => {
    const missing = officialMethods.filter((method) => (
      !pythonCheatsheet.some((item) => pythonCheatMatches(item, method))
    ));
    expect(missing).toEqual([]);
  });

  it("understands action phrases in either word order", () => {
    expect(pythonCheatsheet.some((item) => item.id === "dict-access" && pythonCheatMatches(item, "access dict"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "dict-access" && pythonCheatMatches(item, "dict access"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "string-modify" && pythonCheatMatches(item, "string modification"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "ds-trie" && pythonCheatMatches(item, "implement trie"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "algo-binary-search" && pythonCheatMatches(item, "binary search implementation"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "ds-union-find" && pythonCheatMatches(item, "并查集"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "algo-sliding-window" && pythonCheatMatches(item, "滑动窗口"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "oop-class-instance" && pythonCheatMatches(item, "create object"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "oop-protocol" && pythonCheatMatches(item, "鸭子类型"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "oop-dependency-injection" && pythonCheatMatches(item, "dependency injection"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "oop-strategy" && pythonCheatMatches(item, "策略模式"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "core-args-kwargs" && pythonCheatMatches(item, "keyword only args kwargs"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "project-pytest-fixture" && pythonCheatMatches(item, "pytest fixture"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "interview-grid-bfs" && pythonCheatMatches(item, "matrix bfs"))).toBe(true);
    expect(pythonCheatsheet.some((item) => item.id === "design-repository" && pythonCheatMatches(item, "repository pattern"))).toBe(true);
  });
});
