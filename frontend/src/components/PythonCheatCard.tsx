import { pythonCheatCategoryLabels, type PythonCheatItem } from "../pythonCheatsheet";

type PythonCheatCardProps = {
  item: PythonCheatItem;
  index: number;
  copied: boolean;
  featured?: boolean;
  onCopy: (id: string, code: string) => void;
};

export function PythonCheatCard({ item, index, copied, featured = false, onCopy }: PythonCheatCardProps) {
  return (
    <article id={item.id} className={`python-cheat-card ${featured ? "featured" : ""}`}>
      <header>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div>
          <small>{pythonCheatCategoryLabels[item.category]}</small>
          <h3>{item.title}</h3>
          {item.complexity && <em>{item.complexity}</em>}
        </div>
      </header>
      <p className="python-cheat-description">{item.description}</p>
      {(item.whenToUse || item.commonMistake) && (
        <div className="python-guidance">
          {item.whenToUse && <p><span>适用场景</span>{item.whenToUse}</p>}
          {item.commonMistake && <p><span>常见错误</span>{item.commonMistake}</p>}
        </div>
      )}
      <div className="python-syntax-line"><span>语法</span><code>{item.syntax}</code></div>
      <div className="python-code-example">
        <div>
          <span>{item.exampleLabel ?? "示例代码 · EXAMPLE.PY"}</span>
          <button type="button" onClick={() => onCopy(item.id, item.code)}>{copied ? "已复制 ✓" : "复制代码"}</button>
        </div>
        <pre><code>{item.code}</code></pre>
      </div>
    </article>
  );
}
