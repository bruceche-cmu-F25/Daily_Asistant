import type { AttemptStatus, DashboardSnapshot, NeetCodeSnapshot, ProblemAttempt, ProblemWorkspace, TodoState } from "./types";

export async function loadDashboard(): Promise<DashboardSnapshot> {
  const response = await fetch("/api/v1/dashboard", { cache: "no-store" });
  if (!response.ok) throw new Error(`Dashboard API failed: ${response.status}`);
  return response.json() as Promise<DashboardSnapshot>;
}

export async function loadNeetCode(): Promise<NeetCodeSnapshot> {
  const response = await fetch("/api/v1/neetcode", { cache: "no-store" });
  if (!response.ok) throw new Error(`NeetCode API failed: ${response.status}`);
  return response.json() as Promise<NeetCodeSnapshot>;
}

export async function loadWorkspace(problemKey: string): Promise<ProblemWorkspace> {
  const response = await fetch(`/api/v1/problems/${encodeURIComponent(problemKey)}/workspace`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Workspace API failed: ${response.status}`);
  return response.json() as Promise<ProblemWorkspace>;
}

export async function saveWorkingDraft(
  problemKey: string,
  payload: { language: string; solution: string; reflection: string },
): Promise<{ ok: boolean; updated_at: string }> {
  const response = await fetch(`/api/v1/problems/${encodeURIComponent(problemKey)}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Draft save failed: ${response.status}`);
  return response.json() as Promise<{ ok: boolean; updated_at: string }>;
}

export async function createAttempt(
  problemKey: string,
  payload: { status: AttemptStatus; language: string; solution: string; reflection: string },
): Promise<{ ok: boolean; attempt: ProblemAttempt }> {
  const response = await fetch(`/api/v1/problems/${encodeURIComponent(problemKey)}/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(error?.detail || `Attempt save failed: ${response.status}`);
  }
  return response.json() as Promise<{ ok: boolean; attempt: ProblemAttempt }>;
}

export async function loadTodos(): Promise<TodoState[]> {
  const response = await fetch("/api/v1/todos", { cache: "no-store" });
  if (!response.ok) throw new Error(`Todo API failed: ${response.status}`);
  const payload = await response.json() as { items: TodoState[] };
  return payload.items;
}

export async function saveTodo(
  itemKey: string,
  payload: { source: string; title: string; completed: boolean },
): Promise<TodoState> {
  const response = await fetch(`/api/v1/todos/${encodeURIComponent(itemKey)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_key: itemKey, ...payload }),
  });
  if (!response.ok) throw new Error(`Todo save failed: ${response.status}`);
  const result = await response.json() as { item: TodoState };
  return result.item;
}
