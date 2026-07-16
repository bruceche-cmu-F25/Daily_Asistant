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

export type DashboardLink = { title: string; url: string };
export type DigestItem = { text: string; key?: string; checked?: boolean; is_todo: boolean };
export type DashboardEvent = {
  key: string;
  id: string;
  title: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  location: string;
  description: string;
  calendar: string;
  url: string;
  all_day: boolean;
};
export type FeedItem = { title: string; link: string; snippet: string };
export type QuickAction = { title: string; subtitle: string; url: string; kind: string };
export type QuietLink = { title: string; url: string; kind: string; label: string };
export type DashboardSnapshot = {
  date: string;
  generated_at: string;
  weekly_plan: { title: string; url: string };
  metrics: { calendar_events: number; notion_tasks: number; fresh_jobs: number };
  source_status: Array<{ name: string; ok: boolean; detail: string }>;
  stale_sources: string[];
  events: DashboardEvent[];
  links: { study: DashboardLink[]; jobs: DashboardLink[] };
  weekly: DigestItem[];
  notion: DigestItem[];
  jobs: FeedItem[];
  news: FeedItem[];
  job_groups: Record<string, DashboardLink[]>;
  quick_actions: QuickAction[];
  quiet_links: QuietLink[];
  target_copy: string;
  target_copy_cn: string;
};

export type TodoState = {
  item_key: string;
  source: string;
  title: string;
  completed: boolean;
  updated_at: string;
};
