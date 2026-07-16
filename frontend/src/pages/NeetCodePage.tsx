import { useMemo, useState } from "react";

import type { NeetCodeSnapshot } from "../types";

export function NeetCodePage({ snapshot }: { snapshot: NeetCodeSnapshot }) {
  const [topic, setTopic] = useState("Arrays & Hashing");
  const selected = useMemo(
    () => snapshot.problems.filter((problem) => problem.topic === topic),
    [snapshot.problems, topic],
  );
  const nextProblem = snapshot.problems.find((problem) => !snapshot.progress[problem.key]?.completed);
  return (
    <main>
      <section className="panel coach-block">
        <p className="eyebrow">DO NOW / OFFICIAL ORDER</p>
        <h1 className="page-title">{nextProblem?.title ?? "Loading problem bank…"}</h1>
        {nextProblem && <p>{nextProblem.topic} · {nextProblem.difficulty} · Python</p>}
        {nextProblem && <a className="primary-link" href={nextProblem.start_url} target="_blank" rel="noreferrer">OPEN NEETCODE ↗</a>}
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
        <h2>Legacy records / 现有记录</h2>
        <div className="history-list">
          {snapshot.problems.filter((problem) => snapshot.progress[problem.key]?.completed).map((problem) => (
            <details key={problem.key}><summary>{problem.title}<span>{snapshot.progress[problem.key].completed_at ?? "Completed"}</span></summary><pre>{snapshot.progress[problem.key].solution || "No solution saved."}</pre><p>{snapshot.progress[problem.key].reflection || "No reflection saved."}</p></details>
          ))}
        </div>
      </section>
    </main>
  );
}
