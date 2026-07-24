import { Link } from "react-router-dom";

import {
  pythonCheatCategories,
  pythonCheatCategoryLabels,
  pythonCategoryAnchorId,
  pythonCheatsheet,
  type PythonCheatCategory,
} from "../pythonCheatsheet";

const categories = pythonCheatCategories.filter(
  (category): category is PythonCheatCategory => category !== "All",
);

export function PythonContentsDirectory() {
  return (
    <section className="panel python-contents-directory" aria-label="Python 中文知识目录">
      <header>
        <div>
          <h2>Contents</h2>
          <p>Expand a category and open any card.</p>
        </div>
        <div className="python-directory-total"><b>{pythonCheatsheet.length}</b><span>knowledge cards</span></div>
      </header>

      <nav className="python-directory-jumps" aria-label="Python 目录分类快捷入口">
        {categories.map((category, index) => (
          <a key={category} href={`#${pythonCategoryAnchorId(category)}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>{pythonCheatCategoryLabels[category]}
          </a>
        ))}
      </nav>

      <div className="python-directory-groups">
        {categories.map((category, categoryIndex) => {
          const entries = pythonCheatsheet.filter((item) => item.category === category);
          return (
            <details key={category} id={pythonCategoryAnchorId(category)} open={categoryIndex === 0}>
              <summary>
                <span>{String(categoryIndex + 1).padStart(2, "0")}</span>
                <b>{pythonCheatCategoryLabels[category]}</b>
                <small>{entries.length} 项</small>
              </summary>
              <ol>
                {entries.map((item, itemIndex) => (
                  <li key={item.id}>
                    <Link to={`/python#${item.id}`}>
                      <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                      <b>{item.title}</b>
                      <small>{pythonCheatCategoryLabels[item.category]}</small>
                      <i>→</i>
                    </Link>
                  </li>
                ))}
              </ol>
            </details>
          );
        })}
      </div>
    </section>
  );
}
