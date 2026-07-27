import type { ApplicationSignal, AttemptStatus, CandidateProfile, DashboardSnapshot, GmailSignalConnection, JobApplication, JobApplicationPayload, JobLead, LifeTask, LifeTaskPayload, NeetCodeSnapshot, ProblemAttempt, ProblemWorkspace, TodoState, TripPlan, TripPlanPayload } from "./types";

export type PiWebStatus = {
  online: boolean;
  url: string;
  latency_ms: number | null;
  detail: string;
};

export type AiTutorStatus = {
  configured: boolean;
  model: string | null;
  detail: string;
};

export type AiTutorMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiTutorContext = {
  node: {
    id: string;
    label: string;
    labelZh: string;
    does: string;
    doesZh: string;
    matters: string;
    mattersZh: string;
  };
  domain: { title: string; titleZh: string };
  adjacent: Array<{ label: string; labelZh: string }>;
  path: { title: string; titleZh: string } | null;
  mode: "explain" | "example" | "quiz" | "question";
};

async function apiError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null) as { detail?: string } | null;
  return new Error(payload?.detail || `${fallback}: ${response.status}`);
}

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

export async function loadPiWebStatus(): Promise<PiWebStatus> {
  const response = await fetch("/api/v1/pi-web/status", { cache: "no-store" });
  if (!response.ok) throw new Error(`Pi Web status API failed: ${response.status}`);
  return response.json() as Promise<PiWebStatus>;
}

export async function loadAiTutorStatus(): Promise<AiTutorStatus> {
  const response = await fetch("/api/v1/ai-tutor/status", { cache: "no-store" });
  if (!response.ok) throw await apiError(response, "AI Tutor status API failed");
  return response.json() as Promise<AiTutorStatus>;
}

export async function streamAiTutorMessage(
  messages: AiTutorMessage[],
  context: AiTutorContext,
  signal: AbortSignal,
  onChunk: (text: string) => void,
): Promise<void> {
  const response = await fetch("/api/v1/ai-tutor/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
    signal,
  });
  if (!response.ok) throw await apiError(response, "AI Tutor request failed");
  if (!response.body) throw new Error("AI Tutor stream is unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") continue;
      const payload = JSON.parse(data) as { text?: string; error?: string };
      if (payload.error) throw new Error(payload.error);
      if (payload.text) onChunk(payload.text);
    }
    if (done) break;
  }
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

export async function loadLifeTasks(): Promise<LifeTask[]> {
  const response = await fetch("/api/v1/life-tasks", { cache: "no-store" });
  if (!response.ok) throw new Error(`Life timeline API failed: ${response.status}`);
  const payload = await response.json() as { items: LifeTask[] };
  return payload.items;
}

export async function createLifeTask(payload: LifeTaskPayload): Promise<LifeTask> {
  const response = await fetch("/api/v1/life-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Life task save failed: ${response.status}`);
  const result = await response.json() as { task: LifeTask };
  return result.task;
}

export async function updateLifeTask(taskId: number, payload: Partial<LifeTaskPayload>): Promise<LifeTask> {
  const response = await fetch(`/api/v1/life-tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Life task update failed: ${response.status}`);
  const result = await response.json() as { task: LifeTask };
  return result.task;
}

export async function deleteLifeTask(taskId: number): Promise<void> {
  const response = await fetch(`/api/v1/life-tasks/${taskId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Life task delete failed: ${response.status}`);
}

export async function loadTripPlan(): Promise<TripPlan | null> {
  const response = await fetch("/api/v1/trip-plan", { cache: "no-store" });
  if (!response.ok) throw new Error(`Trip planner API failed: ${response.status}`);
  const payload = await response.json() as { plan: TripPlan | null };
  return payload.plan;
}

export async function saveTripPlan(payload: TripPlanPayload): Promise<TripPlan> {
  const response = await fetch("/api/v1/trip-plan", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Trip plan save failed: ${response.status}`);
  const result = await response.json() as { plan: TripPlan };
  return result.plan;
}

export async function deleteTripPlan(): Promise<void> {
  const response = await fetch("/api/v1/trip-plan", { method: "DELETE" });
  if (!response.ok) throw new Error(`Trip plan delete failed: ${response.status}`);
}

export async function loadApplications(): Promise<JobApplication[]> {
  const response = await fetch("/api/v1/applications", { cache: "no-store" });
  if (!response.ok) throw new Error(`Application CRM API failed: ${response.status}`);
  const payload = await response.json() as { items: JobApplication[] };
  return payload.items;
}

export async function loadJobLeads(): Promise<{ items: JobLead[]; refreshed_at: string; new_count: number }> {
  const response = await fetch("/api/v1/job-leads", { cache: "no-store" });
  if (!response.ok) throw new Error(`Daily job queue API failed: ${response.status}`);
  return response.json() as Promise<{ items: JobLead[]; refreshed_at: string; new_count: number }>;
}

export async function loadCandidateProfile(): Promise<CandidateProfile> {
  const response = await fetch("/api/v1/candidate-profile", { cache: "no-store" });
  if (!response.ok) throw new Error(`Candidate profile API failed: ${response.status}`);
  return response.json() as Promise<CandidateProfile>;
}

export async function setJobLeadDecision(leadKey: string, decision: "pending" | "skipped"): Promise<JobLead> {
  const response = await fetch(`/api/v1/job-leads/${encodeURIComponent(leadKey)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  if (!response.ok) throw new Error(`Job decision save failed: ${response.status}`);
  const result = await response.json() as { lead: JobLead };
  return result.lead;
}

export async function markJobLeadApplied(leadKey: string): Promise<{ lead: JobLead; application: JobApplication }> {
  const response = await fetch(`/api/v1/job-leads/${encodeURIComponent(leadKey)}/applied`, { method: "POST" });
  if (!response.ok) throw new Error(`Application capture failed: ${response.status}`);
  return response.json() as Promise<{ lead: JobLead; application: JobApplication }>;
}

export async function createApplication(payload: JobApplicationPayload): Promise<JobApplication> {
  const response = await fetch("/api/v1/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Application save failed: ${response.status}`);
  const result = await response.json() as { application: JobApplication };
  return result.application;
}

export async function updateApplication(
  applicationId: number,
  payload: Partial<JobApplicationPayload>,
): Promise<JobApplication> {
  const response = await fetch(`/api/v1/applications/${applicationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Application update failed: ${response.status}`);
  const result = await response.json() as { application: JobApplication };
  return result.application;
}

export async function deleteApplication(applicationId: number): Promise<void> {
  const response = await fetch(`/api/v1/applications/${applicationId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Application delete failed: ${response.status}`);
}

export async function loadApplicationSignals(): Promise<{ items: ApplicationSignal[]; connection: GmailSignalConnection }> {
  const response = await fetch("/api/v1/application-signals", { cache: "no-store" });
  if (!response.ok) throw new Error(`Inbox Copilot API failed: ${response.status}`);
  return response.json() as Promise<{ items: ApplicationSignal[]; connection: GmailSignalConnection }>;
}

export async function decideApplicationSignal(
  signalId: number,
  decision: "accepted" | "dismissed",
): Promise<{ signal: ApplicationSignal; application: JobApplication | null }> {
  const response = await fetch(`/api/v1/application-signals/${signalId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(error?.detail || `Inbox decision failed: ${response.status}`);
  }
  return response.json() as Promise<{ signal: ApplicationSignal; application: JobApplication | null }>;
}
