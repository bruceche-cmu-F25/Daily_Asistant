import type { NeetCodeSnapshot } from "./types";

export async function loadNeetCode(): Promise<NeetCodeSnapshot> {
  const response = await fetch("/api/v1/neetcode", { cache: "no-store" });
  if (!response.ok) throw new Error(`NeetCode API failed: ${response.status}`);
  return response.json() as Promise<NeetCodeSnapshot>;
}
