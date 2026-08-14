export type KnowledgeDomainId =
  | "web"
  | "frontend"
  | "backend"
  | "data"
  | "systems"
  | "distributed"
  | "agentic";

export type KnowledgePriority = "core" | "tool" | "scale";
export type KnowledgeDepth = "MASTER" | "USE" | "RECOGNIZE";

export type KnowledgeNode = {
  id: string;
  domain: KnowledgeDomainId;
  label: string;
  kind: string;
  priority: KnowledgePriority;
  depth: KnowledgeDepth;
  does: string;
  matters: string;
  proof: string;
  x: number;
  y: number;
};

export type KnowledgeEdge = {
  from: string;
  to: string;
  label?: string;
};

export type KnowledgeFlowId = "all" | "web-request" | "data-write" | "agent-action" | "scale";

export const knowledgeDomains: Array<{
  id: KnowledgeDomainId;
  title: string;
  subtitle: string;
  y: number;
}> = [
  { id: "web", title: "WEB FOUNDATIONS", subtitle: "The runtime beneath every application", y: 55 },
  { id: "frontend", title: "FRONTEND", subtitle: "Turn state into an accessible interface", y: 205 },
  { id: "backend", title: "BACKEND", subtitle: "Enforce rules behind a stable contract", y: 355 },
  { id: "data", title: "DATA", subtitle: "Persist, retrieve, and protect truth", y: 505 },
  { id: "systems", title: "SYSTEMS", subtitle: "Run software predictably in production", y: 655 },
  { id: "distributed", title: "DISTRIBUTED", subtitle: "Coordinate across partial failure", y: 805 },
  { id: "agentic", title: "AGENTIC AI", subtitle: "Models that can observe, decide, and act", y: 955 },
];

type NodeSeed = Omit<KnowledgeNode, "domain" | "x" | "y">;

function lane(domain: KnowledgeDomainId, seeds: NodeSeed[]): KnowledgeNode[] {
  const domainY = knowledgeDomains.find((item) => item.id === domain)?.y ?? 0;
  return seeds.map((seed, index) => ({
    ...seed,
    domain,
    x: 260 + index * 150,
    y: domainY,
  }));
}

export const systemKnowledgeNodes: KnowledgeNode[] = [
  ...lane("web", [
    { id: "internet", label: "Internet & DNS", kind: "CONCEPT", priority: "core", depth: "USE", does: "Finds machines and moves packets between networks.", matters: "Every deployment and API call eventually depends on addressing, routing, and name resolution.", proof: "Trace a domain name from DNS lookup to the server IP and explain where TLS begins." },
    { id: "http", label: "HTTP & TLS", kind: "PROTOCOL", priority: "core", depth: "MASTER", does: "Defines request, response, caching, security, and connection semantics.", matters: "Frontend/backend boundaries are HTTP contracts; misunderstanding them creates security and state bugs.", proof: "Explain methods, status codes, headers, cookies, CORS, caching, and one TLS handshake." },
    { id: "browser", label: "Browser Runtime", kind: "RUNTIME", priority: "core", depth: "MASTER", does: "Parses documents, executes JavaScript, paints pixels, and enforces the web security model.", matters: "React still runs inside a browser; rendering, events, storage, and performance begin here.", proof: "Trace HTML parsing through DOM/CSSOM, layout, paint, and JavaScript event handling." },
    { id: "html", label: "HTML Semantics", kind: "LANGUAGE", priority: "core", depth: "MASTER", does: "Describes document meaning and interaction structure.", matters: "Semantic HTML gives accessibility, forms, SEO, and browser behavior before JavaScript.", proof: "Build a navigable form using native elements and test it using only a keyboard." },
    { id: "css", label: "CSS Layout", kind: "LANGUAGE", priority: "core", depth: "USE", does: "Controls layout, visual hierarchy, responsiveness, and interaction states.", matters: "A component is not finished if it breaks across content, viewport, or input modes.", proof: "Implement one responsive layout with grid/flex, intrinsic sizing, and focus states." },
    { id: "javascript", label: "JavaScript", kind: "LANGUAGE", priority: "core", depth: "MASTER", does: "Expresses behavior in browsers and Node runtimes.", matters: "Functions, closures, objects, promises, and the event loop are underneath every JS framework.", proof: "Implement a small browser app and explain closures, async execution, and mutation boundaries." },
    { id: "typescript", label: "TypeScript", kind: "LANGUAGE", priority: "core", depth: "MASTER", does: "Adds static contracts and refactoring feedback to JavaScript.", matters: "Types make module boundaries explicit and let large codebases change safely.", proof: "Model a state machine with unions and remove unsafe casts from an API boundary." },
  ]),
  ...lane("frontend", [
    { id: "build-tools", label: "Build Tools", kind: "TOOLING", priority: "tool", depth: "USE", does: "Resolve modules, transform source, bundle assets, and run development feedback loops.", matters: "Vite, npm, linting, and build output determine how source becomes deployable software.", proof: "Explain package scripts, module resolution, environment variables, and the production bundle." },
    { id: "react", label: "React", kind: "FRAMEWORK", priority: "tool", depth: "MASTER", does: "Maps application state to a component tree.", matters: "React is valuable for composition and state synchronization—not because every interface requires it.", proof: "Build the same interaction in DOM APIs and React, then explain the tradeoff." },
    { id: "components", label: "Components", kind: "PATTERN", priority: "core", depth: "MASTER", does: "Create reusable UI boundaries with explicit inputs and behavior.", matters: "Good component boundaries reduce coupling; bad ones merely move complexity into props.", proof: "Split a page by responsibility and explain why each state owner lives where it does." },
    { id: "state", label: "Client State", kind: "CAPABILITY", priority: "core", depth: "MASTER", does: "Represents transient user and interface state.", matters: "Most frontend bugs come from duplicated, stale, or incorrectly owned state.", proof: "Classify values as local, shared, URL, derived, or server state without duplication." },
    { id: "routing", label: "Routing & URL", kind: "CAPABILITY", priority: "core", depth: "USE", does: "Maps URLs to screens and makes navigation shareable and recoverable.", matters: "The URL is durable application state, not just a way to switch pages.", proof: "Build nested routes with loading, error, and not-found behavior." },
    { id: "server-state", label: "Server State", kind: "CAPABILITY", priority: "core", depth: "MASTER", does: "Fetches, caches, invalidates, and synchronizes remote data.", matters: "Remote data has latency and ownership; treating it like local state creates stale UI.", proof: "Implement loading, empty, success, optimistic update, and rollback states." },
    { id: "accessibility", label: "Accessibility", kind: "QUALITY", priority: "core", depth: "USE", does: "Makes software operable across keyboard, screen reader, vision, and motion needs.", matters: "Accessibility is part of correctness and usually improves structure for every user.", proof: "Complete a full workflow by keyboard and inspect its accessibility tree." },
    { id: "frontend-testing", label: "Frontend Testing", kind: "QUALITY", priority: "core", depth: "MASTER", does: "Proves user-observable behavior across components and browser flows.", matters: "Tests create confidence to change UI without freezing its implementation.", proof: "Test one critical workflow at unit, integration, and browser boundaries." },
  ]),
  ...lane("backend", [
    { id: "node-runtime", label: "Node.js Runtime", kind: "RUNTIME", priority: "tool", depth: "USE", does: "Runs JavaScript on the server with event-driven I/O.", matters: "Node lets one language span the stack, but CPU work and async errors need deliberate handling.", proof: "Build an HTTP handler and explain the event loop, streams, and process lifecycle." },
    { id: "python", label: "Python", kind: "LANGUAGE", priority: "tool", depth: "MASTER", does: "Expresses backend, automation, data, and AI workflows with a broad ecosystem.", matters: "Python rewards clear data modeling and simple service code but still needs type and test discipline.", proof: "Build a typed package with validation, tests, error handling, and a CLI or API." },
    { id: "api-contract", label: "API Contract", kind: "BOUNDARY", priority: "core", depth: "MASTER", does: "Defines inputs, outputs, errors, identity, and compatibility across services.", matters: "A stable contract lets frontend and backend evolve independently.", proof: "Write OpenAPI examples for success and every expected failure mode." },
    { id: "backend-framework", label: "FastAPI / Express", kind: "FRAMEWORK", priority: "tool", depth: "USE", does: "Maps transport requests into validated application calls.", matters: "Frameworks remove protocol boilerplate; they should not become the business architecture.", proof: "Keep route code thin by moving business rules into a testable service." },
    { id: "service-layer", label: "Service Layer", kind: "PATTERN", priority: "core", depth: "MASTER", does: "Coordinates business rules independently from HTTP and storage.", matters: "This boundary makes use cases testable and prevents routes or database models from owning everything.", proof: "Test one use case without starting a web server or real database." },
    { id: "auth", label: "Identity & Auth", kind: "CAPABILITY", priority: "core", depth: "MASTER", does: "Establishes identity and decides which operations and data are allowed.", matters: "Authentication without object-level authorization still leaks or corrupts data.", proof: "Implement session validation plus ownership tests for allowed and denied actions." },
    { id: "background-jobs", label: "Background Jobs", kind: "CAPABILITY", priority: "scale", depth: "USE", does: "Moves slow, retryable, or scheduled work outside request latency.", matters: "Reliable async work requires idempotency, retry policy, and visibility—not only a queue.", proof: "Design a retry-safe job with a dead-letter path and progress status." },
    { id: "backend-testing", label: "Backend Testing", kind: "QUALITY", priority: "core", depth: "MASTER", does: "Proves rules, integration boundaries, and failure behavior.", matters: "Fast service tests plus a few real integrations give more confidence than route mocks alone.", proof: "Cover domain rules, API validation, persistence, and one end-to-end request." },
  ]),
  ...lane("data", [
    { id: "sql", label: "SQL", kind: "LANGUAGE", priority: "core", depth: "MASTER", does: "Queries and transforms relational data declaratively.", matters: "ORMs do not remove joins, query plans, transactions, or cardinality.", proof: "Write a multi-table query and use EXPLAIN to improve an inefficient plan." },
    { id: "postgres", label: "PostgreSQL", kind: "DATABASE", priority: "tool", depth: "MASTER", does: "Stores relational truth with constraints, indexes, and transactions.", matters: "A strong default database solves more product needs than premature polyglot storage.", proof: "Design constraints and indexes from real access patterns, then test transaction behavior." },
    { id: "data-modeling", label: "Data Modeling", kind: "CAPABILITY", priority: "core", depth: "MASTER", does: "Turns domain facts and relationships into durable structures.", matters: "Bad models push complexity into every query and make invalid states representable.", proof: "Name entities, invariants, ownership, lifecycle, and expected query patterns." },
    { id: "migrations", label: "Migrations", kind: "OPERATIONS", priority: "core", depth: "USE", does: "Changes stored schemas and data safely over time.", matters: "Production data cannot be reset when application types change.", proof: "Design an expand/migrate/contract change that supports zero-downtime rollback." },
    { id: "redis", label: "Cache / Redis", kind: "DATABASE", priority: "scale", depth: "USE", does: "Keeps frequently used or ephemeral data close to compute.", matters: "Caching trades freshness and complexity for latency; invalidation is the real design work.", proof: "Define cache keys, TTL, invalidation, stampede protection, and failure fallback." },
    { id: "search", label: "Search & Vectors", kind: "DATABASE", priority: "scale", depth: "RECOGNIZE", does: "Retrieves data by text relevance, similarity, or specialized indexes.", matters: "Search is a separate access pattern; vector retrieval is useful only when semantic similarity helps.", proof: "Compare SQL text search, a search engine, and vector retrieval for one product query." },
    { id: "object-storage", label: "Object Storage", kind: "DATABASE", priority: "tool", depth: "USE", does: "Stores large immutable blobs such as files, images, and model artifacts.", matters: "Databases should store metadata and ownership, not necessarily every large byte stream.", proof: "Design signed upload/download flows with type, size, and authorization checks." },
  ]),
  ...lane("systems", [
    { id: "processes", label: "OS & Processes", kind: "FOUNDATION", priority: "core", depth: "USE", does: "Provides processes, memory, files, signals, threads, and resource isolation.", matters: "Production software is a process that starts, consumes resources, fails, and must shut down.", proof: "Inspect a running service's ports, files, memory, signals, and shutdown behavior." },
    { id: "networking", label: "Networking", kind: "FOUNDATION", priority: "core", depth: "USE", does: "Moves data through sockets, TCP, routing, and name resolution.", matters: "Latency, timeouts, connection limits, and packet loss appear as application behavior.", proof: "Trace one connection and distinguish DNS, TCP, TLS, HTTP, proxy, and application time." },
    { id: "load-balancing", label: "Load Balancing", kind: "PATTERN", priority: "scale", depth: "RECOGNIZE", does: "Distributes traffic across healthy service instances.", matters: "Horizontal scale requires health, statelessness, routing, and graceful removal.", proof: "Explain health checks, sticky sessions, connection draining, and failure behavior." },
    { id: "containers", label: "Containers", kind: "TOOLING", priority: "tool", depth: "USE", does: "Packages a process with a repeatable filesystem and runtime boundary.", matters: "Containers improve reproducibility but do not replace architecture or operations.", proof: "Build a minimal image with non-root execution, health checks, and deterministic dependencies." },
    { id: "cicd", label: "CI / CD", kind: "OPERATIONS", priority: "core", depth: "USE", does: "Automates verification and repeatable delivery.", matters: "A change is not truly shippable if release depends on undocumented manual steps.", proof: "Create a pipeline that tests, builds, deploys, verifies health, and can roll back." },
    { id: "observability", label: "Observability", kind: "OPERATIONS", priority: "core", depth: "MASTER", does: "Uses logs, metrics, traces, and profiles to explain runtime behavior.", matters: "You cannot debug systems you cannot observe; signals should connect user impact to causes.", proof: "Trace one failed request across logs and spans and define its SLI and alert." },
    { id: "security", label: "Security", kind: "QUALITY", priority: "core", depth: "MASTER", does: "Controls trust, data exposure, supply chain, and abuse paths.", matters: "Security is a property of every boundary, not a feature added at the end.", proof: "Threat-model inputs, identities, secrets, dependencies, storage, and network boundaries." },
  ]),
  ...lane("distributed", [
    { id: "replication", label: "Replication", kind: "PATTERN", priority: "scale", depth: "USE", does: "Maintains multiple copies for availability and read capacity.", matters: "Copies introduce lag, failover, conflict, and consistency choices.", proof: "Explain leader/follower writes, failover, quorum reads, and stale replicas." },
    { id: "partitioning", label: "Partitioning", kind: "PATTERN", priority: "scale", depth: "USE", does: "Splits data or work across machines.", matters: "Partition keys determine hotspots, query cost, rebalancing, and failure scope.", proof: "Choose a partition key and predict skew, cross-partition queries, and migration cost." },
    { id: "consistency", label: "Consistency", kind: "THEORY", priority: "scale", depth: "MASTER", does: "Defines what values clients may observe across concurrent operations.", matters: "Terms such as eventual and strong consistency must become explicit user-visible guarantees.", proof: "Classify histories as linearizable, causal, read-your-writes, or eventual." },
    { id: "consensus", label: "Consensus", kind: "ALGORITHM", priority: "scale", depth: "RECOGNIZE", does: "Lets nodes agree on one ordered history despite failures.", matters: "Leader election and replicated logs underpin reliable coordination systems.", proof: "Explain Raft terms, quorum, log safety, and why two leaders cannot both commit." },
    { id: "transactions", label: "Transactions", kind: "PATTERN", priority: "core", depth: "USE", does: "Groups changes under explicit atomicity and isolation guarantees.", matters: "Local and distributed workflows need different correctness and recovery strategies.", proof: "Compare a database transaction, outbox, two-phase commit, and saga." },
    { id: "queues", label: "Queues & Streams", kind: "INFRASTRUCTURE", priority: "scale", depth: "USE", does: "Buffers work and records ordered events between producers and consumers.", matters: "Delivery guarantees are built from acknowledgements, idempotency, ordering, and replay.", proof: "Design an at-least-once consumer that handles duplicates and backpressure." },
    { id: "fault-tolerance", label: "Fault Tolerance", kind: "QUALITY", priority: "scale", depth: "MASTER", does: "Keeps useful behavior during timeouts, overload, and component failure.", matters: "Retries can amplify failure; recovery must be designed and tested.", proof: "Run a failure drill covering timeout, retry budget, circuit breaking, and degraded mode." },
  ]),
  ...lane("agentic", [
    { id: "model-api", label: "Model API", kind: "CAPABILITY", priority: "tool", depth: "USE", does: "Turns context into generated text, structured decisions, or tool requests.", matters: "The model is probabilistic compute—not a database, permission system, or workflow engine.", proof: "Call a model with clear inputs, bounded output, timeout, retry, and error handling." },
    { id: "context-window", label: "Context Design", kind: "CAPABILITY", priority: "core", depth: "MASTER", does: "Selects instructions, state, examples, and retrieved evidence for each model call.", matters: "Agent quality is often a context architecture problem before it is a model problem.", proof: "Explain what belongs in system instructions, current state, tools, retrieval, and history." },
    { id: "structured-output", label: "Structured Output", kind: "BOUNDARY", priority: "core", depth: "MASTER", does: "Constrains model output to a validated machine-readable contract.", matters: "Software needs parseable decisions and explicit failure paths, not hopeful JSON parsing.", proof: "Validate one schema, reject invalid outputs, and handle partial or refused responses." },
    { id: "tool-use", label: "Tool Use", kind: "CAPABILITY", priority: "core", depth: "MASTER", does: "Lets the model request deterministic reads and actions from software.", matters: "Tools connect reasoning to real state; schemas and result design determine reliability.", proof: "Design a narrow tool with validation, idempotency, useful errors, and least privilege." },
    { id: "agent-loop", label: "Agent Loop", kind: "ARCHITECTURE", priority: "core", depth: "MASTER", does: "Repeats observe → decide → act → inspect until completion or a stop condition.", matters: "The loop, limits, state machine, and recovery logic are the actual agent runtime.", proof: "Implement bounded iterations, cancellation, tool results, failures, and a final outcome." },
    { id: "memory", label: "State & Memory", kind: "CAPABILITY", priority: "core", depth: "USE", does: "Stores durable user, task, and working state outside model context.", matters: "Conversation history is not reliable memory; state needs ownership, lifecycle, and retrieval.", proof: "Separate working state, conversation history, durable facts, and semantic retrieval." },
    { id: "mcp", label: "MCP", kind: "PROTOCOL", priority: "tool", depth: "USE", does: "Standardizes how AI clients discover and invoke tools and resources.", matters: "MCP reduces custom integration code but still needs trust, lifecycle, and permission design.", proof: "Expose one read-only tool and explain server startup, schemas, transport, and failure behavior." },
    { id: "permissions", label: "Permissions & HITL", kind: "SAFETY", priority: "core", depth: "MASTER", does: "Constrains authority and routes consequential decisions to a human.", matters: "A useful agent needs power; a safe agent needs explicit scope and confirmation boundaries.", proof: "Classify operations as read, reversible write, consequential, or forbidden and enforce each." },
    { id: "evals", label: "Evals & Tracing", kind: "QUALITY", priority: "core", depth: "MASTER", does: "Measures agent outcomes and records the path that produced them.", matters: "Prompt changes are software changes; without evals they create invisible regressions.", proof: "Create a task set, success rubric, tool trace, latency/cost view, and regression gate." },
    { id: "pi-agent", label: "Pi Agent", kind: "REFERENCE", priority: "tool", depth: "USE", does: "Combines model providers, sessions, skills, tools, files, and a bounded coding-agent loop.", matters: "Pi is a concrete reference for a small composable agent runtime and web workspace.", proof: "Trace a Pi message from UI/session through model selection, tool call, file change, and result." },
    { id: "ai-native-ux", label: "AI-Native UX", kind: "PRODUCT", priority: "core", depth: "MASTER", does: "Designs software around goals, previews, collaboration, and inspectable agent work.", matters: "AI-native does not mean adding chat; users need control, progress, provenance, and recovery.", proof: "Design one workflow where the agent proposes, previews, acts with scoped authority, and explains." },
  ]),
];

export const systemKnowledgeEdges: KnowledgeEdge[] = [
  { from: "internet", to: "http" },
  { from: "http", to: "browser" },
  { from: "browser", to: "html" },
  { from: "browser", to: "css" },
  { from: "browser", to: "javascript" },
  { from: "javascript", to: "typescript" },
  { from: "javascript", to: "build-tools" },
  { from: "typescript", to: "react" },
  { from: "build-tools", to: "react" },
  { from: "html", to: "components" },
  { from: "react", to: "components" },
  { from: "components", to: "state" },
  { from: "state", to: "routing" },
  { from: "state", to: "server-state" },
  { from: "components", to: "accessibility" },
  { from: "components", to: "frontend-testing" },
  { from: "http", to: "api-contract" },
  { from: "server-state", to: "api-contract" },
  { from: "node-runtime", to: "backend-framework" },
  { from: "python", to: "backend-framework" },
  { from: "api-contract", to: "backend-framework" },
  { from: "backend-framework", to: "service-layer" },
  { from: "auth", to: "service-layer" },
  { from: "service-layer", to: "background-jobs" },
  { from: "service-layer", to: "backend-testing" },
  { from: "service-layer", to: "data-modeling" },
  { from: "sql", to: "postgres" },
  { from: "data-modeling", to: "postgres" },
  { from: "postgres", to: "migrations" },
  { from: "postgres", to: "redis" },
  { from: "postgres", to: "search" },
  { from: "service-layer", to: "object-storage" },
  { from: "processes", to: "containers" },
  { from: "networking", to: "load-balancing" },
  { from: "load-balancing", to: "service-layer" },
  { from: "containers", to: "cicd" },
  { from: "cicd", to: "observability" },
  { from: "auth", to: "security" },
  { from: "api-contract", to: "security" },
  { from: "postgres", to: "replication" },
  { from: "data-modeling", to: "partitioning" },
  { from: "replication", to: "consistency" },
  { from: "partitioning", to: "consistency" },
  { from: "consistency", to: "consensus" },
  { from: "postgres", to: "transactions" },
  { from: "background-jobs", to: "queues" },
  { from: "queues", to: "fault-tolerance" },
  { from: "observability", to: "fault-tolerance" },
  { from: "model-api", to: "context-window" },
  { from: "context-window", to: "structured-output" },
  { from: "structured-output", to: "tool-use" },
  { from: "tool-use", to: "agent-loop" },
  { from: "memory", to: "agent-loop" },
  { from: "mcp", to: "tool-use" },
  { from: "permissions", to: "tool-use" },
  { from: "agent-loop", to: "evals" },
  { from: "tool-use", to: "pi-agent" },
  { from: "agent-loop", to: "pi-agent" },
  { from: "permissions", to: "pi-agent" },
  { from: "pi-agent", to: "ai-native-ux" },
  { from: "react", to: "ai-native-ux" },
  { from: "api-contract", to: "tool-use" },
  { from: "service-layer", to: "tool-use" },
  { from: "observability", to: "evals" },
];

export const knowledgeFlows: Array<{
  id: KnowledgeFlowId;
  label: string;
  description: string;
  nodeIds: string[];
}> = [
  { id: "all", label: "THE WHOLE SYSTEM", description: "Capabilities, tools, and scale concepts in one map.", nodeIds: [] },
  { id: "web-request", label: "WEB REQUEST", description: "A user interaction crossing UI, HTTP, business rules, and stored data.", nodeIds: ["internet", "http", "browser", "html", "css", "javascript", "typescript", "build-tools", "react", "components", "state", "server-state", "api-contract", "backend-framework", "service-layer", "data-modeling", "postgres", "frontend-testing", "backend-testing"] },
  { id: "data-write", label: "DATA WRITE", description: "How a validated change becomes durable, observable state.", nodeIds: ["react", "state", "server-state", "http", "api-contract", "auth", "backend-framework", "service-layer", "sql", "data-modeling", "postgres", "migrations", "transactions", "observability", "security"] },
  { id: "agent-action", label: "AGENT ACTION", description: "From an AI-native goal through model reasoning, scoped tools, and real software state.", nodeIds: ["ai-native-ux", "react", "api-contract", "model-api", "context-window", "structured-output", "tool-use", "agent-loop", "memory", "mcp", "permissions", "evals", "pi-agent", "service-layer", "observability"] },
  { id: "scale", label: "SCALE & RELIABILITY", description: "The concepts that become important when load and failure cross one process.", nodeIds: ["http", "networking", "load-balancing", "service-layer", "redis", "background-jobs", "containers", "cicd", "observability", "security", "replication", "partitioning", "consistency", "consensus", "transactions", "queues", "fault-tolerance"] },
];

export const knowledgeNodeById = new Map(systemKnowledgeNodes.map((node) => [node.id, node]));
