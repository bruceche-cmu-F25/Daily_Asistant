export type Problem = {
  key: string;
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  minutes: number;
  start_url: string;
  why?: string;
  done_when?: string;
  starter?: string;
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
export type DiscoverEvent = FeedItem & { source: string };
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
  discover_events?: DiscoverEvent[];
  job_groups: Record<string, DashboardLink[]>;
  quick_actions: QuickAction[];
  quiet_links: QuietLink[];
  target_copy: string;
  target_copy_cn: string;
};

export type JobLeadDecision = "pending" | "skipped" | "applied";

export type JobLead = {
  key: string;
  company: string;
  role: string;
  location: string;
  location_tier: "bay_area" | "remote" | "other_us" | "unknown";
  url: string;
  source: string;
  track: "new_grad" | "internship" | string;
  category: string;
  posted_at: string | null;
  age_days: number | null;
  first_seen_at: string;
  is_new_today: boolean;
  is_big_tech: boolean;
  match_score: number;
  match_reasons: string[];
  decision: JobLeadDecision;
  application_id: number | null;
};

export type CandidateProfile = {
  resume_version: string;
  graduation: string;
  location: string;
  target_roles: string[];
  resume_available: boolean;
};

export type TodoState = {
  item_key: string;
  source: string;
  title: string;
  completed: boolean;
  updated_at: string;
};

export type LifeCategory = "personal" | "home" | "health" | "finance" | "errands" | "social" | "admin" | "other";

export type LifeTask = {
  id: number;
  title: string;
  category: LifeCategory;
  due_at: string | null;
  notes: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LifeTaskPayload = {
  title: string;
  category: LifeCategory;
  due_at: string | null;
  notes: string;
  completed?: boolean;
};

export type TripStop = {
  id: string;
  title: string;
  location: string;
  visit_at: string | null;
  notes: string;
  position: number;
};

export type TripPlan = {
  id: number;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  stops: TripStop[];
  created_at: string;
  updated_at: string;
};

export type TripPlanPayload = Omit<TripPlan, "id" | "created_at" | "updated_at" | "stops"> & {
  stops: Array<Omit<TripStop, "id" | "position"> & { id: string | null; position?: number }>;
};

export type ApplicationStage =
  | "saved"
  | "applied"
  | "oa"
  | "recruiter_screen"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type ContactType = "none" | "alumni" | "recruiter" | "hiring_manager" | "employee" | "other";
export type ContactStatus = "not_contacted" | "planned" | "contacted" | "replied";

export type JobApplication = {
  id: number;
  company: string;
  role: string;
  job_url: string;
  stage: ApplicationStage;
  next_step: string;
  applied_at: string | null;
  follow_up_at: string | null;
  deadline_at: string | null;
  contact_name: string;
  contact_type: ContactType;
  contact_status: ContactStatus;
  resume_version: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type JobApplicationPayload = Omit<JobApplication, "id" | "created_at" | "updated_at">;

export type ApplicationSignal = {
  id: number;
  source_message_id: string;
  sender: string;
  subject: string;
  received_at: string;
  source_url: string;
  signal_type: "confirmation" | "oa" | "recruiter" | "interview" | "offer" | "rejection" | "status_update";
  company: string;
  role_hint: string;
  summary: string;
  suggested_stage: ApplicationStage;
  suggested_next_step: string;
  suggested_deadline_at: string | null;
  application_id: number | null;
  confidence: number;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
  updated_at: string;
};

export type GmailSignalConnection = {
  adapter: string;
  automatic: boolean;
  last_import_at: string | null;
  status: string;
  detail: string;
};

export type DailyAgentDraft = {
  id: number;
  message_id: number;
  kind: "life_task";
  payload: LifeTaskPayload;
  summary: string;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
};

export type DailyAgentSession = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type DailyAgentTraceRound = {
  round: number;
  status: "completed" | "failed";
  started_at: string;
  completed_at: string;
  duration_ms: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
  tools: string[];
};

export type DailyAgentTrace = {
  status: "completed" | "failed";
  model: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  model_calls: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
  tool_calls: number;
  rounds: DailyAgentTraceRound[];
  error_type?: string;
};

export type DailyAgentMessage = {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  tool_calls: Array<{ name: string; arguments: Record<string, unknown>; result: string }>;
  trace?: DailyAgentTrace | null;
  created_at: string;
  drafts: DailyAgentDraft[];
};
