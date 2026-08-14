import {
  knowledgeNodeById,
  type KnowledgeNode,
} from "./systemKnowledgeGraph";
import { knowledgeNodeZh } from "./systemKnowledgeGraphZh";

export type KnowledgeMapDomainId =
  | "foundations"
  | "languages"
  | "frontend"
  | "backend"
  | "data"
  | "operations"
  | "system-design"
  | "agentic";

export type KnowledgeMapRelation = "flow" | "requires" | "implements";
export type KnowledgeMapLevel = 2 | 3;
export type KnowledgeProgressState = "new" | "learning" | "understood";

export type KnowledgeMapDomain = {
  id: KnowledgeMapDomainId;
  title: string;
  titleZh: string;
  summary: string;
  summaryZh: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  nodeIds: string[];
};

export type KnowledgeMapNode = Omit<KnowledgeNode, "domain" | "x" | "y"> & {
  mapDomain: KnowledgeMapDomainId;
  mapX: number;
  mapY: number;
  level: KnowledgeMapLevel;
  aliases: string[];
  plainZh: string;
  zh: {
    label: string;
    does: string;
    matters: string;
    proof: string;
  };
};

export type KnowledgeMapEdge = {
  from: string;
  to: string;
  relation: KnowledgeMapRelation;
  overview: boolean;
};

export type KnowledgePathId =
  | "all"
  | "javascript-typescript"
  | "react-frontend"
  | "python-backend"
  | "full-stack"
  | "system-design"
  | "distributed-systems"
  | "agentic-ai";

export type KnowledgePath = {
  id: KnowledgePathId;
  title: string;
  titleZh: string;
  color: string;
  nodeIds: string[];
};

export const KNOWLEDGE_CANVAS_WIDTH = 2540;
export const KNOWLEDGE_CANVAS_HEIGHT = 1380;
export const KNOWLEDGE_NODE_WIDTH = 176;
export const KNOWLEDGE_NODE_HEIGHT = 76;

const domainSeeds: KnowledgeMapDomain[] = [
  {
    id: "system-design",
    title: "SYSTEM DESIGN & DISTRIBUTED",
    titleZh: "系统设计与分布式系统",
    summary: "Requirements, scale, coordination, and partial failure.",
    summaryZh: "需求、规模、协调与部分故障。",
    x: 40,
    y: 40,
    width: 1500,
    height: 400,
    columns: 5,
    nodeIds: ["replication", "partitioning", "consistency", "consensus", "queues"],
  },
  {
    id: "agentic",
    title: "AGENTIC AI",
    titleZh: "智能体软件",
    summary: "Models surrounded by deterministic state, tools, safety, and evaluation.",
    summaryZh: "由确定性状态、工具、安全边界和评估包围的模型。",
    x: 1580,
    y: 40,
    width: 920,
    height: 400,
    columns: 4,
    nodeIds: ["model-api", "context-window", "structured-output", "tool-use", "permissions", "memory", "evals", "agent-loop", "ai-native-ux", "mcp", "pi-agent"],
  },
  {
    id: "foundations",
    title: "COMPUTER & WEB FOUNDATIONS",
    titleZh: "计算机与 Web 基础",
    summary: "The runtime, protocols, and network beneath every application.",
    summaryZh: "所有应用之下的运行时、协议与网络。",
    x: 40,
    y: 500,
    width: 590,
    height: 520,
    columns: 3,
    nodeIds: ["internet", "http", "browser", "processes", "networking"],
  },
  {
    id: "frontend",
    title: "FRONTEND",
    titleZh: "前端",
    summary: "Turn state into an accessible, navigable experience.",
    summaryZh: "把状态变成可访问、可导航的体验。",
    x: 660,
    y: 500,
    width: 590,
    height: 520,
    columns: 3,
    nodeIds: ["components", "state", "routing", "accessibility", "frontend-testing", "server-state", "build-tools", "react"],
  },
  {
    id: "backend",
    title: "BACKEND & API",
    titleZh: "后端与 API",
    summary: "Expose stable contracts and enforce business rules.",
    summaryZh: "提供稳定契约并执行业务规则。",
    x: 1280,
    y: 500,
    width: 590,
    height: 520,
    columns: 3,
    nodeIds: ["api-contract", "service-layer", "auth", "background-jobs", "backend-testing", "node-runtime", "backend-framework"],
  },
  {
    id: "data",
    title: "DATA",
    titleZh: "数据",
    summary: "Model, persist, retrieve, and protect durable truth.",
    summaryZh: "建模、持久化、检索并保护长期事实。",
    x: 1900,
    y: 500,
    width: 600,
    height: 520,
    columns: 3,
    nodeIds: ["data-modeling", "migrations", "transactions", "postgres", "redis", "search", "object-storage"],
  },
  {
    id: "operations",
    title: "DELIVERY & OPERATIONS",
    titleZh: "交付与运维",
    summary: "Ship, observe, secure, and recover production software.",
    summaryZh: "交付、观测、保护并恢复生产软件。",
    x: 1280,
    y: 1060,
    width: 1220,
    height: 280,
    columns: 6,
    nodeIds: ["cicd", "observability", "fault-tolerance", "security", "load-balancing", "containers"],
  },
  {
    id: "languages",
    title: "LANGUAGES",
    titleZh: "编程语言",
    summary: "The notation used to express documents, behavior, types, services, and data.",
    summaryZh: "表达文档、行为、类型、服务与数据的语言。",
    x: 40,
    y: 1060,
    width: 1210,
    height: 280,
    columns: 6,
    nodeIds: ["html", "css", "javascript", "typescript", "python", "sql"],
  },
];

const levelTwoIds = new Set([
  "internet", "http", "browser", "processes", "networking",
  "html", "css", "javascript", "typescript", "python", "sql",
  "components", "state", "routing", "server-state", "accessibility", "frontend-testing",
  "api-contract", "service-layer", "auth", "background-jobs", "backend-testing",
  "data-modeling", "migrations", "transactions",
  "cicd", "observability", "security", "fault-tolerance",
  "replication", "partitioning", "consistency",
  "model-api", "context-window", "structured-output", "tool-use", "agent-loop", "memory", "permissions", "evals", "ai-native-ux",
]);

const aliases: Record<string, string[]> = {
  internet: ["dns", "domain", "域名", "网络"],
  http: ["https", "tls", "request", "response", "请求", "响应"],
  browser: ["dom", "cssom", "render", "浏览器"],
  processes: ["os", "process", "memory", "进程", "操作系统"],
  networking: ["tcp", "socket", "latency", "网络", "延迟"],
  html: ["semantic html", "markup", "语义"],
  css: ["layout", "grid", "flexbox", "样式", "布局"],
  javascript: ["js", "event loop", "promise", "javascript"],
  typescript: ["ts", "types", "类型"],
  python: ["py", "python"],
  sql: ["query", "join", "查询"],
  react: ["jsx", "hooks", "react"],
  components: ["component", "ui composition", "组件"],
  state: ["state management", "状态管理"],
  routing: ["url", "router", "路由"],
  "server-state": ["cache", "fetch", "remote data", "服务端状态"],
  accessibility: ["a11y", "aria", "无障碍"],
  "frontend-testing": ["rtl", "vitest", "ui test", "前端测试"],
  "build-tools": ["vite", "npm", "bundler", "构建工具"],
  "node-runtime": ["node", "nodejs", "node.js"],
  "api-contract": ["rest", "openapi", "schema", "接口契约"],
  "backend-framework": ["fastapi", "express", "web framework", "后端框架"],
  "service-layer": ["business logic", "use case", "业务逻辑"],
  auth: ["authentication", "authorization", "oauth", "身份", "授权"],
  "background-jobs": ["worker", "celery", "async job", "后台任务"],
  "backend-testing": ["pytest", "integration test", "后端测试"],
  postgres: ["postgresql", "database", "数据库"],
  "data-modeling": ["schema", "entity", "数据建模"],
  migrations: ["alembic", "schema change", "迁移"],
  redis: ["cache", "redis", "缓存"],
  search: ["vector", "embedding", "全文搜索", "向量"],
  "object-storage": ["s3", "blob", "对象存储"],
  transactions: ["acid", "outbox", "saga", "事务"],
  "load-balancing": ["load balancer", "nginx", "负载均衡"],
  containers: ["docker", "container", "容器"],
  cicd: ["ci", "cd", "github actions", "持续集成"],
  observability: ["logs", "metrics", "traces", "otel", "可观测性"],
  security: ["owasp", "threat model", "安全"],
  replication: ["replica", "leader follower", "复制"],
  partitioning: ["sharding", "consistent hashing", "分区", "分片"],
  consistency: ["cap", "linearizable", "eventual", "一致性"],
  consensus: ["raft", "leader election", "共识"],
  queues: ["kafka", "stream", "message queue", "队列"],
  "fault-tolerance": ["retry", "circuit breaker", "容错"],
  "model-api": ["llm", "model", "模型 api"],
  "context-window": ["prompt", "retrieval", "上下文"],
  "structured-output": ["json schema", "structured", "结构化输出"],
  "tool-use": ["function calling", "tools", "工具调用"],
  "agent-loop": ["agent runtime", "observe decide act", "智能体循环"],
  memory: ["session", "long term memory", "记忆"],
  mcp: ["model context protocol", "mcp"],
  permissions: ["hitl", "approval", "权限", "人工确认"],
  evals: ["evaluation", "trace", "评估"],
  "pi-agent": ["pi", "pi web", "coding agent"],
  "ai-native-ux": ["ai native", "copilot", "智能体体验"],
};

const plainZh: Record<string, string> = {
  internet: "让电脑先找到目标服务器，再把数据送过去。",
  http: "规定浏览器和服务器怎样提问、回答并加密通信。",
  browser: "把 HTML、CSS 和 JavaScript 变成可操作的页面。",
  processes: "让程序在操作系统里运行，并管理它占用的资源。",
  networking: "让两台机器建立连接，并把数据可靠地传过去。",
  html: "告诉浏览器页面里的内容是什么、结构是什么。",
  css: "决定页面怎样排列、长什么样，以及不同屏幕下怎样变化。",
  javascript: "让页面和服务器程序能够计算、响应事件和处理数据。",
  typescript: "在运行前检查 JavaScript 数据和函数是否按约定使用。",
  python: "一种容易读写，常用于后端、自动化、数据和 AI 的语言。",
  sql: "用接近问题描述的语句查询和修改关系型数据。",
  components: "把界面拆成职责清楚、可以组合的小块。",
  state: "记录页面此刻需要记住的值，例如选中了什么。",
  routing: "根据 URL 决定显示哪个页面，也让页面可以分享和返回。",
  accessibility: "让键盘、读屏器和不同能力的用户都能完成操作。",
  "frontend-testing": "模拟用户操作，确认页面真正表现正确。",
  "server-state": "管理从服务器读取的数据，以及加载、缓存和更新状态。",
  "build-tools": "把开发源码转换、检查并打包成浏览器能运行的文件。",
  react: "根据当前状态自动生成并更新组件界面。",
  "api-contract": "明确前端能传什么、后端会返回什么，以及失败时会怎样。",
  "service-layer": "集中处理业务规则，不让 Route 或数据库模型包办一切。",
  auth: "先确认用户是谁，再判断他可以读取或修改什么。",
  "background-jobs": "把耗时或定时工作放到请求之外慢慢完成。",
  "backend-testing": "验证业务规则、数据库边界和 API 失败情况。",
  "node-runtime": "让 JavaScript 离开浏览器也能在服务器上运行。",
  "backend-framework": "接住 HTTP 请求、验证数据，再调用真正的业务代码。",
  "data-modeling": "决定系统要保存哪些事实，以及这些事实如何关联。",
  migrations: "在不丢失生产数据的前提下改变数据库结构。",
  transactions: "让一组数据修改要么一起成功，要么一起失败。",
  postgres: "用表、关系、约束和事务长期保存核心数据。",
  redis: "把常用或短期数据放得更近，以更快速度读取。",
  search: "按关键词或语义相似度，从大量内容里找出相关结果。",
  "object-storage": "保存图片、视频和文件等体积较大的二进制内容。",
  cicd: "每次改代码后自动测试、构建并重复地发布软件。",
  observability: "用日志、指标和链路回答系统现在发生了什么。",
  "fault-tolerance": "部分服务出错时，仍让系统提供可用或降级的结果。",
  security: "控制谁能信任谁，并保护数据、密钥和系统边界。",
  "load-balancing": "把请求分给多台健康服务器，避免一台机器扛全部流量。",
  containers: "把程序和运行环境一起打包，保证到哪里都能一致启动。",
  replication: "保存多份数据副本，让一台机器坏掉时系统仍能工作。",
  partitioning: "把太多数据或工作拆开，分给不同机器处理。",
  consistency: "规定多个副本在同一时间允许看到多新的数据。",
  consensus: "让多台可能故障的机器仍能对同一顺序达成一致。",
  queues: "先把工作排队，生产者和消费者就不必同时在线。",
  "model-api": "把上下文发送给模型，并接收文本或结构化结果。",
  "context-window": "决定这一次模型真正能看到哪些信息。",
  "structured-output": "要求模型按固定格式回答，让程序可以安全读取结果。",
  "tool-use": "让模型请求确定性代码去读取状态或执行动作。",
  permissions: "明确 Agent 哪些事能直接做、哪些必须先问人。",
  memory: "保存当前任务状态和以后可能需要再次使用的信息。",
  evals: "用固定任务和标准检查 Agent 改动后有没有变差。",
  "agent-loop": "不断重复观察、决定、行动和检查，直到完成或停止。",
  "ai-native-ux": "让用户看见 Agent 的过程、权限和结果，而不只是聊天。",
  mcp: "用统一协议把 Agent 接到不同数据源和工具。",
  "pi-agent": "把模型、会话、工具和代码操作组合成可运行的 Agent。",
};

function positionedNodes(domain: KnowledgeMapDomain): KnowledgeMapNode[] {
  const columnCount = domain.columns;
  const horizontalGap = columnCount > 1
    ? (domain.width - 48 - columnCount * KNOWLEDGE_NODE_WIDTH) / (columnCount - 1)
    : 0;
  const orderedIds = [...domain.nodeIds].sort((left, right) => (
    Number(!levelTwoIds.has(left)) - Number(!levelTwoIds.has(right))
  ));

  return orderedIds.flatMap((id, index) => {
    const source = knowledgeNodeById.get(id);
    const translation = knowledgeNodeZh[id];
    if (!source || !translation) return [];
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    return [{
      ...source,
      mapDomain: domain.id,
      mapX: domain.x + 24 + column * (KNOWLEDGE_NODE_WIDTH + horizontalGap),
      mapY: domain.y + 132 + row * (KNOWLEDGE_NODE_HEIGHT + 13),
      level: levelTwoIds.has(id) ? 2 : 3,
      aliases: aliases[id] ?? [],
      plainZh: plainZh[id] ?? translation.does,
      zh: translation,
    }];
  });
}

export const knowledgeMapDomains = domainSeeds;
export const knowledgeMapNodes = knowledgeMapDomains.flatMap(positionedNodes);
export const knowledgeMapNodeById = new Map(knowledgeMapNodes.map((node) => [node.id, node]));
export const knowledgeMapDomainById = new Map(knowledgeMapDomains.map((domain) => [domain.id, domain]));

const nodeDomain = (id: string) => knowledgeMapNodeById.get(id)?.mapDomain;

const edgeSeeds: Array<[string, string]> = [
  ["internet", "http"], ["http", "browser"], ["browser", "html"], ["browser", "css"], ["browser", "javascript"],
  ["browser", "components"], ["javascript", "components"], ["css", "components"],
  ["javascript", "typescript"], ["javascript", "build-tools"], ["build-tools", "react"], ["typescript", "react"],
  ["html", "components"], ["react", "components"], ["components", "state"], ["state", "routing"], ["state", "server-state"],
  ["components", "accessibility"], ["components", "frontend-testing"], ["server-state", "api-contract"], ["http", "api-contract"],
  ["node-runtime", "backend-framework"], ["python", "backend-framework"], ["api-contract", "backend-framework"],
  ["api-contract", "service-layer"], ["backend-framework", "service-layer"], ["auth", "service-layer"], ["service-layer", "background-jobs"],
  ["service-layer", "backend-testing"], ["service-layer", "data-modeling"], ["service-layer", "observability"],
  ["python", "service-layer"], ["sql", "data-modeling"], ["sql", "postgres"], ["data-modeling", "postgres"],
  ["postgres", "migrations"], ["postgres", "redis"], ["postgres", "search"], ["service-layer", "object-storage"],
  ["postgres", "transactions"], ["data-modeling", "transactions"], ["processes", "containers"], ["networking", "load-balancing"], ["load-balancing", "service-layer"],
  ["containers", "cicd"], ["cicd", "observability"], ["auth", "security"], ["api-contract", "security"],
  ["postgres", "replication"], ["data-modeling", "partitioning"], ["replication", "consistency"],
  ["partitioning", "consistency"], ["consistency", "consensus"], ["background-jobs", "queues"],
  ["queues", "fault-tolerance"], ["observability", "fault-tolerance"], ["model-api", "context-window"],
  ["context-window", "structured-output"], ["structured-output", "tool-use"], ["tool-use", "agent-loop"],
  ["memory", "agent-loop"], ["mcp", "tool-use"], ["permissions", "tool-use"], ["agent-loop", "evals"],
  ["tool-use", "pi-agent"], ["agent-loop", "pi-agent"], ["pi-agent", "ai-native-ux"], ["react", "ai-native-ux"],
];

const overviewEdgeKeys = new Set([
  "internet→http",
  "http→browser",
  "browser→components",
  "components→state",
  "state→server-state",
  "server-state→api-contract",
  "api-contract→service-layer",
  "service-layer→data-modeling",
  "data-modeling→transactions",
  "javascript→typescript",
  "replication→consistency",
  "partitioning→consistency",
  "cicd→observability",
  "observability→fault-tolerance",
  "model-api→context-window",
  "context-window→structured-output",
  "structured-output→tool-use",
  "tool-use→agent-loop",
  "memory→agent-loop",
  "permissions→tool-use",
  "agent-loop→evals",
]);

export const knowledgeMapEdges: KnowledgeMapEdge[] = edgeSeeds.map(([from, to]) => {
  const source = knowledgeMapNodeById.get(from);
  const target = knowledgeMapNodeById.get(to);
  const relation: KnowledgeMapRelation = source?.priority === "tool" || target?.priority === "tool"
    ? "implements"
    : nodeDomain(from) === nodeDomain(to)
      ? "requires"
      : "flow";
  return { from, to, relation, overview: overviewEdgeKeys.has(`${from}→${to}`) };
});

export const knowledgePaths: KnowledgePath[] = [
  { id: "all", title: "Explore the whole system", titleZh: "探索完整系统", color: "#9cff70", nodeIds: [] },
  { id: "javascript-typescript", title: "JavaScript & TypeScript", titleZh: "JavaScript 与 TypeScript", color: "#ffc55c", nodeIds: ["internet", "http", "browser", "html", "css", "javascript", "typescript", "build-tools", "frontend-testing"] },
  { id: "react-frontend", title: "React Frontend", titleZh: "React 前端", color: "#66d8ea", nodeIds: ["html", "css", "javascript", "typescript", "components", "react", "state", "routing", "server-state", "accessibility", "frontend-testing"] },
  { id: "python-backend", title: "Python Backend & API", titleZh: "Python 后端与 API", color: "#a5ff74", nodeIds: ["internet", "http", "python", "api-contract", "backend-framework", "service-layer", "auth", "data-modeling", "postgres", "backend-testing", "observability"] },
  { id: "full-stack", title: "Full Stack Development", titleZh: "全栈开发", color: "#ff7ac8", nodeIds: ["internet", "http", "browser", "javascript", "typescript", "components", "react", "state", "server-state", "api-contract", "service-layer", "data-modeling", "postgres", "transactions", "cicd", "observability", "security"] },
  { id: "system-design", title: "System Design", titleZh: "系统设计", color: "#ff9d66", nodeIds: ["http", "api-contract", "service-layer", "data-modeling", "postgres", "redis", "load-balancing", "background-jobs", "queues", "observability", "security", "fault-tolerance"] },
  { id: "distributed-systems", title: "Distributed Systems", titleZh: "分布式系统", color: "#9aa8ff", nodeIds: ["processes", "networking", "transactions", "replication", "partitioning", "consistency", "consensus", "queues", "fault-tolerance", "observability"] },
  { id: "agentic-ai", title: "Agentic AI Software", titleZh: "Agentic AI 软件", color: "#ff7ac8", nodeIds: ["model-api", "context-window", "structured-output", "tool-use", "agent-loop", "memory", "mcp", "permissions", "evals", "pi-agent", "ai-native-ux"] },
];

export const knowledgePathById = new Map(knowledgePaths.map((path) => [path.id, path]));

export const knowledgeResourceShelf = [
  { title: "JavaScript V9", provider: "freeCodeCamp", path: "JavaScript & TypeScript", url: "https://www.freecodecamp.org/learn/javascript-v9/", verifiedAt: "2026-07-26" },
  { title: "JavaScript Guide", provider: "MDN", path: "JavaScript & TypeScript", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", verifiedAt: "2026-07-26" },
  { title: "Learn React", provider: "React", path: "React Frontend", url: "https://react.dev/learn", verifiedAt: "2026-07-26" },
  { title: "FastAPI Tutorial", provider: "FastAPI", path: "Python Backend & API", url: "https://fastapi.tiangolo.com/tutorial/", verifiedAt: "2026-07-26" },
  { title: "Full Stack Open", provider: "University of Helsinki", path: "Full Stack Development", url: "https://fullstackopen.com/en/", verifiedAt: "2026-07-26" },
  { title: "System Design Primer", provider: "GitHub", path: "System Design", url: "https://github.com/donnemartin/system-design-primer", verifiedAt: "2026-07-26" },
  { title: "Site Reliability Engineering", provider: "Google", path: "System Design", url: "https://sre.google/sre-book/table-of-contents/", verifiedAt: "2026-07-26" },
  { title: "MIT 6.5840", provider: "MIT", path: "Distributed Systems", url: "https://pdos.csail.mit.edu/6.824/", verifiedAt: "2026-07-26" },
  { title: "Model Context Protocol", provider: "MCP", path: "Agentic AI Software", url: "https://modelcontextprotocol.io/docs/getting-started/intro", verifiedAt: "2026-07-26" },
  { title: "Pi Web Source", provider: "agegr · MIT", path: "Agentic AI Software", url: "https://github.com/agegr/pi-web", verifiedAt: "2026-07-26" },
] as const;

export function knowledgeSearchText(node: KnowledgeMapNode) {
  return [
    node.label,
    node.zh.label,
    node.kind,
    node.does,
    node.zh.does,
    ...node.aliases,
  ].join(" ").toLowerCase();
}

export function relatedKnowledgeNodes(nodeId: string) {
  const ids = new Set<string>();
  knowledgeMapEdges.forEach((edge) => {
    if (edge.from === nodeId) ids.add(edge.to);
    if (edge.to === nodeId) ids.add(edge.from);
  });
  return [...ids].map((id) => knowledgeMapNodeById.get(id)).filter((node): node is KnowledgeMapNode => Boolean(node));
}
