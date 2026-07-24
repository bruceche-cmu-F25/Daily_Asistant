import { Link } from "react-router-dom";

import {
  pythonCategoryAnchorId,
  pythonCheatCategoryLabels,
  pythonCheatsheet,
  type PythonCheatCategory,
} from "../pythonCheatsheet";

type KnowledgeStage = {
  number: string;
  track: "shared" | "project" | "interview";
  eyebrow: string;
  title: string;
  outcome: string;
  categories: PythonCheatCategory[];
};

const knowledgeStages: KnowledgeStage[] = [
  {
    number: "01",
    track: "shared",
    eyebrow: "FOUNDATION",
    title: "Language & Built-in Data",
    outcome: "Control flow, strings, and built-in containers.",
    categories: ["Syntax", "String", "List", "Tuple", "Dict", "Set"],
  },
  {
    number: "02",
    track: "shared",
    eyebrow: "PYTHONIC CORE",
    title: "Core Python",
    outcome: "Iteration, typing, functions, exceptions, files, and standard containers.",
    categories: ["Core Patterns", "Collections", "File & JSON"],
  },
  {
    number: "03A",
    track: "project",
    eyebrow: "BUILD TRACK",
    title: "Objects & Domain Models",
    outcome: "Classes, composition, interfaces, and dependency injection.",
    categories: ["OOP"],
  },
  {
    number: "03B",
    track: "interview",
    eyebrow: "SOLVE TRACK",
    title: "Data Structures",
    outcome: "How data is organized and which access pattern each structure supports.",
    categories: ["Data Structures"],
  },
  {
    number: "04A",
    track: "project",
    eyebrow: "BUILD TRACK",
    title: "Working Systems",
    outcome: "Packages, configuration, logging, tests, HTTP, concurrency, APIs, and databases.",
    categories: ["Project Engineering"],
  },
  {
    number: "04B",
    track: "interview",
    eyebrow: "SOLVE TRACK",
    title: "Algorithms & Complexity",
    outcome: "Traversal, sorting, search, graphs, backtracking, greedy methods, and dynamic programming.",
    categories: ["Algorithms"],
  },
  {
    number: "05A",
    track: "project",
    eyebrow: "BUILD TRACK",
    title: "Architecture & Maintenance",
    outcome: "Layers, patterns, ownership, testing, and safe evolution.",
    categories: ["Engineering Design"],
  },
  {
    number: "05B",
    track: "interview",
    eyebrow: "SOLVE TRACK",
    title: "Interview Patterns",
    outcome: "Recognize the pattern, then derive the solution from a reusable template.",
    categories: ["Interview Patterns"],
  },
];

export function PythonKnowledgeSystem() {
  return (
    <section className="panel python-knowledge-system" aria-label="Python 系统知识图谱">
      <header>
        <div>
          <h2>Python Knowledge System</h2>
          <p>Build a shared foundation, then follow the build or interview track. Hover or click a category to browse its cards.</p>
        </div>
        <div className="python-system-legend" aria-label="知识图谱图例">
          <span><i className="shared" />Foundation</span>
          <span><i className="project" />Build track</span>
          <span><i className="interview" />Interview track</span>
        </div>
      </header>

      <ol className="python-system-map">
        {knowledgeStages.map((stage) => (
          <li key={stage.number} className={`python-system-stage ${stage.track}`}>
            <div className="python-system-stage-head">
              <span>{stage.number}</span>
              <div>
                <small>{stage.eyebrow}</small>
                <h3>{stage.title}</h3>
              </div>
            </div>
            <p>{stage.outcome}</p>
            <div className="python-system-topics">
              {stage.categories.map((category) => {
                const entries = pythonCheatsheet.filter((item) => item.category === category);
                return (
                  <details key={category} className="python-system-topic">
                    <summary aria-label={`Open ${pythonCheatCategoryLabels[category]} menu`}>
                      <b>{pythonCheatCategoryLabels[category]}</b>
                      <span>{entries.length} cards</span>
                      <i aria-hidden="true">＋</i>
                    </summary>
                    <div className="python-system-menu">
                      <header>
                        <div>
                          <b>{pythonCheatCategoryLabels[category]}</b>
                          <span>{entries.length} topics</span>
                        </div>
                        <small>Open a card</small>
                      </header>
                      <ol>
                        {entries.map((item, itemIndex) => (
                          <li key={item.id}>
                            <Link to={`/python#${item.id}`}>
                              <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                              <b>{item.title}</b>
                              <small>{item.syntax}</small>
                              <i aria-hidden="true">→</i>
                            </Link>
                          </li>
                        ))}
                      </ol>
                      <Link className="python-system-directory-link" to={`/python#${pythonCategoryAnchorId(category)}`}>
                        View all {pythonCheatCategoryLabels[category]} cards <span aria-hidden="true">↓</span>
                      </Link>
                    </div>
                  </details>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
