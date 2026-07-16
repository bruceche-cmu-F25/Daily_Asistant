import type { NeetCodeSnapshot } from "../types";

type Props = {
  snapshot: NeetCodeSnapshot;
  onOpenNeetCode: () => void;
};

export function HomePage({ snapshot, onOpenNeetCode }: Props) {
  const nextProblem = snapshot.problems.find((problem) => !snapshot.progress[problem.key]?.completed);
  return (
    <main>
      <section className="hero panel">
        <div>
          <p className="eyebrow">PERSONAL OPERATING SYSTEM // V2 MIGRATION</p>
          <h1>DAILY<br /><span>CONTROL</span></h1>
          <p>Today、Todo、Calendar、求职入口与资源将保留在这一页。</p>
        </div>
        <div className="metrics">
          <article><b>{snapshot.summary.completed.toString().padStart(2, "0")}</b><span>NEETCODE DONE</span></article>
          <article><b>{snapshot.summary.total.toString().padStart(3, "0")}</b><span>PROBLEM BANK</span></article>
          <article><b>09</b><span>DAILY SYNC</span></article>
        </div>
      </section>
      <section className="panel section-block">
        <p className="eyebrow">NEXT ACTION</p>
        <h2>Start here / 从这里开始</h2>
        {nextProblem ? (
          <button className="action-card" type="button" onClick={onOpenNeetCode}>
            <span>NEETCODE NEXT</span>
            <b>{nextProblem.title}</b>
            <small>{nextProblem.topic} · official order</small>
          </button>
        ) : <p>Problem bank is loading…</p>}
      </section>
      <div className="two-column">
        <section className="panel section-block"><p className="eyebrow">TODAY</p><h2>Todo & Calendar</h2><p>第二切片将从本地同步快照读取真实 Calendar 和 Notion 数据。</p></section>
        <section className="panel section-block"><p className="eyebrow">RESOURCES</p><h2>Quick launch</h2><p>全局资源索引将在交互切片迁移，不改变现有入口。</p></section>
      </div>
    </main>
  );
}
