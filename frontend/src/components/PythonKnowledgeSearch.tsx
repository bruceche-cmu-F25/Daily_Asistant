import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  pythonCheatCategoryLabels,
  pythonCheatsheet,
  pythonCheatQueryTerms,
  pythonCheatSearchScore,
} from "../pythonCheatsheet";

const quickQueries = [
  "读取字典",
  "修改字符串",
  "*args **kwargs",
  "类型标注",
  "pytest mock",
  "async gather",
  "grid bfs",
  "FastAPI 分层",
];

const highlightPieces = [
  "读取", "访问", "删除", "修改", "添加", "排序", "字典", "列表", "集合", "字符串",
  "异步", "并发", "测试", "异常", "队列", "栈", "树", "图", "搜索", "缓存",
];

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const candidates = [...new Set(terms.filter((term) => term.length > 1))]
    .sort((left, right) => right.length - left.length);
  if (!candidates.length) return text;
  const expression = new RegExp(`(${candidates.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  const normalized = new Set(candidates.map((term) => term.toLowerCase()));
  return text.split(expression).map<ReactNode>((part, index) => (
    normalized.has(part.toLowerCase()) ? <mark key={`${part}-${index}`}>{part}</mark> : part
  ));
}

type PythonKnowledgeSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export function PythonKnowledgeSearch({ query, onQueryChange }: PythonKnowledgeSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const terms = useMemo(() => pythonCheatQueryTerms(query), [query]);
  const normalized = terms.join(" ");
  const results = useMemo(() => {
    if (!normalized) return [];
    return pythonCheatsheet
      .map((item) => ({ item, score: pythonCheatSearchScore(item, query) }))
      .filter((result) => result.score >= 0)
      .sort((left, right) => right.score - left.score)
      .map((result) => result.item);
  }, [normalized, query]);
  const visibleResults = results.slice(0, 12);
  const visibleTerms = useMemo(() => [
    ...terms,
    ...highlightPieces.filter((piece) => query.toLowerCase().includes(piece)),
  ], [query, terms]);

  useEffect(() => setActiveIndex(-1), [normalized]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof Element
        && target.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        onQueryChange("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onQueryChange]);

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!visibleResults.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? visibleResults.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      navigate(`/python#${visibleResults[activeIndex].id}`, { state: { preservePythonQuery: true } });
    }
  };

  return (
    <section className={`python-knowledge-search ${normalized ? "has-query" : ""}`} aria-label="Python 知识搜索">
      <header>
        <div>
          <h2>How Do I Write This in Python?</h2>
          <p>Search by action, term, API, data structure, or code fragment.</p>
        </div>
        <div className="python-search-coverage"><i />覆盖 <b>{pythonCheatsheet.length}</b> 张本地卡片</div>
      </header>

      <label className="python-search-command">
        <span aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="例如：怎么安全读取 dict、async gather、实现 LRU…"
          aria-label="Search Python cheatsheet"
          aria-controls={normalized ? "python-search-results" : undefined}
          aria-expanded={Boolean(normalized)}
          aria-activedescendant={activeIndex >= 0 ? `python-search-result-${visibleResults[activeIndex]?.id}` : undefined}
        />
        {query ? (
          <button type="button" onClick={() => onQueryChange("")} aria-label="Clear Python search">清除 ×</button>
        ) : (
          <kbd>/</kbd>
        )}
      </label>

      {!normalized && (
        <div className="python-search-starters" aria-label="常用 Python 查询">
          <span>Common searches</span>
          {quickQueries.map((example) => (
            <button key={example} type="button" onClick={() => onQueryChange(example)}>{example}</button>
          ))}
        </div>
      )}

      {normalized && (
        <div id="python-search-results" className="python-search-results" aria-live="polite">
          <div className="python-search-result-head">
            <span><b>{results.length}</b> 个匹配结果</span>
            <small>↑↓ Select · Enter Open</small>
          </div>
          {results.length ? (
            <div className="python-search-result-grid">
              {visibleResults.map((item, index) => (
                <Link
                  key={item.id}
                  id={`python-search-result-${item.id}`}
                  className={index === activeIndex ? "active" : ""}
                  to={`/python#${item.id}`}
                  state={{ preservePythonQuery: true }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
            <small>{pythonCheatCategoryLabels[item.category]}</small>
            <h3><Highlight text={item.title} terms={visibleTerms} /></h3>
                    <p><Highlight text={`${item.title} · ${item.description}`} terms={visibleTerms} /></p>
                    <code>{item.syntax}</code>
                  </div>
                  <i>打开卡片 →</i>
                </Link>
              ))}
            </div>
          ) : (
            <div className="python-search-empty">
              <b>没有找到“{query.trim()}”</b>
              <p>试试换一个核心动作，例如“读取”“删除”“排序”“异常”“测试”或“BFS”。</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
