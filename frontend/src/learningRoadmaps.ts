export type LearningRoadmapId =
  | "javascript"
  | "react"
  | "full-stack"
  | "system-design"
  | "distributed-systems";

export type LearningRoadmapNode = {
  id: string;
  step: string;
  title: string;
  summary: string;
  topics: string[];
  deliverable: string;
  position: [number, number];
};

export type LearningRoadmapEdge = {
  from: string;
  to: string;
};

export type LearningRoadmap = {
  id: LearningRoadmapId;
  mark: string;
  title: string;
  subtitle: string;
  outcome: string;
  nodes: LearningRoadmapNode[];
  edges: LearningRoadmapEdge[];
  resources: Array<{ label: string; url: string }>;
};

const positions: Array<[number, number]> = [
  [460, 20],
  [250, 135],
  [670, 135],
  [40, 265],
  [460, 265],
  [880, 265],
  [250, 395],
  [670, 395],
  [460, 520],
];

const edges: LearningRoadmapEdge[] = [
  { from: "01", to: "02" },
  { from: "01", to: "03" },
  { from: "02", to: "04" },
  { from: "02", to: "05" },
  { from: "03", to: "05" },
  { from: "03", to: "06" },
  { from: "04", to: "07" },
  { from: "05", to: "07" },
  { from: "05", to: "08" },
  { from: "06", to: "08" },
  { from: "07", to: "09" },
  { from: "08", to: "09" },
];

function node(
  index: number,
  title: string,
  summary: string,
  topics: string[],
  deliverable: string,
): LearningRoadmapNode {
  return {
    id: String(index + 1).padStart(2, "0"),
    step: `PHASE ${String(index + 1).padStart(2, "0")}`,
    title,
    summary,
    topics,
    deliverable,
    position: positions[index],
  };
}

export const learningRoadmaps: LearningRoadmap[] = [
  {
    id: "javascript",
    mark: "JS",
    title: "JavaScript",
    subtitle: "Language → browser → production",
    outcome: "Build and test a browser application without relying on a framework.",
    resources: [
      { label: "MDN JAVASCRIPT GUIDE", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
      { label: "JAVASCRIPT.INFO", url: "https://javascript.info/" },
      { label: "FCC JAVASCRIPT V9", url: "https://www.freecodecamp.org/learn/javascript-v9/" },
    ],
    edges,
    nodes: [
      node(0, "Language Fundamentals", "Understand how JavaScript evaluates values and statements.", ["values & types", "variables", "operators", "control flow"], "Complete 20 small syntax challenges without copying answers."),
      node(1, "Functions & Scope", "Use functions as the main unit of behavior and composition.", ["closures", "scope chain", "callbacks", "this"], "Explain a closure and implement debounce from memory."),
      node(2, "Collections & Objects", "Model data with arrays, objects, maps, and sets.", ["array methods", "destructuring", "prototypes", "Map & Set"], "Build a data transformation pipeline with no mutation."),
      node(3, "DOM & Browser APIs", "Connect program state to a real browser interface.", ["DOM tree", "events", "forms", "storage"], "Ship an accessible interactive page using only browser APIs."),
      node(4, "Async JavaScript", "Control work that completes later without losing error context.", ["event loop", "promises", "async/await", "fetch"], "Build a cancellable API client with loading and error states."),
      node(5, "Modules & Tooling", "Organize code into maintainable modules and automate the feedback loop.", ["ES modules", "npm", "Vite", "lint & format"], "Turn a multi-file app into a reproducible npm project."),
      node(6, "Testing & Debugging", "Prove behavior and diagnose failures systematically.", ["unit tests", "DOM tests", "DevTools", "error boundaries"], "Add tests for success, empty, loading, and failure paths."),
      node(7, "Performance & Security", "Recognize browser bottlenecks and common client-side risks.", ["profiling", "memory", "XSS", "input validation"], "Profile one slow interaction and document the fix."),
      node(8, "Production JavaScript App", "Combine the language, browser, async, and quality tracks.", ["architecture", "accessibility", "deployment", "README"], "Ship a deployed application you can explain end to end."),
    ],
  },
  {
    id: "react",
    mark: "RE",
    title: "React",
    subtitle: "Components → state → architecture",
    outcome: "Ship a tested React + TypeScript application with deliberate state boundaries.",
    resources: [
      { label: "REACT LEARN", url: "https://react.dev/learn" },
      { label: "REACT TYPESCRIPT CHEATSHEET", url: "https://react-typescript-cheatsheet.netlify.app/" },
      { label: "TESTING LIBRARY", url: "https://testing-library.com/docs/react-testing-library/intro/" },
    ],
    edges,
    nodes: [
      node(0, "React Mental Model", "Treat UI as a deterministic function of state.", ["JSX", "component tree", "rendering", "purity"], "Rebuild a static page as a clean component hierarchy."),
      node(1, "Props & State", "Place state at the lowest owner that needs to coordinate it.", ["props", "useState", "derived state", "lifting state"], "Implement a multi-component interaction with one source of truth."),
      node(2, "TypeScript Components", "Make component contracts explicit and refactor-safe.", ["props types", "unions", "generics", "events"], "Remove unsafe any values from a small component library."),
      node(3, "Effects & Browser Sync", "Use effects only to synchronize with external systems.", ["useEffect", "cleanup", "refs", "custom hooks"], "Write a custom hook with correct setup and cleanup."),
      node(4, "Forms & Server Data", "Model user input and remote data as explicit states.", ["controlled forms", "validation", "fetching", "optimistic UI"], "Build a form that handles validation and server failure."),
      node(5, "Routing & Composition", "Create navigable applications without oversized components.", ["React Router", "layouts", "composition", "lazy routes"], "Ship three routes with shared layout and error handling."),
      node(6, "State Architecture", "Separate local UI state, URL state, and server state.", ["context", "reducers", "URL state", "cache boundaries"], "Document where every major state value should live."),
      node(7, "Testing & Performance", "Test user-observable behavior and measure before optimizing.", ["RTL", "integration tests", "memoization", "Profiler"], "Cover a critical user flow and profile its render path."),
      node(8, "Production React App", "Integrate architecture, accessibility, quality, and delivery.", ["design system", "a11y", "CI", "deployment"], "Ship a React + TypeScript product with CI and a technical walkthrough."),
    ],
  },
  {
    id: "full-stack",
    mark: "FS",
    title: "Full Stack Development",
    subtitle: "UI ↔ API ↔ data ↔ operations",
    outcome: "Own one production feature from database schema to deployed interface.",
    resources: [
      { label: "FULL STACK OPEN", url: "https://fullstackopen.com/en/" },
      { label: "THE ODIN PROJECT", url: "https://www.theodinproject.com/paths/full-stack-javascript" },
      { label: "OWASP TOP 10", url: "https://owasp.org/www-project-top-ten/" },
    ],
    edges,
    nodes: [
      node(0, "Web Foundations", "Understand the protocol and runtime boundaries behind a web page.", ["HTTP", "DNS", "cookies", "browser/server"], "Trace one request from URL entry to rendered response."),
      node(1, "Frontend Application", "Build an accessible client with clear state and component boundaries.", ["React", "TypeScript", "forms", "client routing"], "Ship the frontend for one complete product workflow."),
      node(2, "API Design", "Express business capabilities through stable HTTP contracts.", ["REST", "validation", "errors", "OpenAPI"], "Design and document a versioned CRUD API."),
      node(3, "Backend Services", "Keep transport, business rules, and persistence separate.", ["Node or FastAPI", "service layer", "dependencies", "logging"], "Implement a tested service without business logic in routes."),
      node(4, "Data & Persistence", "Choose schemas, constraints, and transactions intentionally.", ["PostgreSQL", "SQL", "migrations", "indexes"], "Create a migration and explain every index and constraint."),
      node(5, "Identity & Security", "Protect data and operations across browser and server boundaries.", ["sessions", "OAuth", "authorization", "OWASP"], "Add login plus object-level authorization tests."),
      node(6, "End-to-End Quality", "Prove the feature across units, integrations, and browser behavior.", ["unit tests", "integration tests", "E2E", "test data"], "Automate the primary user journey and two failure paths."),
      node(7, "Delivery & Operations", "Make releases repeatable, observable, and recoverable.", ["containers", "CI/CD", "secrets", "monitoring"], "Deploy from CI with health checks and structured logs."),
      node(8, "Production Vertical Slice", "Combine frontend, API, database, security, and operations.", ["architecture", "performance", "runbook", "demo"], "Ship one end-to-end feature with a diagram and operations runbook."),
    ],
  },
  {
    id: "system-design",
    mark: "SD",
    title: "System Design",
    subtitle: "Requirements → tradeoffs → architecture",
    outcome: "Lead a 45-minute design discussion with numbers, tradeoffs, and failure modes.",
    resources: [
      { label: "SYSTEM DESIGN PRIMER", url: "https://github.com/donnemartin/system-design-primer" },
      { label: "DDIA RESOURCES", url: "https://dataintensive.net/" },
      { label: "GOOGLE SRE BOOK", url: "https://sre.google/sre-book/table-of-contents/" },
    ],
    edges,
    nodes: [
      node(0, "Requirements & Estimation", "Turn an open prompt into explicit scale and quality targets.", ["functional scope", "SLOs", "QPS", "storage math"], "Write assumptions and back-of-envelope estimates in five minutes."),
      node(1, "API & Data Model", "Define the external contract and the data that supports it.", ["API shape", "entities", "access patterns", "schema"], "Draft APIs and a schema for a URL shortener or feed."),
      node(2, "Traffic & Compute", "Map requests through stateless services and routing layers.", ["load balancing", "horizontal scale", "CDN", "service boundaries"], "Diagram read and write paths with capacity estimates."),
      node(3, "Storage Choices", "Select relational, document, key-value, or search storage by access pattern.", ["indexes", "replication", "sharding", "search"], "Defend one primary store and one rejected alternative."),
      node(4, "Caching & Delivery", "Reduce latency and load while managing stale data.", ["cache-aside", "invalidation", "TTL", "CDN"], "Define cache keys, invalidation rules, and failure behavior."),
      node(5, "Async Workflows", "Decouple slow or bursty work with durable messaging.", ["queues", "pub/sub", "idempotency", "backpressure"], "Design an at-least-once consumer that is safe to retry."),
      node(6, "Reliability & Security", "Design for dependency failure, abuse, and recovery.", ["timeouts", "retries", "rate limits", "disaster recovery"], "Run a failure-mode review and assign mitigations."),
      node(7, "Observability & Evolution", "Know whether the system works and how it can change safely.", ["metrics", "logs", "traces", "migration strategy"], "Define SLIs, alerts, dashboards, and a zero-downtime migration."),
      node(8, "Timed Design Drills", "Practice communicating a complete design under interview constraints.", ["clarify", "estimate", "diagram", "tradeoffs"], "Complete five recorded 45-minute system design walkthroughs."),
    ],
  },
  {
    id: "distributed-systems",
    mark: "DS",
    title: "Distributed Systems",
    subtitle: "Time → consistency → consensus",
    outcome: "Reason about partial failure and build a small replicated system.",
    resources: [
      { label: "MIT 6.5840", url: "https://pdos.csail.mit.edu/6.824/" },
      { label: "DDIA", url: "https://dataintensive.net/" },
      { label: "DISTRIBUTED SYSTEMS LECTURES", url: "https://www.distributedsystemscourse.com/" },
    ],
    edges,
    nodes: [
      node(0, "Networks, Time & Failure", "Accept that messages delay, clocks disagree, and nodes fail independently.", ["partial failure", "latency", "logical clocks", "failure detectors"], "Simulate delayed, duplicated, and dropped messages."),
      node(1, "Replication", "Keep multiple copies useful without assuming perfect synchronization.", ["leader/follower", "quorums", "log replication", "failover"], "Implement a replicated in-memory log with failover."),
      node(2, "Partitioning", "Distribute data and work while controlling hotspots and movement.", ["consistent hashing", "range sharding", "rebalancing", "hot keys"], "Partition a keyspace and visualize rebalancing."),
      node(3, "Consistency Models", "State precisely what clients may observe after reads and writes.", ["linearizability", "causal consistency", "eventual consistency", "CAP"], "Write histories and classify which consistency model they satisfy."),
      node(4, "Consensus & Leader Election", "Reach one durable decision despite crashes and message delay.", ["Raft", "terms", "quorum", "split brain"], "Implement Raft leader election and explain its safety argument."),
      node(5, "Distributed Transactions", "Coordinate multi-key work and understand the cost of atomicity.", ["2PC", "sagas", "idempotency", "outbox"], "Model one workflow as both 2PC and a saga, then compare."),
      node(6, "Fault Tolerance", "Make retry, recovery, and degraded operation explicit.", ["timeouts", "retry storms", "circuit breakers", "recovery"], "Run fault injection and document the observed recovery timeline."),
      node(7, "Streams & Coordination", "Process ordered event histories and coordinate shared work.", ["consumer groups", "offsets", "exactly-once claims", "leases"], "Build a replayable event processor with safe checkpoints."),
      node(8, "Replicated Key-Value Store", "Integrate consensus, persistence, clients, and operations.", ["Raft log", "snapshots", "client retries", "observability"], "Ship a three-node KV store and demo recovery from node failure."),
    ],
  },
];

export const learningRoadmapById = new Map(
  learningRoadmaps.map((roadmap) => [roadmap.id, roadmap]),
);
