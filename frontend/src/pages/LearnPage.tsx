import { useEffect, useMemo, useState } from "react";

type CourseId = "javascript" | "typescript";
type LegacyCourseId = CourseId | "react";

type CourseProgress = {
  sessions: string[];
};

type LearningProgress = Record<CourseId, CourseProgress>;
type ProjectId = "slice" | "backend" | "quality";
type ProjectProgress = Record<ProjectId, string[]>;

const STORAGE_KEY = "daily-dashboard:learning-progress:v1";
const PROJECT_GYM_STORAGE_KEY = "daily-dashboard:project-gym:v1";
const emptyProgress: LearningProgress = {
  javascript: { sessions: [] },
  typescript: { sessions: [] },
};

const courses = {
  javascript: {
    mark: "JS",
    title: "JavaScript Foundations",
    provider: "freeCodeCamp.org",
    description: "先用项目式挑战掌握变量、函数、数组、对象、DOM 和算法基础。",
    embedUrl: "https://www.youtube-nocookie.com/embed/jS4aFq5-91M?rel=0",
    primaryUrl: "https://www.freecodecamp.org/learn/javascript-v9/",
    primaryLabel: "OPEN FCC JAVASCRIPT",
    secondaryUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
    secondaryLabel: "MDN JS GUIDE",
    proof: "不看答案独立完成今天的 freeCodeCamp challenge，再用自己的话解释核心概念。",
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

const learningResourceGroups = [
  {
    eyebrow: "START HERE",
    title: "freeCodeCamp path",
    description: "先打牢 JavaScript，再进入前端库、后端 API 和数据库。",
    resources: [
      { mark: "JS", title: "JavaScript V9", provider: "freeCodeCamp", description: "项目式练习 JavaScript 核心语法、DOM、算法和数据结构。", url: "https://www.freecodecamp.org/learn/javascript-v9/" },
      { mark: "FE", title: "Front End Development Libraries V9", provider: "freeCodeCamp", description: "继续学习 React、状态管理和现代前端组件开发。", url: "https://www.freecodecamp.org/learn/front-end-development-libraries-v9/" },
      { mark: "API", title: "Back End Development and APIs", provider: "freeCodeCamp", description: "理解 API、Node、Express 和后端接口的基本约定。", url: "https://www.freecodecamp.org/learn/back-end-development-and-apis/" },
      { mark: "DB", title: "Relational Database", provider: "freeCodeCamp", description: "练习 SQL、PostgreSQL、Shell、Git 和数据库项目。", url: "https://www.freecodecamp.org/learn/relational-database/" },
    ],
  },
  {
    eyebrow: "PYTHON ENGINEERING",
    title: "Build production habits",
    description: "把会写 Python 升级成会组织、测试、交付 Python 项目。",
    resources: [
      { mark: "FA", title: "FastAPI Tutorial", provider: "Official docs", description: "沿官方教程完成验证、依赖注入、数据库、测试和部署。", url: "https://fastapi.tiangolo.com/tutorial/" },
      { mark: "PT", title: "pytest", provider: "Official docs", description: "从单元测试走到 fixtures、参数化和集成测试。", url: "https://docs.pytest.org/en/stable/getting-started.html" },
      { mark: "PKG", title: "Packaging Python Projects", provider: "Python Packaging Authority", description: "掌握 src layout、pyproject.toml、构建和发布。", url: "https://packaging.python.org/en/latest/tutorials/packaging-projects/" },
      { mark: "ARCH", title: "Architecture Patterns with Python", provider: "Cosmic Python · free book", description: "通过 repository、service layer、unit of work 学大型 Python 代码组织。", url: "https://www.cosmicpython.com/book/preface" },
      { mark: "CI", title: "Build and test Python", provider: "GitHub Actions", description: "让每次 push 自动运行 Python 测试、lint 和构建。", url: "https://docs.github.com/en/actions/tutorials/build-and-test-code/python" },
    ],
  },
  {
    eyebrow: "PROJECT PRACTICE",
    title: "Learn by shipping",
    description: "需要新项目灵感时再来这里；主项目仍然是 Daily Assistant。",
    resources: [
      { mark: "FS", title: "Full Stack Open", provider: "University of Helsinki", description: "完整练习 React、REST API、测试、TypeScript 和 CI。", url: "https://fullstackopen.com/en/" },
      { mark: "PBL", title: "Project Based Learning", provider: "GitHub", description: "按语言挑选从零构建应用的教程，Python 和 JavaScript 都有。", url: "https://github.com/practical-tutorials/project-based-learning" },
    ],
  },
] as const;

const projectLadder = [
  {
    id: "slice",
    step: "01",
    title: "Vertical slice",
    description: "把学习完成次数从 localStorage 升级成真正的 Python API + SQLite 功能。",
    result: "用户能看到并使用",
    missionTitle: "Learning Progress API",
    goal: "完成一个贯穿 React、FastAPI、SQLite 和测试的真实功能，而不是只写孤立 endpoint。",
    tasks: [
      { id: "api-contract", label: "Design the learning session API contract", detail: "定义 GET/POST 的 request、response 和错误状态。" },
      { id: "database-model", label: "Add the SQLite learning session model", detail: "新增 model 和 Alembic migration，保证重复记录可控。" },
      { id: "fastapi-routes", label: "Implement FastAPI read and write routes", detail: "完成依赖注入、验证和 repository 调用。" },
      { id: "react-integration", label: "Connect the React learning page", detail: "用 API 替换当前完成次数的 localStorage 读写。" },
      { id: "vertical-tests", label: "Add backend and frontend tests", detail: "覆盖保存、重复提交、读取和失败状态。" },
    ],
    links: [
      { label: "OPEN LEARN PAGE SOURCE", url: "https://github.com/bruceche-cmu-F25/Daily_Asistant/blob/codex/react-fastapi-refactor/frontend/src/pages/LearnPage.tsx" },
      { label: "FASTAPI TUTORIAL", url: "https://fastapi.tiangolo.com/tutorial/" },
    ],
  },
  {
    id: "backend",
    step: "02",
    title: "Reliable backend",
    description: "把第一个功能重构成 route、service、repository 清晰分层的项目代码。",
    result: "失败时也可预测",
    missionTitle: "Refactor Learning Backend",
    goal: "让业务规则不依赖 FastAPI route 或 SQLAlchemy session，代码更容易测试和修改。",
    tasks: [
      { id: "route-inventory", label: "Inventory route responsibilities", detail: "标出验证、业务规则和数据库操作目前分别在哪里。" },
      { id: "service-layer", label: "Extract a learning service layer", detail: "把重复、日期和完成规则移出 HTTP 层。" },
      { id: "repository-boundary", label: "Create a repository boundary", detail: "让 service 不直接拼 SQLAlchemy 查询。" },
      { id: "failure-paths", label: "Add typed errors and structured logs", detail: "覆盖数据库失败、非法输入和不存在记录。" },
      { id: "backend-tests", label: "Test service and API boundaries", detail: "分别写快速 unit tests 与真实 integration tests。" },
    ],
    links: [
      { label: "OPEN BACKEND SOURCE", url: "https://github.com/bruceche-cmu-F25/Daily_Asistant/tree/codex/react-fastapi-refactor/backend/daily_dashboard" },
      { label: "COSMIC PYTHON", url: "https://www.cosmicpython.com/book/preface" },
    ],
  },
  {
    id: "quality",
    step: "03",
    title: "Ship quality",
    description: "让项目在新机器和每次 push 上都能被自动安装、检查和验证。",
    result: "别人能够接手",
    missionTitle: "Python Quality Gate",
    goal: "把“在我电脑上能跑”升级成可安装、可检查、有 CI 证明的工程项目。",
    tasks: [
      { id: "pyproject", label: "Create a production pyproject.toml", detail: "统一 package metadata、dependencies 和开发工具配置。" },
      { id: "ruff", label: "Add Ruff lint and format checks", detail: "先修完现有问题，再让新问题阻断提交。" },
      { id: "typing", label: "Add a Python type-check command", detail: "覆盖 service、repository 和 API 边界。" },
      { id: "github-actions", label: "Run tests and checks in GitHub Actions", detail: "每次 push 自动安装、lint、typecheck 和 pytest。" },
      { id: "runbook", label: "Write the one-command project runbook", detail: "README 记录安装、迁移、启动、测试和常见故障。" },
    ],
    links: [
      { label: "PYTHON PACKAGING", url: "https://packaging.python.org/en/latest/tutorials/packaging-projects/" },
      { label: "GITHUB ACTIONS", url: "https://docs.github.com/en/actions/tutorials/build-and-test-code/python" },
    ],
  },
] as const;

const emptyProjectProgress: ProjectProgress = { slice: [], backend: [], quality: [] };
const projectRepoUrl = "https://github.com/bruceche-cmu-F25/Daily_Asistant/tree/codex/react-fastapi-refactor";

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
    const parsed = JSON.parse(raw) as Partial<Record<LegacyCourseId, Partial<CourseProgress>>>;
    const javascript = parsed.javascript ?? parsed.react;
    return {
      javascript: {
        sessions: Array.isArray(javascript?.sessions) ? javascript.sessions.filter((item): item is string => typeof item === "string") : [],
      },
      typescript: {
        sessions: Array.isArray(parsed.typescript?.sessions) ? parsed.typescript.sessions.filter((item): item is string => typeof item === "string") : [],
      },
    };
  } catch {
    return emptyProgress;
  }
}

function readProjectProgress(): ProjectProgress {
  try {
    const raw = learningStorage()?.getItem(PROJECT_GYM_STORAGE_KEY);
    if (!raw) return emptyProjectProgress;
    const parsed = JSON.parse(raw) as Partial<Record<ProjectId, unknown>>;
    return {
      slice: Array.isArray(parsed.slice) ? parsed.slice.filter((item): item is string => typeof item === "string") : [],
      backend: Array.isArray(parsed.backend) ? parsed.backend.filter((item): item is string => typeof item === "string") : [],
      quality: Array.isArray(parsed.quality) ? parsed.quality.filter((item): item is string => typeof item === "string") : [],
    };
  } catch {
    return emptyProjectProgress;
  }
}

function learningStreak(progress: LearningProgress, today: string) {
  const studied = new Set([...progress.javascript.sessions, ...progress.typescript.sessions]);
  const cursor = new Date(`${today}T12:00:00`);
  let streak = 0;
  while (studied.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function LearnPage() {
  const [activeId, setActiveId] = useState<CourseId>("javascript");
  const [progress, setProgress] = useState<LearningProgress>(readProgress);
  const [activeProjectId, setActiveProjectId] = useState<ProjectId>("slice");
  const [projectProgress, setProjectProgress] = useState<ProjectProgress>(readProjectProgress);
  const today = localDate();
  const activeCourse = courses[activeId];
  const doneToday = progress[activeId].sessions.includes(today);
  const sessionsToday = (Object.keys(courses) as CourseId[]).filter((id) => progress[id].sessions.includes(today)).length;
  const totalSessions = progress.javascript.sessions.length + progress.typescript.sessions.length;
  const streak = useMemo(() => learningStreak(progress, today), [progress, today]);
  const activeProject = projectLadder.find((item) => item.id === activeProjectId) ?? projectLadder[0];

  useEffect(() => {
    learningStorage()?.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    learningStorage()?.setItem(PROJECT_GYM_STORAGE_KEY, JSON.stringify(projectProgress));
  }, [projectProgress]);

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

  const toggleProjectTask = (taskId: string) => {
    setProjectProgress((current) => {
      const completed = current[activeProjectId];
      return {
        ...current,
        [activeProjectId]: completed.includes(taskId) ? completed.filter((id) => id !== taskId) : [...completed, taskId],
      };
    });
  };

  return (
    <main className="learn-page">
      <section className="panel learn-hero">
        <div>
          <p className="eyebrow">LEARN / BUILD / PROVE</p>
          <h1>Learning<br /><span>Lab</span></h1>
          <p>先完成 freeCodeCamp JavaScript V9，再进入 Front End Development Libraries。Python 不再只练语法，而是通过 Daily Assistant 练完整项目交付。</p>
          <span className="learn-local">本机只保存完成次数</span>
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
          {activeId === "javascript" && <p>freeCodeCamp 挑战站禁止第三方 iframe；上方视频用于讲解，真正的主线练习从 JavaScript V9 原站进入。</p>}
        </div>
      </section>

      <section className="panel learn-section learning-library" aria-labelledby="learning-library-title">
        <div className="learn-heading">
          <div><p className="eyebrow">03 / COURSE + REFERENCE LIBRARY</p><h2 id="learning-library-title">Learning links / 学习入口</h2></div>
          <span>按顺序学，不需要同时打开</span>
        </div>
        <div className="learning-resource-groups">
          {learningResourceGroups.map((group) => (
            <section className="learning-resource-group" aria-label={group.title} key={group.title}>
              <header><p>{group.eyebrow}</p><h3>{group.title}</h3><span>{group.description}</span></header>
              <div className="learning-link-grid">
                {group.resources.map((resource) => (
                  <a href={resource.url} target="_blank" rel="noopener noreferrer" key={resource.url}>
                    <span>{resource.mark}</span>
                    <div><b>{resource.title}</b><small>{resource.provider}</small><p>{resource.description}</p></div>
                    <i>↗</i>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="panel learn-section project-gym" aria-labelledby="project-gym-title">
        <div className="learn-heading">
          <div><p className="eyebrow">04 / PROJECT-LEVEL PRACTICE</p><h2 id="project-gym-title">Python project gym / 项目级训练</h2></div>
          <span>主训练场：Daily Assistant</span>
        </div>
        <p className="project-gym-intro">不要再造三个只能展示首页的 toy project。每周在这个代码库交付一个完整切片，同时练 Python 设计、数据库、测试、前端集成和 Git。</p>
        <div className="project-ladder">
          {projectLadder.map((item) => (
            <button className={activeProjectId === item.id ? "active" : ""} type="button" aria-pressed={activeProjectId === item.id} onClick={() => setActiveProjectId(item.id)} key={item.step}>
              <span>{item.step}</span><h3>{item.title}</h3><p>{item.description}</p>
              <small>{projectProgress[item.id].length}/{item.tasks.length} TASKS · SELECT →</small>
            </button>
          ))}
        </div>
        <section className="project-mission" aria-labelledby="active-project-mission">
          <header>
            <div><p>ACTIVE MISSION · {activeProject.step}</p><h3 id="active-project-mission">{activeProject.missionTitle}</h3><span>{activeProject.goal}</span></div>
            <strong>{projectProgress[activeProject.id].length}/{activeProject.tasks.length}<small>completed</small></strong>
          </header>
          <div className="project-mission-grid">
            <div className="project-checklist">
              {activeProject.tasks.map((task) => {
                const checked = projectProgress[activeProject.id].includes(task.id);
                return (
                  <label className={checked ? "checked" : ""} key={task.id}>
                    <input type="checkbox" aria-label={task.label} checked={checked} onChange={() => toggleProjectTask(task.id)} />
                    <span><b>{task.label}</b><small>{task.detail}</small></span>
                  </label>
                );
              })}
            </div>
            <aside>
              <p>CODE + REFERENCES</p>
              <a href={projectRepoUrl} target="_blank" rel="noopener noreferrer">OPEN PROJECT REPO ↗</a>
              {activeProject.links.map((link) => <a href={link.url} target="_blank" rel="noopener noreferrer" key={link.url}>{link.label} ↗</a>)}
              <span>完成状态只保存在这台 Mac。先完成 01，再进入 02 和 03。</span>
            </aside>
          </div>
        </section>
        <div className="project-definition">
          <b>PROJECT DEFINITION OF DONE</b>
          <span>清晰目录</span><span>类型和验证</span><span>pytest</span><span>错误处理</span><span>README</span><span>CI 通过</span><span>可演示结果</span>
        </div>
      </section>

      <section className="panel learn-section career-loop" aria-labelledby="career-loop-title">
        <div className="learn-heading"><div><p className="eyebrow">05 / TURN LEARNING INTO SIGNAL</p><h2 id="career-loop-title">Job-ready loop / 让学习帮助求职</h2></div></div>
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
