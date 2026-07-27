import { useEffect, useMemo, useState } from "react";

import { ModuleCustomizer } from "../components/ModuleCustomizer";
import { LearningRoadmaps } from "../components/LearningRoadmaps";
import {
  applyLayoutOperations,
  normalizeLayoutConfig,
  type LayoutOperation,
  type ModuleLayoutConfig,
} from "../modules/moduleConfig";
import {
  defaultLearningLayout,
  learningComponentRegistry,
  LEARNING_LAYOUT_STORAGE_KEY,
} from "../modules/learningModule";

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
      { mark: "OW", title: "OpenWorker", provider: "Andrew Ng · GitHub", description: "研究本地优先、可接多模型与连接器的开源 AI coworker 架构。", url: "https://github.com/andrewyng/openworker" },
      { mark: "OW", title: "OpenWork", provider: "different-ai · GitHub", description: "学习如何用桌面应用和 MCP 创建、复用并分享 AI 工作流。", url: "https://github.com/different-ai/openwork" },
      { mark: "PF", title: "PocketFlow Codebase Knowledge", provider: "The Pocket · GitHub", description: "用 AI 分析代码库的核心抽象与关系，并生成适合初学者阅读的图文教程。", url: "https://github.com/the-pocket/pocketflow-tutorial-codebase-knowledge" },
      { mark: "RW", title: "RepoWiki", provider: "he-yufeng · GitHub", description: "从本地目录或 GitHub 仓库生成可导出的 Wiki、阅读路线与终端问答。", url: "https://github.com/he-yufeng/RepoWiki" },
      { mark: "AI", title: "Aider", provider: "Aider-AI · GitHub", description: "在终端中与多种 LLM 结对编程，理解代码库并结合 Git、测试和 lint 完成修改。", url: "https://github.com/Aider-AI/aider" },
      { mark: "PI", title: "Pi Web", provider: "agegr · GitHub · MIT", description: "为 pi coding agent 提供本地 Web UI，可浏览会话、实时聊天、配置模型和技能，并预览项目文件。", url: "https://github.com/agegr/pi-web" },
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

const specialProjectChannels = [
  {
    mark: "PBL",
    mode: "GUIDED BUILD",
    title: "Project Based Learning",
    description: "跟着完整教程从零交付一个应用。适合第一次接触某类项目，重点是完成端到端流程。",
    recommendation: "推荐入口：Python Web Applications",
    outcome: "完成后必须改一个核心需求，避免只复制教程。",
    cta: "ENTER GUIDED CHANNEL",
    url: "https://github.com/practical-tutorials/project-based-learning#python",
  },
  {
    mark: "BYOX",
    mode: "BUILD FROM SCRATCH",
    title: "Build Your Own X",
    description: "重造 Git、数据库、Web Server、Redis 等真实技术。适合训练底层原理、设计取舍和代码深度。",
    recommendation: "推荐起点：Web Server → Git → Database",
    outcome: "完成后写架构图、限制和你做过的取舍。",
    cta: "ENTER FROM-SCRATCH CHANNEL",
    url: "https://github.com/codecrafters-io/build-your-own-x",
  },
] as const;

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

function readLearningLayout(): ModuleLayoutConfig {
  try {
    const raw = learningStorage()?.getItem(LEARNING_LAYOUT_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) as Partial<ModuleLayoutConfig> : null;
    const normalized = normalizeLayoutConfig(saved, learningComponentRegistry);
    if (!Array.isArray(saved?.order) || saved.order.includes("roadmaps")) return normalized;
    const order = normalized.order.filter((id) => id !== "roadmaps");
    const todayIndex = order.indexOf("today");
    order.splice(todayIndex >= 0 ? todayIndex + 1 : 0, 0, "roadmaps");
    return { ...normalized, order };
  } catch {
    return defaultLearningLayout;
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
  const [layout, setLayout] = useState<ModuleLayoutConfig>(readLearningLayout);
  const [layoutHistory, setLayoutHistory] = useState<ModuleLayoutConfig[]>([]);
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

  useEffect(() => {
    learningStorage()?.setItem(LEARNING_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

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

  const applyLayout = (operations: LayoutOperation[]) => {
    setLayoutHistory((current) => [...current, layout].slice(-20));
    setLayout((current) => applyLayoutOperations(current, operations));
  };

  const undoLayout = () => {
    const previous = layoutHistory.at(-1);
    if (!previous) return;
    setLayout(previous);
    setLayoutHistory((current) => current.slice(0, -1));
  };

  const componentOrder = (id: string) => layout.order.indexOf(id);
  const componentIsVisible = (id: string) => !layout.hidden.includes(id);

  return (
    <main className="learn-page">
      <ModuleCustomizer
        moduleTitle="Learning Hub"
        components={learningComponentRegistry}
        config={layout}
        canUndo={layoutHistory.length > 0}
        onApply={applyLayout}
        onUndo={undoLayout}
      />

      {componentIsVisible("overview") && <section className="panel learn-hero" data-component-id="overview" style={{ order: componentOrder("overview") }}>
        <div>
          <p className="eyebrow">LOCAL PROGRESS ONLY</p>
          <h1>Learning<br /><span>Hub</span></h1>
          <p>Start with freeCodeCamp JavaScript, then build project-level Python in Daily Assistant.</p>
        </div>
        <div className="learn-stats" aria-label="Learning summary">
          <div><b>{sessionsToday.toString().padStart(2, "0")}</b><span>sessions today</span></div>
          <div><b>{streak.toString().padStart(2, "0")}</b><span>day streak</span></div>
          <div><b>{totalSessions.toString().padStart(2, "0")}</b><span>total sessions</span></div>
        </div>
      </section>}

      {componentIsVisible("today") && <section className="panel learn-section" aria-labelledby="learning-tracks-title" data-component-id="today" style={{ order: componentOrder("today") }}>
        <div className="learn-heading">
          <div><h2 id="learning-tracks-title">What to Learn Today</h2></div>
          <span>One course at a time</span>
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
      </section>}

      {componentIsVisible("roadmaps") && <section className="panel learn-section learning-roadmaps" aria-labelledby="learning-roadmaps-title" data-component-id="roadmaps" style={{ order: componentOrder("roadmaps") }}>
        <div className="learn-heading">
          <div><h2 id="learning-roadmaps-title">Learning Roadmaps</h2></div>
          <span>Dependencies · proof · local progress</span>
        </div>
        <p className="learning-roadmaps-intro">Choose a path, open a node, and complete its proof before moving downstream. Progress stays on this Mac.</p>
        <LearningRoadmaps />
      </section>}

      {componentIsVisible("course-workspace") && <section className="panel learn-section learning-workspace" aria-labelledby="learning-workspace-title" data-component-id="course-workspace" style={{ order: componentOrder("course-workspace") }}>
        <div className="learn-heading">
          <div><h2 id="learning-workspace-title">{activeCourse.title}</h2></div>
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
            <p className="eyebrow">TODAY’S SESSION</p>
            <ol>
              <li><b>WATCH</b><span>Finish one focused section.</span></li>
              <li><b>CODE</b><span>Close the video and rebuild it yourself.</span></li>
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
      </section>}

      {componentIsVisible("resource-library") && <section className="panel learn-section learning-library" aria-labelledby="learning-library-title" data-component-id="resource-library" style={{ order: componentOrder("resource-library") }}>
        <div className="learn-heading">
          <div><h2 id="learning-library-title">Courses & References</h2></div>
          <span>Follow one path at a time</span>
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
      </section>}

      {componentIsVisible("project-gym") && <section className="panel learn-section project-gym" aria-labelledby="project-gym-title" data-component-id="project-gym" style={{ order: componentOrder("project-gym") }}>
        <div className="learn-heading">
          <div><h2 id="project-gym-title">Project-Level Python</h2></div>
          <span>Main workspace: Daily Assistant</span>
        </div>
        <p className="project-gym-intro">Ship one complete Daily Assistant slice each week: design, database, tests, frontend integration, and Git.</p>
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
              <span>Progress stays on this Mac. Complete 01 before 02 and 03.</span>
            </aside>
          </div>
        </section>
        <div className="project-definition">
          <b>PROJECT DEFINITION OF DONE</b>
          <span>Clear structure</span><span>Types & validation</span><span>pytest</span><span>Error handling</span><span>README</span><span>Passing CI</span><span>Demo-ready result</span>
        </div>
        <section className="special-project-channel" aria-labelledby="special-project-channel-title">
          <header>
            <div><h3 id="special-project-channel-title">Project Challenges (Optional)</h3></div>
            <span>Choose one after completing a core mission.</span>
          </header>
          <div className="special-channel-grid">
            {specialProjectChannels.map((channel) => (
              <a href={channel.url} target="_blank" rel="noopener noreferrer" key={channel.url}>
                <span>{channel.mark}</span>
                <div><small>{channel.mode}</small><h4>{channel.title}</h4><p>{channel.description}</p><b>{channel.recommendation}</b><em>{channel.outcome}</em></div>
                <strong>{channel.cta} ↗</strong>
              </a>
            ))}
          </div>
          <footer><b>CHANNEL RULE</b><span>One project at a time</span><span>Use a dedicated repo</span><span>Ship a working result weekly</span><span>Finish with a README and demo</span></footer>
        </section>
      </section>}

      {componentIsVisible("career-loop") && <section className="panel learn-section career-loop" aria-labelledby="career-loop-title" data-component-id="career-loop" style={{ order: componentOrder("career-loop") }}>
        <div className="learn-heading"><div><h2 id="career-loop-title">From Learning to Hiring</h2></div></div>
        <div className="career-loop-grid">
          <article><span>01</span><b>Learn</b><p>每天只学一个可复述的概念。</p></article>
          <article><span>02</span><b>Build</b><p>当天放进 Daily Assistant 或 portfolio。</p></article>
          <article><span>03</span><b>Ship</b><p>留下 commit、截图或可访问页面。</p></article>
          <article><span>04</span><b>Explain</b><p>准备两句话说明取舍、bug 和结果。</p></article>
        </div>
      </section>}
    </main>
  );
}
