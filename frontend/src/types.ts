export type Problem = {
  key: string;
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  minutes: number;
  start_url: string;
};

export type LegacyProgress = {
  completed: boolean;
  title: string;
  topic: string;
  url: string;
  stuck_count: number;
  solution: string;
  reflection: string;
  completed_at: string | null;
  updated_at: string;
  attempt_count?: number;
};

export type AttemptStatus = "draft" | "stuck" | "solved";

export type ProblemAttempt = {
  id: number;
  problem_key: string;
  status: AttemptStatus;
  language: string;
  solution: string;
  reflection: string;
  source: string;
  created_at: string;
  updated_at: string;
};

export type ProblemDraft = {
  problem_key: string;
  language: string;
  solution: string;
  reflection: string;
  updated_at: string;
};

export type ProblemWorkspace = {
  draft: ProblemDraft | null;
  attempts: ProblemAttempt[];
};

export type NeetCodeSnapshot = {
  problems: Problem[];
  progress: Record<string, LegacyProgress>;
  attempts: ProblemAttempt[];
  topics: Array<{ name: string; total: number; completed: number }>;
  summary: { completed: number; total: number; stuck: number; attempts?: number };
};
