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
    const problemIndex = (() => {
      try {
        const problems = JSON.parse(document.getElementById("coach-tasks")?.textContent || "[]");
        return problems.map((problem) => ({
          url: problem.start_url,
          label: problem.title,
          host: `NeetCode 150 · ${problem.topic}`,
          brand: "brand-neetcode",
          mark: "NC",
          searchText: `${problem.title} ${problem.topic} ${problem.difficulty} neetcode 150`,
          isProblem: true,
        }));
      } catch (error) {
        return [];
      }
    })();
    problemIndex.forEach((problem) => seenUrls.add(problem.url));
    const savedLinkIndex = Array.from(document.querySelectorAll('a[href^="http"]')).map((anchor) => {
      const url = anchor.href;
      if (seenUrls.has(url)) return null;
      seenUrls.add(url);
      const parsed = new URL(url);
      const label = (anchor.querySelector(".link-label")?.textContent || anchor.querySelector("b")?.textContent || anchor.textContent || parsed.hostname).trim();
      const brand = Array.from(anchor.classList).find((name) => name.startsWith("brand-")) || "brand-default";
      const mark = anchor.querySelector(".link-fallback")?.textContent?.trim() || parsed.hostname.slice(0, 2).toUpperCase();
      const host = parsed.hostname.replace(/^www\./, "");
      return { url, label, host, brand, mark, searchText: `${label} ${host}`, isProblem: false };
    }).filter(Boolean);
    const linkIndex = [...problemIndex, ...savedLinkIndex];
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
      matches = linkIndex.filter((entry) => entry.searchText.toLowerCase().includes(query))
        .sort((a, b) => {
          const startsDifference = Number(!a.label.toLowerCase().startsWith(query)) - Number(!b.label.toLowerCase().startsWith(query));
          if (startsDifference) return startsDifference;
          return Number(!a.isProblem) - Number(!b.isProblem);
        })
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

  const coachData = document.getElementById("coach-tasks");
  const coachCard = document.getElementById("coach-card");
  const completionStore = window.dashboardProblemStore;
  if (coachData && coachCard && completionStore) {
    let tasks = [];
    try { tasks = JSON.parse(coachData.textContent || "[]"); } catch (error) { tasks = []; }
    let budget = 30;
    let cursor = 0;
    let currentTask = null;
    const title = document.getElementById("coach-title");
    const source = document.getElementById("coach-source");
    const difficulty = document.getElementById("coach-difficulty");
    const duration = document.getElementById("coach-duration");
    const why = document.getElementById("coach-why");
    const doneWhen = document.getElementById("coach-done-when");
    const start = document.getElementById("coach-start");
    const stuck = document.getElementById("coach-stuck");
    const finish = document.getElementById("coach-finish");
    const skip = document.getElementById("coach-skip");
    const help = document.getElementById("coach-help");
    const helpSteps = document.getElementById("coach-help-steps");
    const helpLink = document.getElementById("coach-help-link");
    const empty = document.getElementById("coach-empty");
    const nextList = document.getElementById("coach-next-list");
    const doneCount = document.getElementById("coach-done-count");
    const completeDialog = document.getElementById("problem-complete-dialog");
    const completeForm = document.getElementById("problem-complete-form");
    const dialogTitle = document.getElementById("problem-dialog-title");
    const solutionField = document.getElementById("problem-solution");
    const reflectionField = document.getElementById("problem-reflection");
    const saveComplete = document.getElementById("problem-save-complete");
    const historyList = document.getElementById("problem-history-list");
    const historyEmpty = document.getElementById("problem-history-empty");
    const historyTopics = document.getElementById("history-topic-grid");
    const historyCompleted = document.getElementById("history-completed");
    const historyTotal = document.getElementById("history-total");
    const historyStuck = document.getElementById("history-stuck");
    const historyToday = document.getElementById("history-today");
    const roadmapNodes = document.getElementById("roadmap-topic-nodes");
    const roadmapListTitle = document.getElementById("roadmap-list-title");
    const roadmapListCount = document.getElementById("roadmap-list-count");
    const roadmapProblemList = document.getElementById("roadmap-problem-list");
    const stuckRecorded = new Set();
    let selectedTopic = "Arrays & Hashing";

    const roadmapPositions = {
      "Arrays & Hashing": [440, 20],
      "Two Pointers": [240, 120],
      "Stack": [640, 120],
      "Binary Search": [50, 220],
      "Sliding Window": [260, 220],
      "Linked List": [600, 220],
      "Trees": [440, 320],
      "Tries": [40, 420],
      "Heap / Priority Queue": [250, 420],
      "Backtracking": [670, 420],
      "Intervals": [20, 550],
      "Greedy": [210, 550],
      "Advanced Graphs": [400, 550],
      "Graphs": [590, 550],
      "1-D Dynamic Programming": [780, 550],
      "2-D Dynamic Programming": [580, 670],
      "Bit Manipulation": [790, 670],
      "Math & Geometry": [690, 770],
    };

    const formatCompletedAt = (value) => {
      if (!value) return "Completed";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    };

    const renderRoadmap = (database = { items: {} }) => {
      if (!roadmapNodes || !roadmapProblemList) return;
      const items = database.items || {};
      const topics = new Map();
      tasks.forEach((task) => {
        if (!topics.has(task.topic)) topics.set(task.topic, []);
        topics.get(task.topic).push(task);
      });
      if (!topics.has(selectedTopic)) selectedTopic = topics.keys().next().value || "";

      roadmapNodes.replaceChildren();
      Object.entries(roadmapPositions).forEach(([topicName, position]) => {
        const topicTasks = topics.get(topicName) || [];
        const completed = topicTasks.filter((task) => items[task.key]?.completed).length;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "roadmap-node";
        button.classList.toggle("active", topicName === selectedTopic);
        button.classList.toggle("complete", topicTasks.length > 0 && completed === topicTasks.length);
        button.style.left = `${position[0]}px`;
        button.style.top = `${position[1]}px`;
        button.setAttribute("aria-pressed", topicName === selectedTopic ? "true" : "false");
        button.setAttribute("aria-label", `${topicName}: ${completed} of ${topicTasks.length} completed`);
        const label = document.createElement("span");
        const count = document.createElement("b");
        const progress = document.createElement("progress");
        label.textContent = topicName;
        count.textContent = `${completed}/${topicTasks.length}`;
        progress.max = Math.max(topicTasks.length, 1);
        progress.value = completed;
        button.append(label, count, progress);
        button.addEventListener("click", () => {
          selectedTopic = topicName;
          renderRoadmap(database);
        });
        roadmapNodes.append(button);
      });

      const selectedTasks = topics.get(selectedTopic) || [];
      const selectedCompleted = selectedTasks.filter((task) => items[task.key]?.completed).length;
      roadmapListTitle.textContent = selectedTopic;
      roadmapListCount.textContent = `${selectedCompleted} / ${selectedTasks.length}`;
      roadmapProblemList.replaceChildren();
      selectedTasks.forEach((task, index) => {
        const completed = Boolean(items[task.key]?.completed);
        const item = document.createElement("li");
        item.className = completed ? "done" : "";
        const marker = document.createElement("span");
        marker.className = "roadmap-problem-marker";
        marker.textContent = completed ? "✓" : String(index + 1).padStart(2, "0");
        const copy = document.createElement("div");
        const link = document.createElement("a");
        const meta = document.createElement("span");
        link.href = task.start_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = task.title;
        meta.textContent = `${task.difficulty} · ${task.minutes} min ↗`;
        copy.append(link, meta);
        item.append(marker, copy);
        roadmapProblemList.append(item);
      });
    };

    const renderHistory = (database = { items: {}, today_count: 0 }) => {
      if (!historyList || !historyTopics) return;
      const items = database.items || {};
      const completed = tasks
        .map((task) => ({ task, record: items[task.key] }))
        .filter(({ record }) => record?.completed)
        .sort((a, b) => String(b.record.completed_at || "").localeCompare(String(a.record.completed_at || "")));
      const stuckTaps = Object.values(items).reduce((total, item) => total + Number(item.stuck_count || 0), 0);
      historyCompleted.textContent = completed.length;
      historyTotal.textContent = tasks.length;
      historyStuck.textContent = stuckTaps;
      historyToday.textContent = Number(database.today_count || 0);

      const topics = new Map();
      tasks.forEach((task) => {
        if (!topics.has(task.topic)) topics.set(task.topic, { total: 0, completed: 0 });
        const topic = topics.get(task.topic);
        topic.total += 1;
        if (items[task.key]?.completed) topic.completed += 1;
      });
      historyTopics.replaceChildren();
      topics.forEach((progress, topicName) => {
        const card = document.createElement("article");
        card.className = "history-topic";
        const label = document.createElement("div");
        const name = document.createElement("b");
        const count = document.createElement("span");
        name.textContent = topicName;
        count.textContent = `${progress.completed}/${progress.total}`;
        label.append(name, count);
        const bar = document.createElement("progress");
        bar.max = progress.total;
        bar.value = progress.completed;
        bar.setAttribute("aria-label", `${topicName}: ${progress.completed} of ${progress.total}`);
        card.append(label, bar);
        historyTopics.append(card);
      });

      historyList.replaceChildren();
      completed.forEach(({ task, record }) => {
        const entry = document.createElement("article");
        entry.className = "history-entry";
        const top = document.createElement("div");
        top.className = "history-entry-top";
        const copy = document.createElement("div");
        const link = document.createElement("a");
        link.href = task.start_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = task.title;
        const meta = document.createElement("span");
        meta.textContent = `${task.topic} · ${task.difficulty} · ${formatCompletedAt(record.completed_at)}${record.stuck_count ? ` · stuck ${record.stuck_count}×` : ""}`;
        copy.append(link, meta);
        const badge = document.createElement("b");
        badge.textContent = "DONE";
        top.append(copy, badge);
        entry.append(top);

        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "View solution & reflection";
        details.append(summary);
        const notes = document.createElement("div");
        notes.className = "history-notes";
        const solutionHeading = document.createElement("b");
        solutionHeading.textContent = "SOLUTION";
        const solution = document.createElement("pre");
        solution.textContent = record.solution || "No solution saved.";
        const reflectionHeading = document.createElement("b");
        reflectionHeading.textContent = "REFLECTION / 心得";
        const reflection = document.createElement("p");
        reflection.textContent = record.reflection || "No reflection saved.";
        notes.append(solutionHeading, solution, reflectionHeading, reflection);
        details.append(notes);
        entry.append(details);
        historyList.append(entry);
      });
      historyEmpty.hidden = completed.length > 0;
    };

    const availableTasks = () => {
      const pending = tasks.filter((task) => !completionStore.isCompleted(task.key));
      const fitting = pending.filter((task) => Number(task.minutes) <= budget);
      return fitting.length ? fitting : pending;
    };

    const renderCoach = () => {
      const available = availableTasks();
      if (!available.length) {
        currentTask = null;
        coachCard.hidden = true;
        empty.hidden = false;
        nextList.replaceChildren();
        return;
      }
      cursor %= available.length;
      currentTask = available[cursor];
      coachCard.hidden = false;
      empty.hidden = true;
      source.textContent = currentTask.topic;
      difficulty.textContent = currentTask.difficulty;
      const starterMode = Number(currentTask.minutes) > budget;
      duration.textContent = starterMode ? `${budget} min starter` : `${currentTask.minutes} min`;
      title.textContent = currentTask.title;
      why.textContent = starterMode ? `先启动，不要求一次做完。${currentTask.why}` : currentTask.why;
      doneWhen.textContent = starterMode ? currentTask.starter : currentTask.done_when;
      start.href = currentTask.start_url;
      start.target = currentTask.start_url.startsWith("http") ? "_blank" : "_self";
      start.rel = "noopener noreferrer";
      help.hidden = true;
      stuck.setAttribute("aria-expanded", "false");
      stuck.textContent = "不会做 / 卡住了";
      helpSteps.replaceChildren();
      [
        "前 10 分钟：只写示例、暴力解法和你已经确认的条件。",
        `再卡 10 分钟：回忆 ${currentTask.pattern} 模式，只看一个 Hint。`,
        "20 分钟后：看 NeetCode 对应 Topic，关闭答案后从空白重新写。",
      ].forEach((step) => {
        const item = document.createElement("li");
        item.textContent = step;
        helpSteps.append(item);
      });
      nextList.replaceChildren();
      available.filter((task) => task.key !== currentTask.key).slice(0, 2).forEach((task) => {
        const item = document.createElement("li");
        item.innerHTML = `<b></b><span></span>`;
        item.querySelector("b").textContent = task.title;
        item.querySelector("span").textContent = `${task.difficulty} · ${task.topic}`;
        nextList.append(item);
      });
    };

    document.querySelectorAll(".time-budget [data-minutes]").forEach((button) => {
      button.addEventListener("click", () => {
        budget = Number(button.dataset.minutes);
        cursor = 0;
        document.querySelectorAll(".time-budget [data-minutes]").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
        renderCoach();
      });
    });
    stuck.addEventListener("click", () => {
      const opening = help.hidden;
      help.hidden = !opening;
      stuck.setAttribute("aria-expanded", opening ? "true" : "false");
      stuck.textContent = opening ? "收起帮助" : "不会做 / 卡住了";
      if (opening && currentTask && !stuckRecorded.has(currentTask.key)) {
        stuckRecorded.add(currentTask.key);
        completionStore.save(currentTask, "stuck").then(() => completionStore.refresh()).then((database) => {
          renderHistory(database);
          renderRoadmap(database);
        });
      }
    });
    skip.addEventListener("click", () => { cursor += 1; renderCoach(); });
    finish.addEventListener("click", () => {
      if (!currentTask) return;
      const saved = completionStore.getItem(currentTask.key) || {};
      dialogTitle.textContent = `Complete / ${currentTask.title}`;
      solutionField.value = saved.solution || "";
      reflectionField.value = saved.reflection || "";
      if (typeof completeDialog.showModal === "function") completeDialog.showModal();
      else completeDialog.setAttribute("open", "");
    });
    const closeDialog = () => completeDialog.open && completeDialog.close();
    document.getElementById("problem-dialog-close")?.addEventListener("click", closeDialog);
    document.getElementById("problem-dialog-cancel")?.addEventListener("click", closeDialog);
    completeDialog?.addEventListener("click", (event) => {
      if (event.target === completeDialog) closeDialog();
    });
    completeForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentTask) return;
      saveComplete.disabled = true;
      const result = await completionStore.save(currentTask, "completed", {
        solution: solutionField.value.trim(),
        reflection: reflectionField.value.trim(),
      });
      const database = await completionStore.refresh();
      if (Number.isInteger(result.today_count)) doneCount.textContent = result.today_count;
      renderHistory(database);
      renderRoadmap(database);
      cursor = 0;
      saveComplete.disabled = false;
      closeDialog();
      renderCoach();
    });
    completionStore.ready.then((state) => {
      if (Number.isInteger(state.today_count)) doneCount.textContent = state.today_count;
      renderCoach();
      renderHistory(state);
      renderRoadmap(state);
    });
  }
})();
