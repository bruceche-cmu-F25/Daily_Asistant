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
};

export type NeetCodeSnapshot = {
  problems: Problem[];
  progress: Record<string, LegacyProgress>;
  topics: Array<{ name: string; total: number; completed: number }>;
  summary: { completed: number; total: number; stuck: number };
};
