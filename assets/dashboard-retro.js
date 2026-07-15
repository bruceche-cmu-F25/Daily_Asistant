(() => {
  document.querySelectorAll("[data-scroll-target]").forEach((control) => {
    control.addEventListener("click", () => {
      const target = document.getElementById(control.dataset.scrollTarget);
      if (!target) return;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      target.scrollIntoView({ behavior, block: "start" });
    });
  });

  const searchInput = document.getElementById("link-search-input");
  const searchResults = document.getElementById("link-search-results");
  if (searchInput && searchResults) {
    const seenUrls = new Set();
    const linkIndex = Array.from(document.querySelectorAll('a[href^="http"]')).map((anchor) => {
      const url = anchor.href;
      if (seenUrls.has(url)) return null;
      seenUrls.add(url);
      const parsed = new URL(url);
      const label = (anchor.querySelector(".link-label")?.textContent || anchor.querySelector("b")?.textContent || anchor.textContent || parsed.hostname).trim();
      const brand = Array.from(anchor.classList).find((name) => name.startsWith("brand-")) || "brand-default";
      const mark = anchor.querySelector(".link-fallback")?.textContent?.trim() || parsed.hostname.slice(0, 2).toUpperCase();
      return { url, label, host: parsed.hostname.replace(/^www\./, ""), brand, mark };
    }).filter(Boolean);
    let matches = [];
    let activeIndex = 0;

    const closeSearch = () => {
      searchResults.hidden = true;
      searchInput.setAttribute("aria-expanded", "false");
      activeIndex = 0;
    };

    const openLink = (entry) => {
      if (!entry) return;
      window.open(entry.url, "_blank", "noopener,noreferrer");
      searchInput.value = "";
      closeSearch();
    };

    const updateActiveResult = () => {
      searchResults.querySelectorAll(".search-result").forEach((item, index) => {
        item.classList.toggle("active", index === activeIndex);
        item.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
      });
    };

    const renderSearch = () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        closeSearch();
        return;
      }
      matches = linkIndex.filter((entry) => `${entry.label} ${entry.host}`.toLowerCase().includes(query))
        .sort((a, b) => Number(!a.label.toLowerCase().startsWith(query)) - Number(!b.label.toLowerCase().startsWith(query)))
        .slice(0, 7);
      activeIndex = 0;
      searchResults.replaceChildren();
      if (!matches.length) {
        const empty = document.createElement("div");
        empty.className = "search-empty";
        empty.textContent = "No saved link found / 没有匹配链接";
        searchResults.append(empty);
      } else {
        matches.forEach((entry, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `search-result ${entry.brand}`;
          button.setAttribute("role", "option");
          button.innerHTML = `<span class="search-result-icon" aria-hidden="true"></span><span class="search-result-copy"><b></b><span></span></span><span class="search-result-arrow" aria-hidden="true">↗</span>`;
          button.querySelector(".search-result-icon").textContent = entry.mark;
          button.querySelector("b").textContent = entry.label;
          button.querySelector(".search-result-copy span").textContent = entry.host;
          button.addEventListener("pointerenter", () => { activeIndex = index; updateActiveResult(); });
          button.addEventListener("click", () => openLink(entry));
          searchResults.append(button);
        });
        updateActiveResult();
      }
      searchResults.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
    };

    searchInput.addEventListener("input", renderSearch);
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && matches.length) {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % matches.length;
        updateActiveResult();
      } else if (event.key === "ArrowUp" && matches.length) {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + matches.length) % matches.length;
        updateActiveResult();
      } else if (event.key === "Enter" && matches.length) {
        event.preventDefault();
        openLink(matches[activeIndex]);
      } else if (event.key === "Escape") {
        closeSearch();
        searchInput.blur();
      }
    });
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if ((!typing && event.key === "/") || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".link-search")) closeSearch();
    });
  }

  const clock = document.getElementById("dashboard-clock");
  const updateClock = () => {
    if (clock) clock.textContent = new Date().toTimeString().slice(0, 5);
  };
  updateClock();
  window.setInterval(updateClock, 30000);
})();
