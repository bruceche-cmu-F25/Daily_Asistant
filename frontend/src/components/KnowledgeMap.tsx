import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import {
  loadAiTutorStatus,
  streamAiTutorMessage,
  type AiTutorContext,
  type AiTutorMessage,
  type AiTutorStatus,
} from "../api";
import {
  KNOWLEDGE_CANVAS_HEIGHT,
  KNOWLEDGE_CANVAS_WIDTH,
  KNOWLEDGE_NODE_HEIGHT,
  KNOWLEDGE_NODE_WIDTH,
  knowledgeMapDomainById,
  knowledgeMapDomains,
  knowledgeMapEdges,
  knowledgeMapNodeById,
  knowledgeMapNodes,
  knowledgePathById,
  knowledgePaths,
  knowledgeResourceShelf,
  knowledgeSearchText,
  relatedKnowledgeNodes,
  type KnowledgeMapDomain,
  type KnowledgeMapNode,
  type KnowledgePath,
  type KnowledgePathId,
  type KnowledgeProgressState,
} from "../knowledgeMapData";
import { knowledgeNodeLearning } from "../systemKnowledgeLearning";

const PROGRESS_KEY = "daily-dashboard:knowledge-map:progress:v1";
const MIN_SCALE = 0.28;
const MAX_SCALE = 1.55;

type Viewport = { x: number; y: number; scale: number };
type DrawerTab = "overview" | "example" | "practice" | "ai";
type ProgressMap = Record<string, KnowledgeProgressState>;

const domainColors: Record<string, string> = {
  foundations: "#77a8ff",
  languages: "#ffc55c",
  frontend: "#66d8ea",
  backend: "#9cff70",
  data: "#bd91ff",
  operations: "#ff9d66",
  "system-design": "#9aa8ff",
  agentic: "#ff7ac8",
};

const progressLabels: Record<KnowledgeProgressState, string> = {
  new: "New · 新概念",
  learning: "Learning · 学习中",
  understood: "Understood · 已理解",
};

const progressNext: Record<KnowledgeProgressState, KnowledgeProgressState> = {
  new: "learning",
  learning: "understood",
  understood: "new",
};

function readProgress(): ProgressMap {
  try {
    const value = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(value).filter(([, state]) => state === "new" || state === "learning" || state === "understood"),
    ) as ProgressMap;
  } catch {
    return {};
  }
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function practiceFor(node: KnowledgeMapNode) {
  const label = `${node.zh.label} (${node.label})`;
  if (node.kind === "LANGUAGE" || node.kind === "FRAMEWORK" || node.kind === "TOOLING" || node.kind === "DATABASE") {
    return {
      task: `用 10–20 分钟做一个最小可运行例子，刻意使用 ${label}，并写下输入、输出与一个失败情况。`,
      hint1: `先把范围压到一个文件或一个函数，只证明 ${node.zh.does}`,
      hint2: "完成 happy path 后，主动制造一次错误，并观察错误出现在哪一层。",
      solution: `可接受的完成证据：代码能运行；你能用自己的话解释 ${node.label} 解决了什么；你能指出一个不该使用它的情况。`,
    };
  }
  if (node.kind === "THEORY" || node.kind === "ALGORITHM" || node.kind === "FOUNDATION" || node.kind === "PROTOCOL") {
    return {
      task: `画一张不超过 8 个方块的图，解释 ${label} 的参与者、消息或状态变化，再用一个反例测试你的理解。`,
      hint1: "先问：谁在做决定？状态存在哪里？失败发生时谁能观察到？",
      hint2: `把 ${node.proof} 改写成三个检查点。`,
      solution: `完成时，你应该能不看资料复述主流程，并解释 ${node.label} 与相邻概念的边界。`,
    };
  }
  return {
    task: `选 Daily 中一个真实功能，用 10–20 分钟标出 ${label} 当前在哪里、上下游是谁，以及最可能出错的边界。`,
    hint1: `从一个用户动作开始，沿数据流寻找 ${node.label}，不要先从文件名猜。`,
    hint2: `用“输入 → 决策 → 输出 → 失败”四栏记录 ${node.zh.does}`,
    solution: `完成证据：你能指出一个具体实现位置、一个上游、一个下游，并解释为什么 ${node.zh.matters}`,
  };
}

function pathStyle(path: KnowledgePath) {
  return { "--path-color": path.color } as CSSProperties;
}

function nodeCenter(node: KnowledgeMapNode) {
  return {
    x: node.mapX + KNOWLEDGE_NODE_WIDTH / 2,
    y: node.mapY + KNOWLEDGE_NODE_HEIGHT / 2,
  };
}

function edgePath(from: KnowledgeMapNode, to: KnowledgeMapNode) {
  const source = nodeCenter(from);
  const target = nodeCenter(to);
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  if (Math.abs(dx) >= Math.abs(dy) * 0.72) {
    const direction = dx >= 0 ? 1 : -1;
    const startX = from.mapX + (direction > 0 ? KNOWLEDGE_NODE_WIDTH : 0);
    const endX = to.mapX + (direction > 0 ? 0 : KNOWLEDGE_NODE_WIDTH);
    const bend = Math.max(46, Math.abs(endX - startX) * 0.46);
    return `M ${startX} ${source.y} C ${startX + bend * direction} ${source.y}, ${endX - bend * direction} ${target.y}, ${endX} ${target.y}`;
  }

  const direction = dy >= 0 ? 1 : -1;
  const startY = from.mapY + (direction > 0 ? KNOWLEDGE_NODE_HEIGHT : 0);
  const endY = to.mapY + (direction > 0 ? 0 : KNOWLEDGE_NODE_HEIGHT);
  const bend = Math.max(46, Math.abs(endY - startY) * 0.46);
  return `M ${source.x} ${startY} C ${source.x} ${startY + bend * direction}, ${target.x} ${endY - bend * direction}, ${target.x} ${endY}`;
}

function domainCenter(domain: KnowledgeMapDomain) {
  return { x: domain.x + domain.width / 2, y: domain.y + domain.height / 2 };
}

function buildPiPrompt(node: KnowledgeMapNode, path: KnowledgePath, adjacent: KnowledgeMapNode[]) {
  const domain = knowledgeMapDomainById.get(node.mapDomain);
  return [
    `我正在 Daily Learning Map 学习「${node.zh.label} (${node.label})」。`,
    `所属领域：${domain?.titleZh} (${domain?.title})。`,
    path.id === "all" ? "当前没有选择特定学习路线。" : `当前路线：${path.titleZh} (${path.title})。`,
    `它的作用：${node.zh.does}`,
    `相邻概念：${adjacent.map((item) => `${item.zh.label} (${item.label})`).join("、") || "无"}`,
    "",
    "请结合这些上下文回答我的问题。中文为主，保留关键英文术语；先建立直观模型，再给具体例子和一个可以验证理解的小问题。",
  ].join("\n");
}

export function KnowledgeMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialNode = searchParams.get("node");
  const initialPath = searchParams.get("path") as KnowledgePathId | null;
  const [selectedId, setSelectedId] = useState(knowledgeMapNodeById.has(initialNode ?? "") ? initialNode : null);
  const [pathId, setPathId] = useState<KnowledgePathId>(
    initialPath !== null && knowledgePathById.has(initialPath) ? initialPath : "all",
  );
  const [viewport, setViewport] = useState<Viewport>({ x: 20, y: 20, scale: 0.42 });
  const [query, setQuery] = useState("");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>(readProgress);
  const [copied, setCopied] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [dragging, setDragging] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const fittedRef = useRef(false);

  const [aiStatus, setAiStatus] = useState<AiTutorStatus | null>(null);
  const [aiMessages, setAiMessages] = useState<AiTutorMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiAbortRef = useRef<AbortController | null>(null);

  const selectedNode = selectedId ? knowledgeMapNodeById.get(selectedId) ?? null : null;
  const activePath = knowledgePathById.get(pathId) ?? knowledgePaths[0];
  const pathIndex = selectedId ? activePath.nodeIds.indexOf(selectedId) : -1;
  const pathNodes = useMemo(() => new Set(activePath.nodeIds), [activePath]);
  const visibleLevel = viewport.scale < 0.43 ? 1 : viewport.scale < 0.72 ? 2 : 3;
  const visibleEdges = useMemo(() => knowledgeMapEdges.filter((edge) => (
    edge.overview || edge.from === selectedId || edge.to === selectedId
  )), [selectedId]);
  const pathRouteNodes = useMemo(() => activePath.nodeIds
    .map((id) => knowledgeMapNodeById.get(id))
    .filter((node): node is KnowledgeMapNode => Boolean(node)), [activePath]);
  const adjacent = selectedNode ? relatedKnowledgeNodes(selectedNode.id) : [];
  const selectedDomain = selectedNode ? knowledgeMapDomainById.get(selectedNode.mapDomain) : null;
  const selectedLearning = selectedNode ? knowledgeNodeLearning[selectedNode.id] : null;
  const selectedPractice = selectedNode ? practiceFor(selectedNode) : null;

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return knowledgeMapNodes
      .filter((node) => knowledgeSearchText(node).includes(normalized))
      .slice(0, 9);
  }, [query]);

  const syncUrl = useCallback((nodeId: string | null, nextPathId: KnowledgePathId) => {
    const next = new URLSearchParams();
    if (nodeId) next.set("node", nodeId);
    if (nextPathId !== "all") next.set("path", nextPathId);
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  const fitMap = useCallback(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = clampScale(Math.min((rect.width - 84) / KNOWLEDGE_CANVAS_WIDTH, (rect.height - 84) / KNOWLEDGE_CANVAS_HEIGHT));
    setViewport({
      scale,
      x: (rect.width - KNOWLEDGE_CANVAS_WIDTH * scale) / 2,
      y: (rect.height - KNOWLEDGE_CANVAS_HEIGHT * scale) / 2,
    });
  }, []);

  const focusPoint = useCallback((point: { x: number; y: number }, scale = 0.88) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextScale = clampScale(scale);
    const drawerAllowance = selectedId ? 190 : 0;
    setViewport({
      scale: nextScale,
      x: (rect.width - drawerAllowance) / 2 - point.x * nextScale,
      y: rect.height / 2 - point.y * nextScale,
    });
  }, [selectedId]);

  const selectNode = useCallback((node: KnowledgeMapNode, focus = false) => {
    aiAbortRef.current?.abort();
    setAiMessages([]);
    setAiInput("");
    setAiError("");
    setAiStreaming(false);
    setHintLevel(0);
    setResourcesOpen(false);
    setSelectedId(node.id);
    setDrawerTab("overview");
    syncUrl(node.id, pathId);
    if (focus) focusPoint(nodeCenter(node), Math.max(viewport.scale, 0.82));
  }, [focusPoint, pathId, syncUrl, viewport.scale]);

  const closeDrawer = useCallback(() => {
    aiAbortRef.current?.abort();
    setAiMessages([]);
    setAiInput("");
    setAiStreaming(false);
    setSelectedId(null);
    setResourcesOpen(false);
    syncUrl(null, pathId);
  }, [pathId, syncUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!fittedRef.current) {
        fitMap();
        fittedRef.current = true;
      }
    }, 0);
    const element = workspaceRef.current;
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (!fittedRef.current) fitMap();
    });
    if (element) resizeObserver?.observe(element);
    return () => {
      window.clearTimeout(timer);
      resizeObserver?.disconnect();
    };
  }, [fitMap]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        if (query) setQuery("");
        else if (selectedId || resourcesOpen) closeDrawer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, query, resourcesOpen, selectedId]);

  useEffect(() => {
    loadAiTutorStatus()
      .then(setAiStatus)
      .catch(() => setAiStatus({ configured: false, model: null, detail: "AI Tutor backend is unavailable." }));
    return () => aiAbortRef.current?.abort();
  }, []);

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const deltaInPixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    const sensitivity = event.ctrlKey ? 0.002 : 0.0012;
    const maxExponent = event.ctrlKey ? 0.18 : 0.24;
    const exponent = Math.max(-maxExponent, Math.min(maxExponent, -deltaInPixels * sensitivity));

    setViewport((current) => {
      const canvasX = (cursorX - current.x) / current.scale;
      const canvasY = (cursorY - current.y) / current.scale;
      const nextScale = clampScale(current.scale * Math.exp(exponent));
      return {
        scale: nextScale,
        x: cursorX - canvasX * nextScale,
        y: cursorY - canvasY * nextScale,
      };
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input, select, a, textarea")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setViewport((current) => ({
      ...current,
      x: drag.originX + event.clientX - drag.x,
      y: drag.originY + event.clientY - drag.y,
    }));
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragging(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const changePath = (nextId: KnowledgePathId) => {
    const nextPath = knowledgePathById.get(nextId) ?? knowledgePaths[0];
    setPathId(nextPath.id);
    if (nextPath.id === "all") {
      syncUrl(selectedId, nextPath.id);
      fitMap();
      return;
    }
    const firstNode = knowledgeMapNodeById.get(nextPath.nodeIds[0]);
    if (firstNode) {
      setSelectedId(firstNode.id);
      setDrawerTab("overview");
      syncUrl(firstNode.id, nextPath.id);
      focusPoint(nodeCenter(firstNode), 0.88);
    }
  };

  const movePath = (direction: -1 | 1) => {
    if (activePath.id === "all" || !activePath.nodeIds.length) return;
    const current = pathIndex >= 0 ? pathIndex : 0;
    const next = Math.min(activePath.nodeIds.length - 1, Math.max(0, current + direction));
    const node = knowledgeMapNodeById.get(activePath.nodeIds[next]);
    if (node) selectNode(node, true);
  };

  const updateProgress = (nodeId: string) => {
    setProgress((current) => {
      const next = { ...current, [nodeId]: progressNext[current[nodeId] ?? "new"] };
      try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // Progress remains available for this session if storage is blocked.
      }
      return next;
    });
  };

  const askPi = async () => {
    if (!selectedNode) return;
    const prompt = buildPiPrompt(selectedNode, activePath, adjacent);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
    window.open("/agent", "_blank", "noopener,noreferrer");
  };

  const askTutor = async (content: string, mode: AiTutorContext["mode"]) => {
    if (!selectedNode || !selectedDomain || !content.trim() || aiStreaming) return;
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const userMessage: AiTutorMessage = { role: "user", content: content.trim() };
    const history = [...aiMessages, userMessage].slice(-5);
    setAiMessages([...history, { role: "assistant", content: "" }]);
    setAiInput("");
    setAiError("");
    setAiStreaming(true);
    const context: AiTutorContext = {
      node: {
        id: selectedNode.id,
        label: selectedNode.label,
        labelZh: selectedNode.zh.label,
        does: selectedNode.does,
        doesZh: selectedNode.zh.does,
        matters: selectedNode.matters,
        mattersZh: selectedNode.zh.matters,
      },
      domain: { title: selectedDomain.title, titleZh: selectedDomain.titleZh },
      adjacent: adjacent.map((node) => ({ label: node.label, labelZh: node.zh.label })),
      path: activePath.id === "all" ? null : { title: activePath.title, titleZh: activePath.titleZh },
      mode,
    };
    try {
      await streamAiTutorMessage(history, context, controller.signal, (text) => {
        setAiMessages((current) => current.map((message, index) => (
          index === current.length - 1 ? { ...message, content: message.content + text } : message
        )));
      });
    } catch (error) {
      if (!controller.signal.aborted) setAiError(error instanceof Error ? error.message : "AI Tutor request failed.");
    } finally {
      setAiStreaming(false);
      aiAbortRef.current = null;
    }
  };

  const levelLabel = visibleLevel === 1 ? "Landscape" : visibleLevel === 2 ? "Capabilities" : "Tools & detail";
  const drawerOpen = Boolean(selectedNode || resourcesOpen);

  return (
    <section className={`knowledge-map${drawerOpen ? " has-drawer" : ""}`} aria-label="Interactive software knowledge map">
      <div className="knowledge-map-toolbar">
        <div className="knowledge-map-title">
          <span>LEARNING MAP / 01</span>
          <strong>SOFTWARE SYSTEMS MAP</strong>
          <small>软件系统全景图</small>
        </div>
        <label className="knowledge-path-select">
          <span>Learning path · 学习路线</span>
          <select value={pathId} onChange={(event) => changePath(event.target.value as KnowledgePathId)}>
            {knowledgePaths.map((path) => (
              <option value={path.id} key={path.id}>{path.title} · {path.titleZh}</option>
            ))}
          </select>
        </label>
        <div className="knowledge-map-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search concepts or tools… 搜索  /"
            aria-label="Search knowledge map"
          />
          {query && (
            <div className="knowledge-search-results" role="listbox" aria-label="Knowledge search results">
              {searchResults.length ? searchResults.map((node) => (
                <button type="button" key={node.id} onClick={() => { selectNode(node, true); setQuery(""); }}>
                  <span style={{ background: domainColors[node.mapDomain] }} />
                  <span><b>{node.label}</b><small>{node.zh.label} · {node.plainZh}</small></span>
                  <i>→</i>
                </button>
              )) : <p>没有匹配的节点 · No match</p>}
            </div>
          )}
        </div>
        <button className="knowledge-resource-button" type="button" onClick={() => { setResourcesOpen(true); setSelectedId(null); }}>
          RESOURCES <span>学习资源</span>
        </button>
      </div>

      {activePath.id !== "all" && (
        <div className="knowledge-path-bar" style={pathStyle(activePath)}>
          <span className="knowledge-path-dot" />
          <div>
            <b>{activePath.title}</b>
            <small>{activePath.titleZh} · {activePath.nodeIds.length} 个关键节点</small>
          </div>
          <button type="button" onClick={() => movePath(-1)} disabled={pathIndex <= 0}>← PREVIOUS</button>
          <strong>{Math.max(1, pathIndex + 1)} / {activePath.nodeIds.length}</strong>
          <button type="button" onClick={() => movePath(1)} disabled={pathIndex === activePath.nodeIds.length - 1}>NEXT →</button>
        </div>
      )}

      <div
        className={`knowledge-map-workspace${dragging ? " is-dragging" : ""}`}
        data-level={visibleLevel}
        ref={workspaceRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div className="knowledge-zoom-indicator">
          <span>LEVEL {visibleLevel}</span>
          <b>{levelLabel}</b>
        </div>
        <div
          className="knowledge-map-canvas"
          style={{
            width: KNOWLEDGE_CANVAS_WIDTH,
            height: KNOWLEDGE_CANVAS_HEIGHT,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          }}
        >
          <div className="knowledge-map-band band-crosscut">
            <b>CROSS-CUTTING SYSTEMS</b>
            <span>规模、可靠性与智能体能力横跨整个应用</span>
          </div>
          <div className="knowledge-map-band band-request">
            <b>REQUEST FLOW</b>
            <span>用户请求 → Web Runtime → Frontend → Backend API → Durable Data</span>
          </div>
          <div className="knowledge-map-band band-support">
            <b>BUILD & RUN</b>
            <span>编程语言支撑实现，Delivery & Operations 支撑生产运行</span>
          </div>
          <svg className="knowledge-map-edges" viewBox={`0 0 ${KNOWLEDGE_CANVAS_WIDTH} ${KNOWLEDGE_CANVAS_HEIGHT}`} aria-hidden="true">
            <defs>
              <marker id="knowledge-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" />
              </marker>
              <marker id="knowledge-path-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
              </marker>
            </defs>
            {visibleEdges.map((edge) => {
              const from = knowledgeMapNodeById.get(edge.from);
              const to = knowledgeMapNodeById.get(edge.to);
              if (!from || !to) return null;
              const incident = selectedId === edge.from || selectedId === edge.to;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  data-from={edge.from}
                  data-to={edge.to}
                  className={`${edge.relation}${incident ? " selected-edge" : ""}${activePath.id !== "all" ? " path-dim" : ""}`}
                  d={edgePath(from, to)}
                  markerEnd="url(#knowledge-arrow)"
                />
              );
            })}
            {activePath.id !== "all" && pathRouteNodes.slice(0, -1).map((from, index) => {
              const to = pathRouteNodes[index + 1];
              return (
                <path
                  className="path-route"
                  data-from={from.id}
                  data-to={to.id}
                  d={edgePath(from, to)}
                  markerEnd="url(#knowledge-path-arrow)"
                  style={{ color: activePath.color, stroke: activePath.color }}
                  key={`path-${from.id}-${to.id}`}
                />
              );
            })}
          </svg>

          {knowledgeMapDomains.map((domain) => (
            <button
              className="knowledge-domain"
              data-domain={domain.id}
              type="button"
              key={domain.id}
              style={{
                left: domain.x,
                top: domain.y,
                width: domain.width,
                height: domain.height,
                "--domain-color": domainColors[domain.id],
              } as CSSProperties}
              onDoubleClick={() => focusPoint(domainCenter(domain), Math.min(1.05, Math.max(0.68, 820 / domain.width)))}
              aria-label={`Focus ${domain.title}`}
            >
              <span>{domain.title}</span>
              <b>{domain.titleZh}</b>
              <small>{domain.summaryZh}</small>
            </button>
          ))}

          {knowledgeMapNodes.map((node) => {
            const isPathNode = activePath.id === "all" || pathNodes.has(node.id);
            const order = activePath.nodeIds.indexOf(node.id);
            const state = progress[node.id] ?? "new";
            const condensedByZoom = visibleLevel < node.level;
            return (
              <button
                className={`knowledge-node${selectedId === node.id ? " selected" : ""}${isPathNode ? "" : " path-dim"}${condensedByZoom ? " semantic-condensed" : ""}`}
                data-domain={node.mapDomain}
                data-node-id={node.id}
                data-progress={state}
                type="button"
                key={node.id}
                style={{
                  left: node.mapX,
                  top: node.mapY,
                  width: KNOWLEDGE_NODE_WIDTH,
                  height: KNOWLEDGE_NODE_HEIGHT,
                  "--node-color": domainColors[node.mapDomain],
                  "--path-color": activePath.color,
                } as CSSProperties}
                onClick={() => selectNode(node)}
              >
                {order >= 0 && <i>{order + 1}</i>}
                <span>{node.label}</span>
                <b>{node.zh.label}</b>
                <small>{node.plainZh}</small>
                <em aria-label={progressLabels[state]} />
              </button>
            );
          })}
        </div>

        <div className="knowledge-map-controls" aria-label="Map controls">
          <button type="button" aria-label="Zoom out" onClick={() => setViewport((current) => ({ ...current, scale: clampScale(current.scale - 0.12) }))}>−</button>
          <button type="button" aria-label="Zoom in" onClick={() => setViewport((current) => ({ ...current, scale: clampScale(current.scale + 0.12) }))}>+</button>
          <button type="button" onClick={fitMap}>Fit</button>
          <button type="button" onClick={() => { setSelectedId(null); setResourcesOpen(false); syncUrl(null, pathId); fitMap(); }}>Overview</button>
        </div>

        <div className="knowledge-minimap" aria-label="Knowledge map minimap">
          <div
            className="knowledge-minimap-canvas"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              focusPoint({
                x: ((event.clientX - rect.left) / rect.width) * KNOWLEDGE_CANVAS_WIDTH,
                y: ((event.clientY - rect.top) / rect.height) * KNOWLEDGE_CANVAS_HEIGHT,
              }, viewport.scale);
            }}
          >
            {knowledgeMapDomains.map((domain) => (
              <span
                key={domain.id}
                style={{
                  left: `${domain.x / KNOWLEDGE_CANVAS_WIDTH * 100}%`,
                  top: `${domain.y / KNOWLEDGE_CANVAS_HEIGHT * 100}%`,
                  width: `${domain.width / KNOWLEDGE_CANVAS_WIDTH * 100}%`,
                  height: `${domain.height / KNOWLEDGE_CANVAS_HEIGHT * 100}%`,
                  borderColor: domainColors[domain.id],
                }}
              />
            ))}
            <i style={{
              left: `${Math.max(0, -viewport.x / viewport.scale / KNOWLEDGE_CANVAS_WIDTH * 100)}%`,
              top: `${Math.max(0, -viewport.y / viewport.scale / KNOWLEDGE_CANVAS_HEIGHT * 100)}%`,
              width: `${Math.min(100, (workspaceRef.current?.clientWidth ?? 900) / viewport.scale / KNOWLEDGE_CANVAS_WIDTH * 100)}%`,
              height: `${Math.min(100, (workspaceRef.current?.clientHeight ?? 600) / viewport.scale / KNOWLEDGE_CANVAS_HEIGHT * 100)}%`,
            }} />
          </div>
        </div>
      </div>

      {selectedNode && selectedDomain && (
        <aside className="knowledge-drawer" aria-label={`${selectedNode.label} details`}>
          <header style={{ "--drawer-color": domainColors[selectedNode.mapDomain] } as CSSProperties}>
            <div>
              <span>{selectedDomain.title} · {selectedNode.kind}</span>
              <h2>{selectedNode.label}</h2>
              <p>{selectedNode.zh.label}</p>
            </div>
            <button type="button" aria-label="Close node details" onClick={closeDrawer}>×</button>
          </header>
          <div className="knowledge-drawer-actions">
            <button
              type="button"
              data-progress={progress[selectedNode.id] ?? "new"}
              onClick={() => updateProgress(selectedNode.id)}
            >
              <span /> {progressLabels[progress[selectedNode.id] ?? "new"]}
            </button>
            <button type="button" onClick={askPi}>{copied ? "已复制并打开 Pi ✓" : "ASK IN PI ↗"}</button>
          </div>
          <nav aria-label="Node detail tabs">
            {([
              ["overview", "OVERVIEW", "概览"],
              ["example", "EXAMPLE", "例子"],
              ["practice", "PRACTICE", "练习"],
              ["ai", "ASK AI", "问 AI"],
            ] as const).map(([id, en, zh]) => (
              <button className={drawerTab === id ? "active" : ""} type="button" key={id} onClick={() => setDrawerTab(id)}>
                {en}<small>{zh}</small>
              </button>
            ))}
          </nav>

          <div className="knowledge-drawer-content">
            {drawerTab === "overview" && (
              <>
                <article className="knowledge-definition">
                  <span>PLAIN EXPLANATION · 最直白解释</span>
                  <p>{selectedNode.plainZh}</p>
                  <div>{selectedNode.zh.does}</div>
                  <small>{selectedNode.does}</small>
                </article>
                <section>
                  <h3>为什么重要 <span>WHY IT MATTERS</span></h3>
                  <p>{selectedNode.zh.matters}</p>
                  <small>{selectedNode.matters}</small>
                </section>
                <section>
                  <h3>在系统中的位置 <span>SYSTEM POSITION</span></h3>
                  <div className="knowledge-position-flow">
                    <span>{knowledgeMapEdges.filter((edge) => edge.to === selectedNode.id).map((edge) => knowledgeMapNodeById.get(edge.from)?.label).filter(Boolean).slice(0, 3).join(" · ") || "Upstream input"}</span>
                    <b>→ {selectedNode.label} →</b>
                    <span>{knowledgeMapEdges.filter((edge) => edge.from === selectedNode.id).map((edge) => knowledgeMapNodeById.get(edge.to)?.label).filter(Boolean).slice(0, 3).join(" · ") || "Downstream result"}</span>
                  </div>
                </section>
                <section>
                  <h3>相邻概念 <span>CONNECTED CONCEPTS</span></h3>
                  <div className="knowledge-related">
                    {adjacent.map((node) => (
                      <button type="button" key={node.id} onClick={() => selectNode(node, true)}>
                        <i style={{ background: domainColors[node.mapDomain] }} />
                        <span>{node.label}<small>{node.zh.label}</small></span>
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <h3>理解标准 <span>PROOF OF UNDERSTANDING</span></h3>
                  <p>{selectedNode.zh.proof}</p>
                  <small>{selectedNode.proof}</small>
                </section>
              </>
            )}

            {drawerTab === "example" && (
              <>
                <article className="knowledge-example-card">
                  <span>CONCRETE EXAMPLE · 具体例子</span>
                  <p>{selectedLearning?.exampleZh ?? selectedNode.zh.proof}</p>
                  <small>{selectedLearning?.example ?? selectedNode.proof}</small>
                </article>
                <section>
                  <h3>阅读例子的方式 <span>HOW TO READ IT</span></h3>
                  <ol>
                    <li>先找输入与期望输出。</li>
                    <li>标出 {selectedNode.label} 真正负责的那一步。</li>
                    <li>问它失败时，上下游分别会看到什么。</li>
                  </ol>
                </section>
                <section>
                  <h3>设计取舍 <span>TRADEOFF</span></h3>
                  <p>它解决的是「{selectedNode.zh.does}」，但引入任何新概念或工具都会增加学习、调试和维护成本。先证明问题存在，再扩大使用范围。</p>
                </section>
              </>
            )}

            {drawerTab === "practice" && selectedPractice && (
              <>
                <article className="knowledge-practice-card">
                  <span>10–20 MIN · 通用练习</span>
                  <p>{selectedPractice.task}</p>
                </article>
                <section>
                  <h3>完成标准 <span>DONE WHEN</span></h3>
                  <p>{selectedNode.zh.proof}</p>
                </section>
                <div className="knowledge-hints">
                  <button type="button" onClick={() => setHintLevel((level) => Math.max(1, level))}>提示 1</button>
                  <button type="button" onClick={() => setHintLevel((level) => Math.max(2, level))}>提示 2</button>
                  <button type="button" onClick={() => setHintLevel(3)}>参考答案</button>
                </div>
                {hintLevel >= 1 && <p className="knowledge-hint"><b>提示 1</b>{selectedPractice.hint1}</p>}
                {hintLevel >= 2 && <p className="knowledge-hint"><b>提示 2</b>{selectedPractice.hint2}</p>}
                {hintLevel >= 3 && <p className="knowledge-hint solution"><b>参考答案</b>{selectedPractice.solution}</p>}
              </>
            )}

            {drawerTab === "ai" && (
              <div className="knowledge-ai">
                <div className={`knowledge-ai-status${aiStatus?.configured ? " ready" : ""}`}>
                  <span />
                  <p><b>{aiStatus?.configured ? "AI Tutor ready" : "AI Tutor 未配置"}</b><small>{aiStatus?.detail ?? "Checking local adapter…"}</small></p>
                </div>
                <p className="knowledge-ai-context">AI 只会收到当前节点、所在领域、相邻概念和所选路线；无工具、无文件权限、关闭即清空。</p>
                <div className="knowledge-ai-prompts">
                  <button type="button" disabled={!aiStatus?.configured || aiStreaming} onClick={() => askTutor("请用最简单但不失真的方式解释这个概念。", "explain")}>简单解释</button>
                  <button type="button" disabled={!aiStatus?.configured || aiStreaming} onClick={() => askTutor("请给我一个具体、可运行或可追踪的例子。", "example")}>具体例子</button>
                  <button type="button" disabled={!aiStatus?.configured || aiStreaming} onClick={() => askTutor("请一次只问我一道题，不要提前告诉我答案。", "quiz")}>Quiz me</button>
                </div>
                <div className="knowledge-ai-messages" aria-live="polite">
                  {aiMessages.map((message, index) => (
                    <div className={message.role} key={`${message.role}-${index}`}>
                      <b>{message.role === "user" ? "YOU" : "AI TUTOR"}</b>
                      <p>{message.content || (aiStreaming && index === aiMessages.length - 1 ? "…" : "")}</p>
                    </div>
                  ))}
                  {aiError && <p className="knowledge-ai-error">{aiError}</p>}
                </div>
                <form onSubmit={(event) => { event.preventDefault(); askTutor(aiInput, "question"); }}>
                  <textarea
                    value={aiInput}
                    onChange={(event) => setAiInput(event.target.value)}
                    placeholder="问这个节点相关的问题…"
                    disabled={!aiStatus?.configured || aiStreaming}
                    rows={3}
                  />
                  {aiStreaming
                    ? <button type="button" onClick={() => aiAbortRef.current?.abort()}>停止生成</button>
                    : <button type="submit" disabled={!aiStatus?.configured || !aiInput.trim()}>发送 →</button>}
                </form>
              </div>
            )}
          </div>
        </aside>
      )}

      {resourcesOpen && (
        <aside className="knowledge-drawer knowledge-resources-drawer" aria-label="Learning resources">
          <header>
            <div>
              <span>MANUALLY CURATED</span>
              <h2>学习资源库</h2>
              <p>Resources · 最多 10 个可信入口</p>
            </div>
            <button type="button" aria-label="Close resources" onClick={closeDrawer}>×</button>
          </header>
          <div className="knowledge-resource-intro">
            节点卡不塞链接。需要系统学习时，再从这里进入官方文档或一门完整课程。
          </div>
          <div className="knowledge-resource-list">
            {knowledgeResourceShelf.map((resource, index) => (
              <a href={resource.url} target="_blank" rel="noreferrer" key={resource.url}>
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span><b>{resource.title}</b><small>{resource.provider} · {resource.path}</small></span>
                <em>↗</em>
                <time>VERIFIED {resource.verifiedAt}</time>
              </a>
            ))}
          </div>
        </aside>
      )}
    </section>
  );
}
