export function DiscoverPage() {
  return (
    <main>
      <section className="panel discover-hero">
        <p className="eyebrow">DISCOVER / PHASE TWO</p>
        <h1 className="page-title">News & events</h1>
        <p>Tech News 会先迁移到这里。Luma、学校活动和公司官网活动将在核心重构稳定后接入。</p>
      </section>
      <div className="two-column">
        <section className="panel section-block"><p className="eyebrow">SIGNAL</p><h2>Tech News</h2><p>等待本地同步快照。</p></section>
        <section className="panel section-block"><p className="eyebrow">EVENTS</p><h2>Luma & company events</h2><p>第二阶段接入。</p></section>
      </div>
    </main>
  );
}
