import { useMemo, useState } from "react";

import {
  learningRoadmapById,
  learningRoadmaps,
  type LearningRoadmap,
  type LearningRoadmapId,
} from "../learningRoadmaps";


const STORAGE_KEY = "daily-dashboard:learning-roadmaps:v1";
const NODE_WIDTH = 200;
const NODE_HEIGHT = 86;

type RoadmapProgress = Record<LearningRoadmapId, string[]>;

function emptyProgress(): RoadmapProgress {
  return {
    javascript: [],
    react: [],
    "full-stack": [],
    "system-design": [],
    "distributed-systems": [],
  };
}

function readProgress(): RoadmapProgress {
  const fallback = emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Record<LearningRoadmapId, unknown>>;
    for (const roadmap of learningRoadmaps) {
      const validNodeIds = new Set(roadmap.nodes.map((node) => node.id));
      const saved = parsed[roadmap.id];
      fallback[roadmap.id] = Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string" && validNodeIds.has(id))
        : [];
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function prerequisites(roadmap: LearningRoadmap, nodeId: string) {
  return roadmap.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from);
}

function nodeAndDescendants(roadmap: LearningRoadmap, nodeId: string) {
  const found = new Set([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift();
    roadmap.edges
      .filter((edge) => edge.from === current)
      .forEach((edge) => {
        if (found.has(edge.to)) return;
        found.add(edge.to);
        queue.push(edge.to);
      });
  }
  return found;
}

function edgePath(roadmap: LearningRoadmap, fromId: string, toId: string) {
  const from = roadmap.nodes.find((node) => node.id === fromId);
  const to = roadmap.nodes.find((node) => node.id === toId);
  if (!from || !to) return "";
  const startX = from.position[0] + NODE_WIDTH / 2;
  const startY = from.position[1] + NODE_HEIGHT;
  const endX = to.position[0] + NODE_WIDTH / 2;
  const endY = to.position[1];
  const middleY = startY + (endY - startY) / 2;
  return `M${startX} ${startY} C${startX} ${middleY} ${endX} ${middleY} ${endX} ${endY}`;
}

export function LearningRoadmaps() {
  const [activeId, setActiveId] = useState<LearningRoadmapId>("javascript");
  const [selectedNodeId, setSelectedNodeId] = useState("01");
  const [progress, setProgress] = useState<RoadmapProgress>(readProgress);
  const roadmap = learningRoadmapById.get(activeId) ?? learningRoadmaps[0];
  const completed = progress[roadmap.id];
  const selectedNode = roadmap.nodes.find((node) => node.id === selectedNodeId) ?? roadmap.nodes[0];
  const selectedPrerequisites = prerequisites(roadmap, selectedNode.id);
  const selectedComplete = completed.includes(selectedNode.id);
  const selectedReady = selectedPrerequisites.every((id) => completed.includes(id));
  const nextNode = useMemo(
    () => roadmap.nodes.find((node) => {
      if (completed.includes(node.id)) return false;
      return prerequisites(roadmap, node.id).every((id) => completed.includes(id));
    }),
    [completed, roadmap],
  );

  const selectRoadmap = (id: LearningRoadmapId) => {
    const nextRoadmap = learningRoadmapById.get(id) ?? learningRoadmaps[0];
    const nextCompleted = progress[id];
    const recommended = nextRoadmap.nodes.find((node) => {
      if (nextCompleted.includes(node.id)) return false;
      return prerequisites(nextRoadmap, node.id).every((prerequisite) => nextCompleted.includes(prerequisite));
    });
    setActiveId(id);
    setSelectedNodeId(recommended?.id ?? nextRoadmap.nodes[0].id);
  };

  const toggleSelectedNode = () => {
    if (!selectedReady && !selectedComplete) return;
    setProgress((current) => {
      const currentCompleted = current[roadmap.id];
      const nextCompleted = selectedComplete
        ? currentCompleted.filter((id) => !nodeAndDescendants(roadmap, selectedNode.id).has(id))
        : [...currentCompleted, selectedNode.id];
      const next = { ...current, [roadmap.id]: nextCompleted };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="learning-roadmaps-shell">
      <div className="learning-roadmap-tabs" role="tablist" aria-label="Learning roadmaps">
        {learningRoadmaps.map((item) => {
          const itemCompleted = progress[item.id].length;
          return (
            <button
              className={item.id === roadmap.id ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={item.id === roadmap.id}
              aria-controls="active-learning-roadmap"
              onClick={() => selectRoadmap(item.id)}
              key={item.id}
            >
              <span>{item.mark}</span>
              <b>{item.title}</b>
              <small>{itemCompleted}/{item.nodes.length}</small>
            </button>
          );
        })}
      </div>

      <section className="learning-roadmap-workspace" id="active-learning-roadmap" role="tabpanel" aria-label={`${roadmap.title} roadmap`}>
        <header className="learning-roadmap-header">
          <div>
            <p>{roadmap.subtitle}</p>
            <h3>{roadmap.title} Roadmap</h3>
            <span>{roadmap.outcome}</span>
          </div>
          <div className="learning-roadmap-progress">
            <b>{completed.length}/{roadmap.nodes.length}</b>
            <span>nodes complete</span>
            <progress aria-label={`${roadmap.title} roadmap progress`} max={roadmap.nodes.length} value={completed.length} />
          </div>
        </header>

        <div className="learning-roadmap-scroll">
          <div className="learning-roadmap-canvas">
            <svg className="learning-roadmap-edges" viewBox="0 0 1120 630" aria-hidden="true">
              <defs>
                <marker id="learning-roadmap-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" />
                </marker>
              </defs>
              {roadmap.edges.map((edge) => {
                const edgeReady = completed.includes(edge.from);
                const edgeDone = edgeReady && completed.includes(edge.to);
                return (
                  <path
                    className={edgeDone ? "done" : edgeReady ? "ready" : ""}
                    d={edgePath(roadmap, edge.from, edge.to)}
                    markerEnd="url(#learning-roadmap-arrow)"
                    key={`${edge.from}-${edge.to}`}
                  />
                );
              })}
            </svg>

            {roadmap.nodes.map((roadmapNode) => {
              const nodeComplete = completed.includes(roadmapNode.id);
              const nodeReady = prerequisites(roadmap, roadmapNode.id).every((id) => completed.includes(id));
              const status = nodeComplete ? "complete" : nodeReady ? "ready" : "locked";
              return (
                <button
                  className={`learning-roadmap-node ${status}${selectedNode.id === roadmapNode.id ? " active" : ""}`}
                  type="button"
                  aria-pressed={selectedNode.id === roadmapNode.id}
                  aria-label={`${roadmapNode.title}: ${status}`}
                  style={{ left: roadmapNode.position[0], top: roadmapNode.position[1] }}
                  onClick={() => setSelectedNodeId(roadmapNode.id)}
                  key={roadmapNode.id}
                >
                  <span>{roadmapNode.step}</span>
                  <b>{roadmapNode.title}</b>
                  <small>{nodeComplete ? "✓ COMPLETE" : nodeReady ? "READY →" : "LOCKED"}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="learning-roadmap-detail" aria-live="polite">
          <div className="learning-roadmap-detail-copy">
            <p>{selectedNode.step} · {selectedComplete ? "COMPLETE" : selectedReady ? "READY" : "LOCKED"}</p>
            <h3>{selectedNode.title}</h3>
            <span>{selectedNode.summary}</span>
            <div className="learning-roadmap-topics">
              {selectedNode.topics.map((topic) => <small key={topic}>{topic}</small>)}
            </div>
          </div>
          <aside>
            <p>PROOF OF LEARNING</p>
            <strong>{selectedNode.deliverable}</strong>
            <button
              className={selectedComplete ? "complete" : ""}
              type="button"
              disabled={!selectedReady && !selectedComplete}
              onClick={toggleSelectedNode}
            >
              {selectedComplete ? "✓ COMPLETED · REOPEN" : selectedReady ? "MARK NODE COMPLETE" : `COMPLETE ${selectedPrerequisites.join(" + ")} FIRST`}
            </button>
          </aside>
        </div>

        <footer className="learning-roadmap-footer">
          <div><b>NEXT RECOMMENDED</b><span>{nextNode ? `${nextNode.id} · ${nextNode.title}` : "ROADMAP COMPLETE"}</span></div>
          <nav aria-label={`${roadmap.title} roadmap resources`}>
            {roadmap.resources.map((resource) => (
              <a href={resource.url} target="_blank" rel="noopener noreferrer" key={resource.url}>{resource.label} ↗</a>
            ))}
          </nav>
        </footer>
      </section>
    </div>
  );
}
