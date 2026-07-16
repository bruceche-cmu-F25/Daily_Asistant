import type { NeetCodeSnapshot } from "../types";
import { priorityResources, resourcesByCategory, type DashboardResource } from "../resources";

type Props = {
  snapshot: NeetCodeSnapshot;
  onOpenNeetCode: () => void;
};

export function HomePage({ snapshot, onOpenNeetCode }: Props) {
  const nextProblem = snapshot.problems.find((problem) => !snapshot.progress[problem.key]?.completed);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const renderResource = (resource: DashboardResource, compact = false) => (
    <a
      className={`resource-card accent-${resource.accent}${compact ? " compact" : ""}`}
      href={resource.url}
      key={resource.id}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="resource-mark" aria-hidden="true">{resource.mark}</span>
      <span className="resource-copy"><b>{resource.title}</b><small>{resource.subtitle}</small></span>
      <span className="resource-arrow" aria-hidden="true">↗</span>
    </a>
  );

  return (
    <main>
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">PERSONAL OPERATING SYSTEM // {today}</p>
          <h1>DAILY<br /><span>CONTROL</span></h1>
          <p>把今天真正要做的事情放到同一个控制台：刷题、投递、学习，一次只推进一件。</p>
          <p className="hero-links"><a href="https://www.notion.so/35ea5189545c80cfa8c3c910e0265817?source=copy_link" target="_blank" rel="noopener noreferrer">NOTION / 变得更强 ↗</a></p>
        </div>
        <div className="hero-readout">
          <div className="metrics">
            <article><b>{snapshot.summary.completed.toString().padStart(2, "0")}</b><span>NEETCODE DONE</span></article>
            <article><b>{snapshot.summary.total.toString().padStart(3, "0")}</b><span>PROBLEM BANK</span></article>
            <article><b>09</b><span>DAILY SYNC</span></article>
          </div>
          <div className="priority-strip">
            <div><b>01 / SOLVE</b><span>NeetCode official order</span></div>
            <div><b>02 / APPLY</b><span>New grad + internship</span></div>
            <div><b>03 / LEARN</b><span>Current weekly plan</span></div>
          </div>
        </div>
      </section>

      <section className="panel section-block quick-launch" id="quick-launch">
        <div className="section-heading">
          <div><p className="eyebrow">QUICK LAUNCH</p><h2>Start here / 高频入口</h2></div>
          <span className="section-note">CLICK ONE THING AND ACT</span>
        </div>
        <div className="resource-grid priority-grid">{priorityResources.map((resource) => renderResource(resource))}</div>
      </section>

      <div className="home-grid">
        <section className="panel section-block next-action">
          <p className="eyebrow">DO NOW / 刷题</p>
          <h2>Next in official order</h2>
          {nextProblem ? (
            <button className="action-card" type="button" onClick={onOpenNeetCode}>
              <span>NEETCODE 150</span>
              <b>{nextProblem.title}</b>
              <small>{nextProblem.topic} · open workspace →</small>
            </button>
          ) : <p>Problem bank is loading…</p>}
        </section>
        <section className="panel section-block" id="today-queue">
          <p className="eyebrow">TODAY / 今日队列</p>
          <h2>Todo & Calendar</h2>
          <p className="muted-copy">Calendar 和 Notion 的实时快照会在同步切片接入；现阶段继续由旧版稳定页读取。</p>
          <a className="text-link" href="https://calendar.google.com/calendar/u/0/r/day" target="_blank" rel="noopener noreferrer">OPEN GOOGLE CALENDAR ↗</a>
        </section>
      </div>

      <section className="panel section-block" id="job-resources">
        <div className="section-heading"><div><p className="eyebrow">OPPORTUNITY RADAR</p><h2>Job hunt / 投递入口</h2></div><span className="section-note">2027 NG + INTERNSHIP / CO-OP</span></div>
        <div className="resource-grid">{resourcesByCategory("jobs").map((resource) => renderResource(resource, true))}</div>
      </section>

      <section className="panel section-block" id="study-resources">
        <div className="section-heading"><div><p className="eyebrow">LEARNING TRAJECTORY</p><h2>Study resources / 学习资源</h2></div><span className="section-note">USE WHEN BLOCKED</span></div>
        <div className="resource-grid">{resourcesByCategory("study").map((resource) => renderResource(resource, true))}</div>
      </section>

      <section className="panel section-block compact-resources" id="utility-links">
        <div className="section-heading"><div><p className="eyebrow">UTILITY ARCHIVE</p><h2>Profiles & tools / 备用入口</h2></div></div>
        <div className="resource-grid">{[...resourcesByCategory("profile"), ...resourcesByCategory("tools")].map((resource) => renderResource(resource, true))}</div>
      </section>
    </main>
  );
}
