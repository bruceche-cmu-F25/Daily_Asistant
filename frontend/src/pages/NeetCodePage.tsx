import { useEffect, useMemo, useState } from "react";

import { createAttempt, loadWorkspace, saveWorkingDraft } from "../api";
import type { AttemptStatus, NeetCodeSnapshot } from "../types";

type Props = {
  snapshot: NeetCodeSnapshot;
  onRefresh: () => void;
};

export function NeetCodePage({ snapshot, onRefresh }: Props) {
  const [topic, setTopic] = useState("Arrays & Hashing");
  const [solution, setSolution] = useState("");
  const [reflection, setReflection] = useState("");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [saveState, setSaveState] = useState("Ready");
  const [saving, setSaving] = useState(false);
  const selected = useMemo(
    () => snapshot.problems.filter((problem) => problem.topic === topic),
    [snapshot.problems, topic],
  );
  const nextProblem = snapshot.problems.find((problem) => !snapshot.progress[problem.key]?.completed);
  const titles = useMemo(
    () => Object.fromEntries(snapshot.problems.map((problem) => [problem.key, problem.title])),
    [snapshot.problems],
  );

  useEffect(() => {
    if (!nextProblem) return;
    let active = true;
    setWorkspaceReady(false);
    loadWorkspace(nextProblem.key).then((workspace) => {
      if (!active) return;
      setSolution(workspace.draft?.solution || "");
      setReflection(workspace.draft?.reflection || "");
      setWorkspaceReady(true);
      setSaveState(workspace.draft ? "Draft restored" : "Ready");
    }).catch((reason: unknown) => {
      if (active) setSaveState(reason instanceof Error ? reason.message : "Workspace unavailable");
    });
    return () => { active = false; };
  }, [nextProblem?.key]);

  useEffect(() => {
    if (!nextProblem || !workspaceReady || (!solution && !reflection)) return;
    setSaveState("Saving draft…");
    const timeout = window.setTimeout(() => {
      saveWorkingDraft(nextProblem.key, { language: "python", solution, reflection })
        .then(() => setSaveState("Draft saved"))
        .catch(() => setSaveState("Draft save failed"));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [nextProblem?.key, reflection, solution, workspaceReady]);

  const submitAttempt = async (status: AttemptStatus) => {
    if (!nextProblem || saving) return;
    if (status === "solved" && !solution.trim()) {
      setSaveState("Solution is required for Solved");
      return;
    }
    setSaving(true);
    setSaveState(`Saving ${status}…`);
    try {
      await createAttempt(nextProblem.key, { status, language: "python", solution, reflection });
      if (status !== "draft") {
        setSolution("");
        setReflection("");
      }
      setSaveState(`${status[0].toUpperCase()}${status.slice(1)} attempt saved`);
      onRefresh();
    } catch (reason) {
      setSaveState(reason instanceof Error ? reason.message : "Attempt save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <section className="panel coach-block">
        <p className="eyebrow">DO NOW / OFFICIAL ORDER</p>
        <h1 className="page-title">{nextProblem?.title ?? "NeetCode 150 complete"}</h1>
        {nextProblem && <p>{nextProblem.topic} · {nextProblem.difficulty} · Python</p>}
        {nextProblem && <a className="primary-link" href={nextProblem.start_url} target="_blank" rel="noreferrer">OPEN NEETCODE ↗</a>}
        {nextProblem && (
          <div className="solution-workspace">
            <div className="workspace-heading"><div><p className="eyebrow">PYTHON WORKSPACE</p><h2>Solution / 解法</h2></div><span>{saveState}</span></div>
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
            />
            <label htmlFor="reflection-editor">Reflection / 心得（可选）</label>
            <textarea id="reflection-editor" value={reflection} onChange={(event) => setReflection(event.target.value)} rows={4} placeholder="核心模式、复杂度、容易错的点…" />
            <div className="workspace-actions">
              <button type="button" disabled={saving || (!solution && !reflection)} onClick={() => submitAttempt("draft")}>SAVE DRAFT</button>
              <button type="button" disabled={saving} onClick={() => submitAttempt("stuck")}>SAVE AS STUCK</button>
              <button className="solved" type="button" disabled={saving || !solution.trim()} onClick={() => submitAttempt("solved")}>MARK SOLVED</button>
            </div>
          </div>
        )}
      </section>
      <section className="panel section-block">
        <div className="section-heading"><div><p className="eyebrow">NEETCODE 150</p><h2>Roadmap / 路线图</h2></div><b>{snapshot.summary.completed}/{snapshot.summary.total}</b></div>
        <div className="topic-grid">
          {snapshot.topics.map((item) => (
            <button className={topic === item.name ? "active" : ""} key={item.name} type="button" onClick={() => setTopic(item.name)}>
              <span>{item.name}</span><b>{item.completed}/{item.total}</b>
              <progress max={item.total} value={item.completed} />
            </button>
          ))}
        </div>
      </section>
      <section className="panel section-block">
        <div className="section-heading"><h2>{topic}</h2><b>{selected.filter((item) => snapshot.progress[item.key]?.completed).length}/{selected.length}</b></div>
        <ol className="problem-list">
          {selected.map((problem) => {
            const done = snapshot.progress[problem.key]?.completed;
            return <li className={done ? "done" : ""} key={problem.key}><span>{done ? "✓" : "·"}</span><a href={problem.start_url} target="_blank" rel="noreferrer">{problem.title}</a><small>{problem.difficulty}</small></li>;
          })}
        </ol>
      </section>
      <section className="panel section-block">
        <p className="eyebrow">ATTEMPT HISTORY</p>
        <h2>All attempts / 全部记录</h2>
        <div className="history-list">
          {snapshot.attempts.map((attempt) => (
            <details key={attempt.id}>
              <summary><span><b>{titles[attempt.problem_key] || attempt.problem_key}</b> · {attempt.status.toUpperCase()}</span><span>{attempt.created_at}</span></summary>
              <pre>{attempt.solution || "No solution saved."}</pre>
              <p>{attempt.reflection || "No reflection saved."}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
