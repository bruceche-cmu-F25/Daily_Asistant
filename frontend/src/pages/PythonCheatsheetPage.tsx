import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { PythonCheatCard } from "../components/PythonCheatCard";
import { PythonContentsDirectory } from "../components/PythonContentsDirectory";
import { PythonKnowledgeSearch } from "../components/PythonKnowledgeSearch";
import { PythonKnowledgeSystem } from "../components/PythonKnowledgeSystem";
import {
  pythonCheatCategories,
  pythonCheatCategoryLabels,
  pythonCheatsheet,
  pythonOfficialReferences,
  type PythonCheatCategory,
} from "../pythonCheatsheet";

type CategoryFilter = "All" | PythonCheatCategory;

const PAGE_SIZE = 20;
const RECENT_STORAGE_KEY = "python:recent-cards";

function readRecentIds() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function PythonCheatsheetPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [copied, setCopied] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [recentIds, setRecentIds] = useState<string[]>(readRecentIds);
  const focusedResultRef = useRef<HTMLElement>(null);

  const selectedItem = useMemo(
    () => pythonCheatsheet.find((item) => item.id === selectedId) ?? null,
    [selectedId],
  );
  const recentItems = useMemo(
    () => recentIds.map((id) => pythonCheatsheet.find((item) => item.id === id)).filter(Boolean),
    [recentIds],
  );
  const categoryItems = useMemo(
    () => category === "All" ? [] : pythonCheatsheet.filter((item) => item.category === category),
    [category],
  );
  const visibleItems = categoryItems.slice(0, visibleCount);

  useEffect(() => {
    if (!location.hash) {
      setSelectedId("");
      return;
    }
    const id = decodeURIComponent(location.hash.slice(1));
    const item = pythonCheatsheet.find((candidate) => candidate.id === id);
    if (item) {
      setSelectedId(id);
      setCategory("All");
      if (!(location.state as { preservePythonQuery?: boolean } | null)?.preservePythonQuery) setQuery("");
      setRecentIds((current) => {
        const next = [id, ...current.filter((recentId) => recentId !== id)].slice(0, 6);
        try { window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next)); } catch { /* local-only enhancement */ }
        return next;
      });
    } else {
      setSelectedId("");
    }
    if (!item) {
      window.setTimeout(() => {
        const target = document.getElementById(id);
        if (target instanceof HTMLDetailsElement) target.open = true;
        if (typeof target?.scrollIntoView === "function") target.scrollIntoView({ block: "start" });
      }, 0);
    }
  }, [location.hash, location.state]);

  useLayoutEffect(() => {
    if (!selectedId) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        focusedResultRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [selectedId, location.key]);

  const copyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => current === id ? "" : current), 1400);
    } catch {
      setCopied("");
    }
  };

  const clearSelection = useCallback(() => {
    setSelectedId("");
    navigate("/python", { replace: true });
    window.setTimeout(() => document.querySelector(".python-search-command")?.scrollIntoView({ block: "center" }), 0);
  }, [navigate]);

  const searchKnowledge = useCallback((value: string) => {
    setCategory("All");
    setQuery(value);
    if (selectedId) {
      setSelectedId("");
      navigate("/python", { replace: true });
    }
  }, [navigate, selectedId]);

  const browseCategory = (option: CategoryFilter) => {
    setCategory(option);
    setQuery("");
    setVisibleCount(PAGE_SIZE);
    if (selectedId) {
      setSelectedId("");
      navigate("/python", { replace: true });
    }
  };

  return (
    <main className="python-cheatsheet-page">
      <section className="panel python-cheatsheet-hero">
        <div className="python-hero-copy">
          <h1>Python<br /><span>Reference</span></h1>
          <p>Search an action or term and open the matching card.</p>
        </div>
        <div className="python-hero-readout" aria-label="Cheatsheet summary">
          <div><b>{pythonCheatsheet.length}</b><span>knowledge cards</span></div>
          <div><b>{pythonCheatCategories.length - 1}</b><span>categories</span></div>
          <pre><code>{`# 不必记住准确术语\n搜索：怎么安全读取字典\n结果：访问 Dict / 字典`}</code></pre>
        </div>
        <PythonKnowledgeSearch query={query} onQueryChange={searchKnowledge} />
      </section>

      {selectedItem && (
        <section ref={focusedResultRef} className="panel python-focused-result" aria-label="当前 Python 知识卡片">
          <header>
            <div>
              <span>{pythonCheatCategoryLabels[selectedItem.category]}</span>
            </div>
            <button type="button" onClick={clearSelection}>{query ? "← 返回搜索结果" : "← 返回目录"}</button>
          </header>
          <PythonCheatCard
            item={selectedItem}
            index={pythonCheatsheet.indexOf(selectedItem)}
            copied={copied === selectedItem.id}
            featured
            onCopy={(id, code) => void copyCode(id, code)}
          />
        </section>
      )}

      {recentItems.length > 0 && (
        <section className="panel python-recent-knowledge" aria-label="最近查看的 Python 知识">
          <header><div><h2>Recent</h2></div><span>Local only</span></header>
          <div>
            {recentItems.map((item, index) => item && (
              <Link key={item.id} to={`/python#${item.id}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{item.title}</b>
                <small>{pythonCheatCategoryLabels[item.category]}</small>
                <i>→</i>
              </Link>
            ))}
          </div>
        </section>
      )}

      <PythonKnowledgeSystem />

      <PythonContentsDirectory />

      <section className="panel python-cheatsheet-workspace" aria-label="Python cheatsheet">
        <header className="python-cheatsheet-toolbar">
          <div>
            <h2>Browse by Category</h2>
            <p>{PAGE_SIZE} cards at a time.</p>
          </div>
        </header>

        <div className="python-category-filters" aria-label="Python cheatsheet categories">
          {pythonCheatCategories.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={category === option}
              onClick={() => browseCategory(option)}
            >
              {option === "All" ? "目录模式" : pythonCheatCategoryLabels[option]}
              <span>{option === "All" ? pythonCheatsheet.length : pythonCheatsheet.filter((item) => item.category === option).length}</span>
            </button>
          ))}
        </div>

        {category === "All" ? (
          <div className="python-browse-idle">
            <b>{query ? "搜索结果已显示在上方" : "选择一个分类开始浏览"}</b>
            <p>{query ? "点击搜索结果可展开完整卡片，同时保留当前搜索。" : "也可以使用上方中文目录直接打开指定知识卡片。"}</p>
          </div>
        ) : (
          <>
            <div className="python-result-summary">
              <span>{pythonCheatCategoryLabels[category]} · {categoryItems.length} 张</span>
              <span>Showing {visibleItems.length}</span>
            </div>
            <div className="python-cheat-grid">
              {visibleItems.map((item) => (
                <PythonCheatCard
                  key={item.id}
                  item={item}
                  index={pythonCheatsheet.indexOf(item)}
                  copied={copied === item.id}
                  onCopy={(id, code) => void copyCode(id, code)}
                />
              ))}
            </div>
            {visibleItems.length < categoryItems.length && (
              <button className="python-load-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                再显示 {Math.min(PAGE_SIZE, categoryItems.length - visibleItems.length)} 张 ↓
              </button>
            )}
          </>
        )}
      </section>

      <section className="panel python-official-references" aria-label="Python official references">
        <header>
          <div><h2>Official Docs</h2></div>
          <span>Built-in Types · docs.python.org/3</span>
        </header>
        <div>
          {pythonOfficialReferences.map((reference) => (
            <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer">
              <b>{reference.label}</b><small>{reference.detail}</small><i>↗</i>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
