import { useEffect, useMemo, useState } from "react";

import { createAttempt, loadWorkspace, saveWorkingDraft } from "../api";
import type { AttemptStatus, NeetCodeSnapshot, Problem, ProblemAttempt } from "../types";

type Props = {
  snapshot: NeetCodeSnapshot;
  onRefresh: () => void;
};

const ROADMAP_POSITIONS: Record<string, [number, number]> = {
  "Arrays & Hashing": [440, 20],
  "Two Pointers": [240, 120],
  Stack: [640, 120],
  "Binary Search": [50, 220],
  "Sliding Window": [260, 220],
  "Linked List": [600, 220],
  Trees: [440, 320],
  Tries: [40, 420],
  "Heap / Priority Queue": [250, 420],
  Backtracking: [670, 420],
  Intervals: [20, 550],
  Greedy: [210, 550],
  "Advanced Graphs": [400, 550],
  Graphs: [590, 550],
  "1-D Dynamic Programming": [780, 550],
  "2-D Dynamic Programming": [580, 670],
  "Bit Manipulation": [790, 670],
  "Math & Geometry": [690, 770],
};

const ROADMAP_EDGES = [
  "M530 86 C530 104 330 102 330 120",
  "M530 86 C530 104 730 102 730 120",
  "M330 186 C330 205 140 201 140 220",
  "M330 186 C330 205 350 201 350 220",
  "M330 186 C330 205 690 201 690 220",
  "M140 286 C140 306 530 300 530 320",
  "M690 286 C690 306 530 300 530 320",
  "M530 386 C530 406 130 400 130 420",
  "M530 386 C530 406 340 400 340 420",
  "M530 386 C530 406 760 400 760 420",
  "M340 486 C340 515 110 515 110 550",
  "M340 486 C340 515 300 515 300 550",
  "M340 486 C340 515 490 515 490 550",
  "M760 486 C760 515 680 515 680 550",
  "M760 486 C760 515 870 515 870 550",
  "M680 616 C680 641 670 641 670 670",
  "M870 616 C870 641 670 641 670 670",
  "M870 616 C870 641 880 641 880 670",
  "M670 736 C670 758 780 750 780 770",
  "M880 736 C880 758 780 750 780 770",
];

function formatAttemptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return !Number.isNaN(date.getTime()) && date.toDateString() === today.toDateString();
}

function TopicRoadmap({
  snapshot,
  topic,
  onTopicChange,
  onPractice,
}: {
  snapshot: NeetCodeSnapshot;
  topic: string;
  onTopicChange: (topic: string) => void;
  onPractice: (problem: Problem) => void;
}) {
  const selected = snapshot.problems.filter((problem) => problem.topic === topic);
  const selectedCompleted = selected.filter((problem) => snapshot.progress[problem.key]?.completed).length;

  return (
    <section className="panel section-block roadmap" aria-label="NeetCode 150 topic graph">
      <div className="roadmap-head">
        <div>
          <p className="eyebrow">NEETCODE 150 / ALL PROBLEMS</p>
          <h2>Roadmap / 路线图</h2>
        </div>
        <div className="roadmap-total"><b>{snapshot.summary.completed}</b><span>/ {snapshot.summary.total} complete</span></div>
      </div>
      <p className="roadmap-copy">按 NeetCode 的依赖顺序浏览 Topic。点击节点查看完整题单，也可以从任意旧题开始新的 attempt。</p>
      <div className="roadmap-scroll">
        <div className="roadmap-canvas">
          <svg className="roadmap-edges" viewBox="0 0 1060 850" aria-hidden="true">
            <defs>
              <marker id="roadmap-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0 0 L8 4 L0 8 z" />
              </marker>
            </defs>
            {ROADMAP_EDGES.map((path) => <path d={path} key={path} markerEnd="url(#roadmap-arrow)" />)}
          </svg>
          {snapshot.topics.map((item) => {
            const position = ROADMAP_POSITIONS[item.name];
            if (!position) return null;
            const complete = item.total > 0 && item.completed === item.total;
            return (
              <button
                aria-pressed={topic === item.name}
                aria-label={`${item.name}: ${item.completed} of ${item.total} completed`}
                className={`roadmap-node${topic === item.name ? " active" : ""}${complete ? " complete" : ""}`}
                key={item.name}
                style={{ left: position[0], top: position[1] }}
                type="button"
                onClick={() => onTopicChange(item.name)}
              >
                <span>{item.name}</span><b>{item.completed}/{item.total}</b>
                <progress aria-label={`${item.name} progress`} max={item.total || 1} value={item.completed} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="roadmap-list-panel" aria-live="polite">
        <div className="roadmap-list-head">
          <div><span>SELECTED TOPIC</span><h3>{topic}</h3></div>
          <b>{selectedCompleted} / {selected.length}</b>
        </div>
        <ol className="roadmap-problem-list">
          {selected.map((problem, index) => {
            const progress = snapshot.progress[problem.key];
            return (
              <li className={progress?.completed ? "done" : ""} key={problem.key}>
                <span className="roadmap-problem-marker">{progress?.completed ? "✓" : String(index + 1).padStart(2, "0")}</span>
                <div>
                  <a href={problem.start_url} target="_blank" rel="noreferrer">{problem.title}</a>
                  <span>{problem.difficulty} · {problem.minutes} min · {progress?.attempt_count || 0} attempts</span>
                </div>
                <button type="button" onClick={() => onPractice(problem)}>DO NOW</button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function ProblemHistory({ snapshot }: { snapshot: NeetCodeSnapshot }) {
  const problemByKey = useMemo(
    () => new Map(snapshot.problems.map((problem) => [problem.key, problem])),
    [snapshot.problems],
  );
  const attemptsByProblem = useMemo(() => {
    const grouped = new Map<string, ProblemAttempt[]>();
    snapshot.attempts.forEach((attempt) => {
      const attempts = grouped.get(attempt.problem_key) || [];
      attempts.push(attempt);
      grouped.set(attempt.problem_key, attempts);
    });
    return [...grouped.entries()];
  }, [snapshot.attempts]);
  const todayCount = snapshot.attempts.filter((attempt) => isToday(attempt.created_at)).length;

  return (
    <section className="panel section-block problem-history" id="history" aria-label="Problem history">
      <div className="history-head">
        <div>
          <p className="eyebrow">LOCAL PROBLEM DATABASE</p>
          <h2>History / 刷题记录</h2>
          <p>按 Topic 看 NeetCode 150 进度；每道题会保留所有 attempts、Python solution 和心得。</p>
        </div>
        <div className="history-stats" aria-label="Problem history summary">
          <div><b>{snapshot.summary.completed}</b><span>completed</span></div>
          <div><b>{snapshot.summary.total}</b><span>total</span></div>
          <div><b>{snapshot.summary.stuck}</b><span>stuck</span></div>
          <div><b>{snapshot.attempts.length}</b><span>attempts</span></div>
          <div><b>{todayCount}</b><span>today</span></div>
        </div>
      </div>
      <div className="history-topic-grid">
        {snapshot.topics.map((item) => (
          <article className="history-topic" key={item.name}>
            <div><b>{item.name}</b><span>{item.completed}/{item.total}</span></div>
            <progress aria-label={`${item.name}: ${item.completed} of ${item.total}`} max={item.total || 1} value={item.completed} />
          </article>
        ))}
      </div>
      <div className="problem-history-list">
        {attemptsByProblem.map(([problemKey, attempts]) => {
          const problem = problemByKey.get(problemKey);
          const solved = attempts.some((attempt) => attempt.status === "solved");
          return (
            <article className={`history-entry${solved ? " solved" : ""}`} key={problemKey}>
              <div className="history-entry-top">
                <div>
                  {problem ? <a href={problem.start_url} target="_blank" rel="noreferrer">{problem.title}</a> : <b>{problemKey}</b>}
                  <span>{problem?.topic || "Unknown topic"} · {problem?.difficulty || ""} · latest {formatAttemptDate(attempts[0].created_at)}</span>
                </div>
                <b>{attempts.length} {attempts.length === 1 ? "ATTEMPT" : "ATTEMPTS"}</b>
              </div>
              <div className="attempt-timeline">
                {attempts.map((attempt, index) => (
                  <details key={attempt.id}>
                    <summary>
                      <span>ATTEMPT {attempts.length - index} · {attempt.status.toUpperCase()} · {attempt.language.toUpperCase()}</span>
                      <time dateTime={attempt.created_at}>{formatAttemptDate(attempt.created_at)}</time>
                    </summary>
                    <div className="history-notes">
                      <b>SOLUTION</b>
                      <pre>{attempt.solution || "No solution saved."}</pre>
                      <b>REFLECTION / 心得</b>
                      <p>{attempt.reflection || "No reflection saved."}</p>
                    </div>
                  </details>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {!attemptsByProblem.length && <p className="problem-history-empty">还没有刷题记录。完成第一道题后会出现在这里。</p>}
    </section>
  );
}

export function NeetCodePage({ snapshot, onRefresh }: Props) {
  const [topic, setTopic] = useState("Arrays & Hashing");
  const [budget, setBudget] = useState(30);
  const [activeProblemKey, setActiveProblemKey] = useState("");
  const [completionOpen, setCompletionOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingProblems = snapshot.problems.filter((problem) => !snapshot.progress[problem.key]?.completed);
  const fittingProblems = pendingProblems.filter((problem) => problem.minutes <= budget);
  const suggestedProblem = fittingProblems[0] || pendingProblems[0];
  const activeProblem = snapshot.problems.find((problem) => problem.key === activeProblemKey) || suggestedProblem;
  const [solution, setSolution] = useState("");
  const [reflection, setReflection] = useState("");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [saveState, setSaveState] = useState("Ready");
  const [saving, setSaving] = useState(false);
  const todaySolved = snapshot.attempts.filter((attempt) => attempt.status === "solved" && isToday(attempt.created_at)).length;
  const upcomingPool = fittingProblems.length ? fittingProblems : pendingProblems;
  const upcoming = upcomingPool.filter((problem) => problem.key !== activeProblem?.key).slice(0, 2);

  useEffect(() => {
    if (!activeProblem) return;
    let active = true;
    setWorkspaceReady(false);
    loadWorkspace(activeProblem.key).then((workspace) => {
      if (!active) return;
      setSolution(workspace.draft?.solution || "");
      setReflection(workspace.draft?.reflection || "");
      setWorkspaceReady(true);
      setSaveState(workspace.draft ? "Draft restored" : `${workspace.attempts.length} previous attempts`);
    }).catch((reason: unknown) => {
      if (active) setSaveState(reason instanceof Error ? reason.message : "Workspace unavailable");
    });
    return () => { active = false; };
  }, [activeProblem?.key]);

  useEffect(() => {
    setCompletionOpen(false);
    setHelpOpen(false);
  }, [activeProblem?.key]);

  useEffect(() => {
    if (!activeProblem || !workspaceReady || (!solution && !reflection)) return;
    setSaveState("Saving draft…");
    const timeout = window.setTimeout(() => {
      saveWorkingDraft(activeProblem.key, { language: "python", solution, reflection })
        .then(() => setSaveState("Draft saved"))
        .catch(() => setSaveState("Draft save failed"));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [activeProblem?.key, reflection, solution, workspaceReady]);

  const submitAttempt = async (status: AttemptStatus) => {
    if (!activeProblem || saving) return;
    if (status === "solved" && !solution.trim()) {
      setSaveState("Solution is required for Solved");
      return;
    }
    setSaving(true);
    setSaveState(`Saving ${status}…`);
    try {
      await createAttempt(activeProblem.key, { status, language: "python", solution, reflection });
      if (status !== "draft") {
        setSolution("");
        setReflection("");
      }
      if (status === "solved") {
        setCompletionOpen(false);
        setActiveProblemKey("");
      }
      setSaveState(`${status[0].toUpperCase()}${status.slice(1)} attempt saved`);
      onRefresh();
    } catch (reason) {
      setSaveState(reason instanceof Error ? reason.message : "Attempt save failed");
    } finally {
      setSaving(false);
    }
  };

  const practiceProblem = (problem: Problem) => {
    setActiveProblemKey(problem.key);
    setTopic(problem.topic);
    setCompletionOpen(false);
    setHelpOpen(false);
    window.requestAnimationFrame(() => {
      const workspace = document.getElementById("problem-workspace");
      if (typeof workspace?.scrollIntoView === "function") {
        workspace.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const skipProblem = () => {
    if (!activeProblem || !upcomingPool.length) return;
    const currentIndex = upcomingPool.findIndex((problem) => problem.key === activeProblem.key);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % upcomingPool.length;
    practiceProblem(upcomingPool[nextIndex]);
  };

  const markStuck = async () => {
    setHelpOpen(true);
    await submitAttempt("stuck");
  };

  return (
    <main className="neetcode-page">
      <section className="panel coach-block problem-coach" id="problem-workspace" aria-label="Problem coach">
        <div className="problem-coach-head">
          <div>
            <p className="eyebrow">PROBLEM COACH</p>
            <h1>Do Now / 现在刷这题</h1>
            <p>一次只做一道 NeetCode 150。做完以后再记录 solution 和心得，全部只保存在这台 Mac。</p>
          </div>
          <div className="coach-today"><b>{todaySolved}</b><span>problems today</span></div>
        </div>
        <div className="time-budget" role="group" aria-label="Available problem-solving time">
          <span>我现在有</span>
          {[15, 30, 45, 60].map((minutes) => (
            <button
              className={budget === minutes ? "active" : ""}
              key={minutes}
              type="button"
              onClick={() => { setBudget(minutes); setActiveProblemKey(""); }}
            >
              {minutes} MIN
            </button>
          ))}
        </div>
        {activeProblem && (
          <article className="do-now-card">
            <div className="do-now-main">
              <div className="problem-badges">
                <span>{activeProblem.topic}</span>
                <span className={`difficulty-${activeProblem.difficulty.toLowerCase()}`}>{activeProblem.difficulty}</span>
                <span>{activeProblem.minutes} MIN</span>
              </div>
              <h2>{activeProblem.title}</h2>
              <p>{activeProblem.why || `推进 NeetCode 150 的 ${activeProblem.topic} 路线，一次只解决一道题。`}</p>
              <div className="coach-actions">
                <a href={activeProblem.start_url} target="_blank" rel="noreferrer">OPEN PROBLEM / 开始刷题</a>
                <button type="button" disabled={saving} onClick={markStuck}>不会做 / 卡住了</button>
                <button className="finish" type="button" onClick={() => setCompletionOpen(true)}>完成并写心得</button>
                <button type="button" onClick={skipProblem}>换一题</button>
              </div>
              {helpOpen && (
                <div className="coach-help">
                  <b>IF STUCK / 先别看答案</b>
                  <ol>
                    <li>手写一个输入输出例子，确认自己理解题意。</li>
                    <li>{activeProblem.starter || "先写暴力解法，再确定需要的数据结构。"}</li>
                    <li>仍然卡住时再看 NeetCode 提示，然后自己重写。</li>
                  </ol>
                </div>
              )}
            </div>
            <aside className="done-when">
              <b>DONE WHEN</b>
              <p>{activeProblem.done_when || "独立通过全部测试，并写下复杂度、核心思路和一个容易出错的点。"}</p>
              <span>{snapshot.progress[activeProblem.key]?.attempt_count || 0} previous attempts</span>
            </aside>
          </article>
        )}
        {!activeProblem && (
          <div className="coach-complete">
            <b>NeetCode 150 已经全部完成。</b>
            <span>可以从 Roadmap 选择旧题开始新的 attempt。</span>
          </div>
        )}
        <div className="coach-up-next">
          <b>UP NEXT</b>
          <ol>
            {upcoming.map((problem) => (
              <li key={problem.key}>
                <button type="button" onClick={() => practiceProblem(problem)}>
                  <strong>{problem.title}</strong>
                  <span>{problem.difficulty} · {problem.topic}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <TopicRoadmap snapshot={snapshot} topic={topic} onTopicChange={setTopic} onPractice={practiceProblem} />
      <ProblemHistory snapshot={snapshot} />
      {completionOpen && activeProblem && (
        <div className="completion-backdrop">
          <section className="completion-dialog" role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title">
            <div className="completion-dialog-head">
              <div><p className="eyebrow">COMPLETE ATTEMPT</p><h2 id="completion-dialog-title">保存刷题记录</h2></div>
              <button type="button" aria-label="关闭保存窗口" onClick={() => setCompletionOpen(false)}>×</button>
            </div>
            <p className="completion-problem">{activeProblem.title} · {activeProblem.topic} · {saveState}</p>
            <label htmlFor="solution-editor">Solution is required to mark Solved</label>
            <textarea
              id="solution-editor"
              value={solution}
              onChange={(event) => setSolution(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                event.preventDefault();
                const start = event.currentTarget.selectionStart;
                const end = event.currentTarget.selectionEnd;
                setSolution(`${solution.slice(0, start)}    ${solution.slice(end)}`);
              }}
              rows={14}
              spellCheck={false}
              placeholder="def solution(...):"
              autoFocus
            />
            <label htmlFor="reflection-editor">Reflection / 心得（可选）</label>
            <textarea id="reflection-editor" value={reflection} onChange={(event) => setReflection(event.target.value)} rows={4} placeholder="核心模式、复杂度、容易错的点…" />
            <div className="completion-actions">
              <button type="button" onClick={() => setCompletionOpen(false)}>CANCEL</button>
              <button type="button" disabled={saving || (!solution && !reflection)} onClick={() => submitAttempt("draft")}>SAVE DRAFT</button>
              <button className="solved" type="button" disabled={saving || !solution.trim()} onClick={() => submitAttempt("solved")}>MARK SOLVED</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
