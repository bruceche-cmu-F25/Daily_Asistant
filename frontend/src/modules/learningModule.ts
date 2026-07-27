import type { ModuleComponentDefinition, ModuleLayoutConfig } from "./moduleConfig";

export const LEARNING_LAYOUT_STORAGE_KEY = "daily-dashboard:module:learning:layout:v1";

export const learningComponentRegistry: ModuleComponentDefinition[] = [
  {
    id: "overview",
    label: "Learning Overview",
    description: "Module title, today’s sessions, streak, and total progress.",
    aliases: ["learning hub", "学习概览", "学习统计", "概览", "hero"],
  },
  {
    id: "today",
    label: "What to Learn Today",
    description: "Choose the active course for today.",
    aliases: ["今日学习", "今天学什么", "today learning", "learning tracks"],
  },
  {
    id: "roadmaps",
    label: "Learning Roadmaps",
    description: "Dependency graphs for JavaScript, React, full stack, system design, and distributed systems.",
    aliases: ["学习路线图", "roadmap", "roadmaps", "学习路径", "技能树"],
  },
  {
    id: "course-workspace",
    label: "Course Workspace",
    description: "Embedded lesson, session checklist, and completion action.",
    aliases: ["课程工作区", "课程播放器", "javascript 课程", "typescript 课程", "course player", "javascript course"],
  },
  {
    id: "resource-library",
    label: "Courses & References",
    description: "Curated course paths and reference resources.",
    aliases: ["课程与参考", "学习资源", "资源库", "references", "course library"],
  },
  {
    id: "project-gym",
    label: "Project-Level Python",
    description: "Saved project missions, checklists, and build challenges.",
    aliases: ["项目实践", "项目训练", "python 项目", "project practice", "project gym"],
  },
  {
    id: "career-loop",
    label: "From Learning to Hiring",
    description: "A repeatable loop from learning through explaining shipped work.",
    aliases: ["学习到求职", "求职循环", "career loop", "hiring loop"],
  },
];

export const defaultLearningLayout: ModuleLayoutConfig = {
  version: 1,
  order: learningComponentRegistry.map((component) => component.id),
  hidden: [],
};
