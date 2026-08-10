export type ModuleId = "life" | "learn" | "roadmap" | "python" | "agent" | "neetcode" | "applications" | "google-career" | "discover";

export type ModuleDefinition = {
  id: ModuleId;
  path: string;
  navLabel: string;
  title: string;
  description: string;
  capabilities: string[];
};

export const moduleRegistry: ModuleDefinition[] = [
  {
    id: "life",
    path: "/life",
    navLabel: "LIFE",
    title: "Life Queue",
    description: "Personal tasks, trip planner, itinerary, and map.",
    capabilities: ["tasks", "trip-planning"],
  },
  {
    id: "learn",
    path: "/learn",
    navLabel: "LEARN",
    title: "Learning Hub",
    description: "Courses, daily learning, projects, and progress.",
    capabilities: ["progress", "courses", "projects", "customizable-layout"],
  },
  {
    id: "roadmap",
    path: "/roadmap",
    navLabel: "ROADMAP",
    title: "System Roadmap",
    description: "Interactive software knowledge map and guided paths.",
    capabilities: ["knowledge-map", "guided-paths", "progress"],
  },
  {
    id: "python",
    path: "/python",
    navLabel: "PYTHON",
    title: "Python Reference",
    description: "Searchable Python knowledge and interview patterns.",
    capabilities: ["knowledge-search", "reference"],
  },
  {
    id: "agent",
    path: "/agent",
    navLabel: "AGENT",
    title: "Pi Agent",
    description: "Local Pi Web workspace, sessions, tools, skills, and files.",
    capabilities: ["agent-workspace", "sessions", "tools", "skills"],
  },
  {
    id: "neetcode",
    path: "/neetcode",
    navLabel: "NEETCODE",
    title: "Coding Practice",
    description: "Problem roadmap, solution workspace, and attempt history.",
    capabilities: ["problem-practice", "progress", "attempt-history"],
  },
  {
    id: "applications",
    path: "/applications",
    navLabel: "APPLY",
    title: "Job Search",
    description: "Job discovery, applications, follow-ups, and signals.",
    capabilities: ["job-feed", "application-crm", "follow-ups"],
  },
  {
    id: "google-career",
    path: "/google-career",
    navLabel: "GOOGLE",
    title: "Google Career",
    description: "Hiring roadmap, interview prep, and official resources.",
    capabilities: ["career-roadmap", "interview-prep", "official-resources"],
  },
  {
    id: "discover",
    path: "/discover",
    navLabel: "EVENTS",
    title: "Event Discovery",
    description: "Local events, sources, and relevant news.",
    capabilities: ["event-feed", "news"],
  },
];

export const moduleById = Object.fromEntries(moduleRegistry.map((module) => [module.id, module])) as Record<ModuleId, ModuleDefinition>;
