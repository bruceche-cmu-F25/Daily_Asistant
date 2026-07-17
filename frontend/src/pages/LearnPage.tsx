import { useEffect, useMemo, useState } from "react";

type CourseId = "react" | "typescript";

type CourseProgress = {
  sessions: string[];
  note: string;
};

type LearningProgress = Record<CourseId, CourseProgress>;

const STORAGE_KEY = "daily-dashboard:learning-progress:v1";
const emptyProgress: LearningProgress = {
  react: { sessions: [], note: "" },
  typescript: { sessions: [], note: "" },
};

const courses = {
  react: {
    mark: "RE",
    title: "React + JavaScript",
    provider: "freeCodeCamp.org",
    description: "组件、props、state、hooks，并把每一段知识用在真实项目里。",
    embedUrl: "https://www.youtube-nocookie.com/embed/bMknfKXIFA8?rel=0",
    primaryUrl: "https://www.freecodecamp.org/learn/front-end-development-libraries/#react",
    primaryLabel: "OPEN FCC CHALLENGES",
    secondaryUrl: "https://react.dev/learn",
    secondaryLabel: "REACT DOCS",
    proof: "在 Daily Assistant 或 portfolio 里完成一个可演示的 React 组件并提交 commit。",
  },
  typescript: {
    mark: "TS",
    title: "Advanced TypeScript",
    provider: "Matt Pocock · YouTube",
    description: "Generics、类型推断和高级模式，直接对应 React + TypeScript 项目。",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLIvujZeVDLMx040-j1W4WFs1BxuTGdI_b&rel=0",
    primaryUrl: "https://www.youtube.com/watch?v=lMfGp29Ht8c&list=PLIvujZeVDLMx040-j1W4WFs1BxuTGdI_b",
    primaryLabel: "OPEN PLAYLIST",
    secondaryUrl: "https://www.typescriptlang.org/docs/",
    secondaryLabel: "TS DOCS",
    proof: "把今天学到的类型模式用到一个现有组件，确保 typecheck 通过并提交 commit。",
  },
} as const;

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function learningStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readProgress(): LearningProgress {
  try {
    const raw = learningStorage()?.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress;
    const parsed = JSON.parse(raw) as Partial<Record<CourseId, Partial<CourseProgress>>>;
    return {
      react: {
        sessions: Array.isArray(parsed.react?.sessions) ? parsed.react.sessions.filter((item): item is string => typeof item === "string") : [],
        note: typeof parsed.react?.note === "string" ? parsed.react.note : "",
      },
      typescript: {
        sessions: Array.isArray(parsed.typescript?.sessions) ? parsed.typescript.sessions.filter((item): item is string => typeof item === "string") : [],
        note: typeof parsed.typescript?.note === "string" ? parsed.typescript.note : "",
      },
    };
  } catch {
    return emptyProgress;
  }
}

function learningStreak(progress: LearningProgress, today: string) {
  const studied = new Set([...progress.react.sessions, ...progress.typescript.sessions]);
  const cursor = new Date(`${today}T12:00:00`);
  let streak = 0;
  while (studied.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function LearnPage() {
  const [activeId, setActiveId] = useState<CourseId>("react");
  const [progress, setProgress] = useState<LearningProgress>(readProgress);
  const today = localDate();
  const activeCourse = courses[activeId];
  const doneToday = progress[activeId].sessions.includes(today);
  const sessionsToday = (Object.keys(courses) as CourseId[]).filter((id) => progress[id].sessions.includes(today)).length;
  const totalSessions = progress.react.sessions.length + progress.typescript.sessions.length;
  const streak = useMemo(() => learningStreak(progress, today), [progress, today]);

  useEffect(() => {
    learningStorage()?.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const toggleToday = () => {
    setProgress((current) => {
      const sessions = current[activeId].sessions;
      return {
        ...current,
        [activeId]: {
          ...current[activeId],
          sessions: sessions.includes(today) ? sessions.filter((date) => date !== today) : [...sessions, today],
        },
      };
    });
  };

  const saveNote = (note: string) => {
    setProgress((current) => ({
      ...current,
      [activeId]: { ...current[activeId], note },
    }));
  };

  return (
    <main className="learn-page">
      <section className="panel learn-hero">
        <div>
          <p className="eyebrow">LEARN / BUILD / PROVE</p>
          <h1>Learning<br /><span>Lab</span></h1>
          <p>目标不是“看完课程”，而是每天学一小段、写一点代码，再把成果变成可以在面试里展示的证据。</p>
          <span className="learn-local">本机保存进度 · 不上传学习笔记</span>
        </div>
        <div className="learn-stats" aria-label="Learning summary">
          <div><b>{sessionsToday.toString().padStart(2, "0")}</b><span>sessions today</span></div>
          <div><b>{streak.toString().padStart(2, "0")}</b><span>day streak</span></div>
          <div><b>{totalSessions.toString().padStart(2, "0")}</b><span>total sessions</span></div>
        </div>
      </section>

      <section className="panel learn-section" aria-labelledby="learning-tracks-title">
        <div className="learn-heading">
          <div><p className="eyebrow">01 / CHOOSE A TRACK</p><h2 id="learning-tracks-title">Today / 今天学哪个</h2></div>
          <span>一次只推进一门课</span>
        </div>
        <div className="learning-track-grid">
          {(Object.keys(courses) as CourseId[]).map((id) => {
            const course = courses[id];
            const completed = progress[id].sessions.includes(today);
            return (
              <button className={activeId === id ? "active" : ""} type="button" aria-pressed={activeId === id} onClick={() => setActiveId(id)} key={id}>
                <span>{course.mark}</span>
                <div><b>{course.title}</b><small>{course.provider}</small><p>{course.description}</p></div>
                <i>{completed ? "DONE TODAY" : `${progress[id].sessions.length} SESSIONS`}</i>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel learn-section learning-workspace" aria-labelledby="learning-workspace-title">
        <div className="learn-heading">
          <div><p className="eyebrow">02 / WATCH + CODE</p><h2 id="learning-workspace-title">{activeCourse.title}</h2></div>
          <span>{activeCourse.provider}</span>
        </div>
        <div className="learning-workspace-grid">
          <div className="course-player">
            <iframe
              src={activeCourse.embedUrl}
              title={`${activeCourse.title} course player`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <aside className="learning-session-card">
            <p className="eyebrow">TODAY'S LOOP</p>
            <ol>
              <li><b>WATCH</b><span>只推进一个清楚的小节。</span></li>
              <li><b>CODE</b><span>关掉视频，自己重新写一遍。</span></li>
              <li><b>PROVE</b><span>{activeCourse.proof}</span></li>
            </ol>
            <button className={doneToday ? "done" : ""} type="button" onClick={toggleToday}>{doneToday ? "✓ DONE TODAY / 已完成" : "MARK TODAY DONE / 完成今天"}</button>
          </aside>
        </div>
        <div className="learning-resource-row">
          <a href={activeCourse.primaryUrl} target="_blank" rel="noopener noreferrer">{activeCourse.primaryLabel} ↗</a>
          <a href={activeCourse.secondaryUrl} target="_blank" rel="noopener noreferrer">{activeCourse.secondaryLabel} ↗</a>
          {activeId === "react" && <p>freeCodeCamp 挑战站禁止第三方 iframe；上方嵌入的是 freeCodeCamp 官方 React 视频，挑战练习请用按钮打开原站。</p>}
        </div>
      </section>

      <section className="panel learn-section learning-notes" aria-labelledby="learning-notes-title">
        <div className="learn-heading">
          <div><p className="eyebrow">03 / RETAIN</p><h2 id="learning-notes-title">One useful note / 今天记住什么</h2></div>
          <span>保存在这台 Mac 的浏览器</span>
        </div>
        <textarea
          value={progress[activeId].note}
          onChange={(event) => saveNote(event.target.value)}
          aria-label={`${activeCourse.title} learning note`}
          placeholder="用自己的话写：今天学到了什么？它能在哪个项目里使用？"
          rows={5}
        />
      </section>

      <section className="panel learn-section career-loop" aria-labelledby="career-loop-title">
        <div className="learn-heading"><div><p className="eyebrow">04 / TURN LEARNING INTO SIGNAL</p><h2 id="career-loop-title">Job-ready loop / 让学习帮助求职</h2></div></div>
        <div className="career-loop-grid">
          <article><span>01</span><b>Learn</b><p>每天只学一个可复述的概念。</p></article>
          <article><span>02</span><b>Build</b><p>当天放进 Daily Assistant 或 portfolio。</p></article>
          <article><span>03</span><b>Ship</b><p>留下 commit、截图或可访问页面。</p></article>
          <article><span>04</span><b>Explain</b><p>准备两句话说明取舍、bug 和结果。</p></article>
        </div>
      </section>
    </main>
  );
}
