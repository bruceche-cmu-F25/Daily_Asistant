import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("./api", () => ({
  loadDashboard: () => Promise.resolve({
    date: "2026-07-15",
    generated_at: "2026-07-15T09:00:00-07:00",
    weekly_plan: { title: "Week 1", url: "https://notion.so/week" },
    metrics: { calendar_events: 1, notion_tasks: 1, fresh_jobs: 1 },
    source_status: [{ name: "Calendar", ok: true, detail: "Updated" }],
    stale_sources: [],
    events: [{ key: "event:one", id: "", title: "Focus", start_date: "2026-07-15", start_time: "10:00", end_date: "2026-07-15", end_time: "11:00", location: "", description: "", calendar: "Work", url: "https://calendar.google.com", all_day: false }],
    links: { study: [], jobs: [] },
    weekly: [{ text: "Ship it", key: "notion:one", checked: false, is_todo: true }],
    notion: [], jobs: [], news: [{ title: "AI ships", link: "https://example.com/news", snippet: "A useful signal." }],
    discover_events: [{ title: "Silicon Valley AI Builders", link: "https://luma.com/example", snippet: "Meet local AI builders in Mountain View.", source: "Luma" }],
    job_groups: {},
    quick_actions: [{ title: "Gmail", subtitle: "Inbox", url: "https://mail.google.com/mail/u/0/#inbox", kind: "hot" }],
    quiet_links: [{ title: "LinkedIn", url: "https://www.linkedin.com/in/chi-cheng921/", kind: "profile", label: "Profile" }],
    target_copy: "Target", target_copy_cn: "目标",
  }),
  loadPiWebStatus: () => Promise.resolve({
    online: true,
    url: "http://127.0.0.1:30141",
    latency_ms: 12,
    detail: "Pi Web is ready",
  }),
  loadAiTutorStatus: () => Promise.resolve({
    configured: false,
    model: null,
    detail: "Set AI_TUTOR_API_KEY and AI_TUTOR_MODEL in the backend environment.",
  }),
  streamAiTutorMessage: () => Promise.resolve(),
  loadDailyAgentStatus: () => Promise.resolve({
    configured: true,
    model: "test-model",
    detail: "Ready · test-model",
  }),
  loadDailyAgentHistory: () => Promise.resolve([]),
  loadDailyAgentSettings: () => Promise.resolve({
    base_url: "https://api.openai.com/v1",
    model: "test-model",
    has_api_key: false,
    has_saved_api_key: false,
    source: "default",
  }),
  saveDailyAgentSettings: (settings: { base_url: string; model: string; api_key?: string; clear_api_key?: boolean }) => Promise.resolve({
    base_url: settings.base_url,
    model: settings.model,
    has_api_key: !settings.clear_api_key,
    has_saved_api_key: !settings.clear_api_key,
    source: "saved",
  }),
  testDailyAgentSettings: (settings: { model: string }) => Promise.resolve({ ok: true, model: settings.model }),
  clearDailyAgentHistory: () => Promise.resolve(),
  streamDailyAgentMessage: () => Promise.resolve(),
  approveDailyAgentDraft: (id: number) => Promise.resolve({
    draft: { id, message_id: 1, kind: "life_task", payload: { title: "Book dentist", category: "health", due_at: null, notes: "" }, summary: "Book dentist", status: "approved", created_at: "", resolved_at: "" },
    task: { id: 1, title: "Book dentist", category: "health", due_at: null, notes: "", completed: false, completed_at: null, created_at: "", updated_at: "" },
  }),
  dismissDailyAgentDraft: (id: number) => Promise.resolve({
    draft: { id, message_id: 1, kind: "life_task", payload: { title: "Book dentist", category: "health", due_at: null, notes: "" }, summary: "Book dentist", status: "dismissed", created_at: "", resolved_at: "" },
  }),
  loadNeetCode: () => Promise.resolve({
    problems: [
      { key: "leetcode:two-sum", title: "Two Sum", topic: "Arrays & Hashing", difficulty: "Easy", minutes: 25, start_url: "https://neetcode.io/problems/two-integer-sum/question?list=neetcode150" },
      { key: "leetcode:valid-palindrome", title: "Valid Palindrome", topic: "Two Pointers", difficulty: "Easy", minutes: 25, start_url: "https://neetcode.io/problems/is-palindrome/question?list=neetcode150" },
    ],
    progress: {},
    attempts: [{
      id: 7,
      problem_key: "leetcode:two-sum",
      status: "solved",
      language: "python",
      solution: "def two_sum(nums, target):\n    return []",
      reflection: "Use a complement map.",
      source: "native",
      created_at: "2026-07-15T20:38:32-07:00",
      updated_at: "2026-07-15T20:38:32-07:00",
    }],
    topics: [
      { name: "Arrays & Hashing", total: 1, completed: 0 },
      { name: "Two Pointers", total: 1, completed: 0 },
    ],
    summary: { completed: 0, total: 2, stuck: 0, attempts: 1 },
  }),
  loadWorkspace: () => Promise.resolve({ draft: null, attempts: [] }),
  saveWorkingDraft: () => Promise.resolve({ ok: true, updated_at: "2026-07-15T09:00:00-07:00" }),
  createAttempt: () => Promise.resolve({ ok: true, attempt: {} }),
  loadTodos: () => Promise.resolve([]),
  saveTodo: () => Promise.resolve({ item_key: "", source: "", title: "", completed: true, updated_at: "" }),
  loadLifeTasks: () => Promise.resolve([{
    id: 51,
    title: "Renew driver's license",
    category: "admin",
    due_at: "2099-01-12T10:30",
    notes: "Bring proof of address.",
    completed: false,
    completed_at: null,
    created_at: "2026-07-17T09:00:00-07:00",
    updated_at: "2026-07-17T09:00:00-07:00",
  }]),
  createLifeTask: (payload: object) => Promise.resolve({ id: 52, completed: false, completed_at: null, created_at: "", updated_at: "", ...payload }),
  updateLifeTask: (id: number, payload: object) => Promise.resolve({ id, title: "Renew driver's license", category: "admin", due_at: "2099-01-12T10:30", notes: "", completed: false, completed_at: null, created_at: "", updated_at: "", ...payload }),
  deleteLifeTask: () => Promise.resolve(),
  loadTripPlan: () => Promise.resolve({
    id: 1,
    title: "Japan 2026",
    destination: "Tokyo, Japan",
    start_date: "2026-09-10",
    end_date: "2026-09-16",
    notes: "Rail pass in wallet.",
    stops: [
      { id: "sensoji", title: "Senso-ji", location: "Senso-ji, Tokyo", visit_at: "2026-09-11T09:00", notes: "Arrive before crowds.", position: 0 },
      { id: "shibuya", title: "Shibuya Sky", location: "Shibuya Sky, Tokyo", visit_at: "2026-09-11T18:00", notes: "Sunset ticket.", position: 1 },
    ],
    created_at: "2026-07-19T09:00:00-07:00",
    updated_at: "2026-07-19T09:00:00-07:00",
  }),
  saveTripPlan: (payload: { stops: Array<Record<string, unknown>> }) => Promise.resolve({ id: 1, ...payload, stops: payload.stops.map((stop, index) => ({ id: stop.id || `stop-${index}`, position: index, ...stop })), created_at: "", updated_at: "" }),
  deleteTripPlan: () => Promise.resolve(),
  loadApplications: () => Promise.resolve([{
    id: 12,
    company: "OpenAI",
    role: "Software Engineer",
    job_url: "https://example.com/jobs/1",
    stage: "applied",
    next_step: "Follow up with CMU alumnus",
    applied_at: "2026-07-15",
    follow_up_at: "2026-07-16",
    deadline_at: null,
    contact_name: "Alex",
    contact_type: "alumni",
    contact_status: "contacted",
    resume_version: "backend-v3.pdf",
    notes: "Emphasize FastAPI work.",
    created_at: "2026-07-15T09:00:00-07:00",
    updated_at: "2026-07-15T09:00:00-07:00",
  }]),
  loadJobLeads: () => Promise.resolve({
    refreshed_at: "2026-07-17T09:00:00-07:00",
    items: [{
      key: "lead-netic-1",
      company: "Netic",
      role: "Agent Software Engineer - New Grad",
      location: "San Francisco, CA",
      url: "https://example.com/jobs/netic-1",
      source: "SpeedyApply 2027 AI",
      track: "new_grad",
      category: "AI/ML",
      posted_at: "2026-07-17",
      age_days: 0,
      first_seen_at: "2026-07-17T09:00:00-07:00",
      is_new_today: true,
      is_big_tech: false,
      location_tier: "bay_area",
      match_score: 96,
      match_reasons: ["2027 / early-career timing", "AI / agentic systems", "Bay Area / local"],
      decision: "pending",
      application_id: null,
    }],
    new_count: 1,
  }),
  loadCandidateProfile: () => Promise.resolve({
    resume_version: "Chi Cheng-Resume-2026-May.pdf",
    graduation: "2026-12",
    location: "Mountain View, CA",
    target_roles: ["AI / Agentic Software Engineer"],
    resume_available: true,
  }),
  loadApplicationSignals: () => Promise.resolve({
    items: [{
      id: 41,
      source_message_id: "gmail-41",
      sender: "recruiting@example.com",
      subject: "OpenAI coding assessment",
      received_at: "2026-07-17T10:00:00-07:00",
      source_url: "https://mail.google.com/mail/#all/gmail-41",
      signal_type: "oa",
      company: "OpenAI",
      role_hint: "Software Engineer",
      summary: "OpenAI coding assessment",
      suggested_stage: "oa",
      suggested_next_step: "Complete the online assessment before the deadline.",
      suggested_deadline_at: "2026-07-22",
      application_id: 12,
      confidence: 96,
      status: "pending",
      created_at: "2026-07-17T10:00:00-07:00",
      updated_at: "2026-07-17T10:00:00-07:00",
    }],
    connection: {
      adapter: "codex_gmail_bridge",
      automatic: false,
      last_import_at: null,
      status: "not_connected",
      detail: "Read-only bridge",
    },
  }),
  decideApplicationSignal: () => Promise.resolve({ signal: {}, application: null }),
  setJobLeadDecision: (key: string, decision: string) => Promise.resolve({ key, decision }),
  markJobLeadApplied: () => Promise.resolve({
    lead: { key: "lead-netic-1", decision: "applied", application_id: 13 },
    application: { id: 13, company: "Netic", role: "Agent Software Engineer - New Grad", job_url: "https://example.com/jobs/netic-1", stage: "applied", next_step: "Follow up if there is no response", applied_at: "2026-07-17", follow_up_at: "2026-07-24", deadline_at: null, contact_name: "", contact_type: "none", contact_status: "not_contacted", resume_version: "Chi Cheng-Resume-2026-May.pdf", notes: "Auto-imported", created_at: "", updated_at: "" },
  }),
  createApplication: (payload: object) => Promise.resolve({ id: 13, ...payload, created_at: "2026-07-17T09:00:00-07:00", updated_at: "2026-07-17T09:00:00-07:00" }),
  updateApplication: (id: number, payload: object) => Promise.resolve({ id, company: "OpenAI", role: "Software Engineer", job_url: "", stage: "applied", next_step: "", applied_at: null, follow_up_at: null, deadline_at: null, contact_name: "", contact_type: "none", contact_status: "not_contacted", resume_version: "", notes: "", created_at: "", updated_at: "", ...payload }),
  deleteApplication: () => Promise.resolve(),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("App", () => {
  it("renders the local-first home shell", async () => {
    const { container } = render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "DailyAction" })).toBeInTheDocument();
    expect(await screen.findByText(/Focus/)).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "July 2026 calendar" })).toBeInTheDocument();
    expect(container.querySelector('.legacy-calendar-day.past[data-day="14"]')).toBeInTheDocument();
    expect(container.querySelector('.legacy-calendar-day.today[data-day="15"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NEETCODE" })).toHaveAttribute("href", "/neetcode");
    expect(screen.getByRole("link", { name: "HOME" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "LEARN" })).toHaveAttribute("href", "/learn");
    expect(screen.getByRole("link", { name: "ROADMAP" })).toHaveAttribute("href", "/roadmap");
    expect(screen.getByRole("link", { name: "PYTHON" })).toHaveAttribute("href", "/python");
    expect(screen.getByRole("link", { name: "AGENT" })).toHaveAttribute("href", "/agent");
    expect(screen.getByRole("link", { name: "LIFE" })).toHaveAttribute("href", "/life");
    expect(screen.getByRole("link", { name: "APPLY" })).toHaveAttribute("href", "/applications");
    expect(screen.getByRole("link", { name: "GOOGLE" })).toHaveAttribute("href", "/google-career");
    expect(screen.getByRole("link", { name: "EVENTS" })).toHaveAttribute("href", "/discover");
    expect(screen.queryByRole("link", { name: "HISTORY" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "JOBS" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /01Solve/ })).toHaveAttribute("href", "/neetcode");
    expect(screen.getByRole("link", { name: /02Learn/ })).toHaveAttribute("href", "/learn");
    expect(screen.getByRole("link", { name: /03Apply/ })).toHaveAttribute("href", "/applications");
    expect(screen.getByRole("link", { name: /04Events/ })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: /Gmail/ })).toHaveAttribute("href", "https://mail.google.com/mail/u/0/#inbox");
    expect(screen.getByRole("link", { name: /printing/ })).toHaveAttribute("href", "https://mobile.eprintitsaas.com/app/add-files?locationid=657b709e3f26b41cad5395f5&domainname=sfpl");
    expect(screen.getByRole("link", { name: /Pi Web.*Local coding agent/ })).toHaveAttribute("href", "http://127.0.0.1:30141");
    expect(screen.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", "https://www.linkedin.com/in/chi-cheng921/");
    expect(container.querySelector('[data-brand-logo="gmail"] svg')).toBeInTheDocument();
    expect(container.querySelector('[data-brand-logo="linkedin"] svg')).toBeInTheDocument();

    const closeModules = screen.getByRole("button", { name: "Close module sidebar" });
    expect(closeModules).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(closeModules);
    expect(screen.getByRole("button", { name: "Open module sidebar" })).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".app-body")).toHaveClass("sidebar-closed");
    expect(window.localStorage.getItem("daily-dashboard:module-sidebar:open")).toBe("false");
  });

  it("embeds Pi Web as a local Agent module", async () => {
    render(<MemoryRouter initialEntries={["/agent"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Pi Agent" })).toBeInTheDocument();
    expect(await screen.findByText("ONLINE")).toBeInTheDocument();
    expect(screen.getByTitle("Pi Agent workspace")).toHaveAttribute("src", "http://127.0.0.1:30141");
    expect(screen.getByRole("link", { name: "OPEN IN NEW WINDOW ↗" })).toHaveAttribute("href", "http://127.0.0.1:30141");
  });

  it("opens the native Daily Agent globally without replacing Pi Web", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    const launcher = screen.getByRole("button", { name: "Open Daily Agent" });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(launcher);

    expect(await screen.findByRole("dialog", { name: "Daily Agent" })).toBeInTheDocument();
    expect(await screen.findByText("test-model")).toBeInTheDocument();
    expect(screen.getByText(/Writes always wait for confirmation/)).toBeInTheDocument();
    expect(screen.getByLabelText("Message Daily Agent")).toBeEnabled();
    expect(screen.getByRole("link", { name: "AGENT" })).toHaveAttribute("href", "/agent");

    fireEvent.keyDown(window, { key: "j", metaKey: true });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Daily Agent" })).not.toBeInTheDocument());
  });

  it("configures the Daily Agent model and API key from its local settings view", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Open Daily Agent" }));
    fireEvent.click(await screen.findByRole("button", { name: "SETTINGS" }));

    expect(await screen.findByText("OpenAI-compatible API")).toBeInTheDocument();
    const baseUrl = screen.getByLabelText("BASE URL");
    const model = screen.getByLabelText("MODEL");
    const apiKey = screen.getByLabelText("API KEY");
    const provider = screen.getByRole("combobox", { name: /PROVIDER/ });
    expect(baseUrl).toHaveValue("https://api.openai.com/v1");
    expect(apiKey).toHaveAttribute("type", "password");
    expect(screen.getByText(/No API key configured/)).toBeInTheDocument();

    fireEvent.change(provider, { target: { value: "gemini" } });
    expect(baseUrl).toHaveValue("https://generativelanguage.googleapis.com/v1beta/openai");
    expect(model).toHaveValue("gemini-2.5-flash");
    expect(screen.getByRole("link", { name: /GET GOOGLE GEMINI API KEY/ })).toHaveAttribute(
      "href",
      "https://aistudio.google.com/app/apikey",
    );

    fireEvent.change(model, { target: { value: "gpt-5-mini" } });
    fireEvent.change(apiKey, { target: { value: "secret-used-only-in-test" } });
    fireEvent.click(screen.getByRole("button", { name: "SAVE" }));

    expect(await screen.findByText(/Saved locally/)).toBeInTheDocument();
    expect(apiKey).toHaveValue("");
    expect(screen.queryByDisplayValue("secret-used-only-in-test")).not.toBeInTheDocument();
    expect(screen.getByText(/A key is saved locally/)).toBeInTheDocument();
  });

  it("collects the complete Google career roadmap and every supplied resource", async () => {
    render(<MemoryRouter initialEntries={["/google-career"]}><App /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: /LAND A JOB.*AT GOOGLE/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Google’s official videos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your application roadmap" })).toBeInTheDocument();
    expect(screen.getByText("了解招聘流程")).toBeInTheDocument();
    expect(screen.getByText("精准投递职位")).toBeInTheDocument();

    const resourceUrls = [
      "https://www.linkedin.com/pulse/how-land-job-google-guide-hiring-process-utkarsh-sharma-8dcmf?utm_source=share&utm_medium=member_ios&utm_campaign=share_via",
      "https://youtu.be/we7ba0slWrc",
      "https://youtu.be/olScOTFtVW8",
      "https://youtu.be/TPilhhzHTnU",
      "https://youtu.be/Ti5vfu9arXQ",
      "https://youtu.be/563VrWhFO38",
      "https://www.linkedin.com/pulse/how-secure-position-google-comprehensive-guide-utkarsh-sharma-guopc/",
      "https://www.google.com/about/careers/applications/how-we-hire/#step-job-searching",
      "https://lnkd.in/dRQGTJfs",
      "https://www.google.com/about/careers/applications/jobs/results/",
      "https://lnkd.in/djpnDWXu",
      "https://youtu.be/wwIysnVmAUg",
      "https://youtu.be/lIuHpBq4jJw",
      "https://careers.google.com/stories/applying-to-google/",
      "https://careers.google.com/stories/apm-application-process/",
      "https://www.youtube.com/playlist?list=PLllx_3tLoo4c_aR8RKOOnizL5LiUH02YF",
    ];

    const renderedUrls = Array.from(document.querySelectorAll<HTMLAnchorElement>(".google-career-page a"))
      .map((link) => link.getAttribute("href"));
    resourceUrls.forEach((url) => expect(renderedUrls).toContain(url));
    expect(screen.queryByRole("heading", { name: "Frontend design ideas" })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".google-resource-card")).toHaveLength(16);
  });

  it("keeps personal life tasks on an isolated timeline", async () => {
    const { container } = render(<MemoryRouter initialEntries={["/life"]}><App /></MemoryRouter>);
    expect((await screen.findAllByText("Renew driver's license")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("region", { name: "Add life task" })).toBeInTheDocument();
    const lifeTimeline = screen.getByRole("region", { name: "Life timeline" });
    const lifeCalendar = screen.getByRole("grid", { name: "January 2099 life calendar" });
    expect(lifeTimeline).toBeInTheDocument();
    expect(lifeCalendar).toBeInTheDocument();
    expect(screen.getByText("10:30 AM")).toBeInTheDocument();
    expect(screen.getAllByText("Admin / 手续").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/No Calendar or Notion sync/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Task / 事项 *"), { target: { value: "Book dentist" } });
    fireEvent.change(screen.getByLabelText("When / 什么时候"), { target: { value: "2099-01-11T09:00" } });
    const notes = screen.getByLabelText("Notes / 备注（可选，可换行）");
    fireEvent.change(notes, { target: { value: "Bring insurance card\nAsk about copay" } });
    fireEvent.keyDown(notes, { key: "Enter", code: "Enter" });
    expect(notes).toHaveValue("Bring insurance card\nAsk about copay");
    fireEvent.submit(notes.closest("form")!);
    expect(screen.queryByText("Book dentist")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ADD TO LIFE →" }));
    expect((await screen.findAllByText("Book dentist")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("9:00 AM").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Bring insurance card/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("SOMEDAY")).not.toBeInTheDocument();
    const upcomingTitles = Array.from(container.querySelectorAll(".life-group"))
      .find((group) => group.textContent?.includes("UPCOMING"))
      ?.querySelectorAll(".life-task-card h3");
    expect(Array.from(upcomingTitles ?? []).map((heading) => heading.textContent)).toEqual([
      "Book dentist",
      "Renew driver's license",
    ]);
    const tripPlanner = await screen.findByRole("region", { name: "Trip planner" });
    expect(lifeTimeline).toContainElement(tripPlanner);
    expect(lifeCalendar.compareDocumentPosition(tripPlanner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("Trip name / 旅行名称 *")).toHaveValue("Japan 2026");
    const tripMap = screen.getByTitle("Map for Senso-ji");
    expect(tripMap).toHaveAttribute("src", expect.stringContaining("Senso-ji%2C%20Tokyo"));
    fireEvent.click(screen.getByRole("button", { name: "DAY ROUTE" }));
    const dayRouteMap = screen.getByTitle("Map for day route");
    expect(dayRouteMap).toHaveAttribute("src", expect.stringContaining("output=embed"));
    expect(dayRouteMap).toHaveAttribute("src", expect.stringContaining("saddr=Senso-ji%2C+Tokyo"));
    expect(dayRouteMap).toHaveAttribute("src", expect.stringContaining("daddr=Shibuya+Sky%2C+Tokyo"));
    fireEvent.click(screen.getByRole("button", { name: "Focus Shibuya Sky on map" }));
    expect(screen.getByTitle("Map for Shibuya Sky")).toHaveAttribute("src", expect.stringContaining("Shibuya%20Sky%2C%20Tokyo"));
    fireEvent.click(screen.getByRole("button", { name: "FULL ROUTE" }));
    expect(screen.getByTitle("Map for full trip route")).toHaveAttribute("src", expect.stringContaining("output=embed"));
  });

  it("finds migrated resources in global search", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const search = screen.getByRole("searchbox", { name: "Global search" });
    fireEvent.change(search, { target: { value: "linkedin" } });
    expect(await screen.findByText(/Profile \+ job search/)).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "netflix" } });
    expect(await screen.findByRole("button", { name: /Netflix Careers.*Official careers/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "官方招聘" } });
    expect(await screen.findByRole("button", { name: /Google Careers.*Official careers/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "trip planner" } });
    expect(await screen.findByRole("button", { name: /Life Queue.*trip planner/ })).toBeInTheDocument();
  });

  it("searches Python operations globally and opens the matching cheatsheet card", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const globalSearch = screen.getByRole("searchbox", { name: "Global search" });
    fireEvent.change(globalSearch, { target: { value: "access dict" } });
    const dictResult = await screen.findByRole("button", { name: /Access dict value.*访问 Dict/ });
    fireEvent.click(dictResult);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("PythonReference");
    const focusedCard = screen.getByRole("region", { name: "当前 Python 知识卡片" });
    expect(within(focusedCard).getByRole("heading", { name: "Access dict value" })).toBeInTheDocument();
    expect(within(focusedCard).getByText(/mapping\[key\]\s+\|\s+mapping\.get\(key, default\)/)).toBeInTheDocument();

    const localSearch = screen.getByRole("searchbox", { name: "Search Python cheatsheet" });
    fireEvent.change(localSearch, { target: { value: "add set" } });
    const finder = screen.getByRole("region", { name: "Python 知识搜索" });
    const addSetResult = within(finder).getByRole("link", { name: /Add to set/ });
    expect(screen.queryByRole("heading", { name: "Access dict value" })).not.toBeInTheDocument();
    expect(within(addSetResult).getByText(/values\.add\(item\)\s+\|\s+values\.update\(iterable\)/)).toBeInTheDocument();

    fireEvent.change(globalSearch, { target: { value: "matrix bfs" } });
    const gridResult = await screen.findByRole("button", { name: /Grid BFS shortest path.*Matrix/ });
    fireEvent.click(gridResult);
    expect(await screen.findByRole("heading", { name: "Grid BFS shortest path" })).toBeInTheDocument();
    expect(localSearch).toHaveValue("");
  });

  it("covers official string modification and built-in container methods", async () => {
    render(<MemoryRouter initialEntries={["/python"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: /STRING METHODS.*All official str methods/ })).toHaveAttribute(
      "href",
      "https://docs.python.org/3/library/stdtypes.html#string-methods",
    );
    const search = screen.getByRole("searchbox", { name: "Search Python cheatsheet" });
    const finder = screen.getByRole("region", { name: "Python 知识搜索" });
    fireEvent.change(search, { target: { value: "string modification" } });
    expect(within(finder).getByRole("link", { name: /Modify a string.*str 是 immutable/i })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "isnumeric" } });
    expect(within(finder).getByRole("link", { name: /Test string contents/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "dict clear" } });
    expect(within(finder).getByRole("link", { name: /Copy or clear a dict/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "issubset" } });
    expect(within(finder).getByRole("link", { name: /Compare set relationships/ })).toBeInTheDocument();
  });

  it("provides a Chinese contents directory that links to Python cards", () => {
    render(<MemoryRouter initialEntries={["/python"]}><App /></MemoryRouter>);
    const directory = screen.getByRole("region", { name: "Python 中文知识目录" });
    expect(within(directory).getByRole("heading", { name: "Contents" })).toBeInTheDocument();
    expect(within(directory).getByRole("link", { name: /Assign & unpack/ })).toHaveAttribute("href", "/python#variables-unpack");
  });

  it("organizes every Python category into a two-track knowledge system", () => {
    render(<MemoryRouter initialEntries={["/python"]}><App /></MemoryRouter>);
    const system = screen.getByRole("region", { name: "Python 系统知识图谱" });
    expect(within(system).getByRole("heading", { name: "Python Knowledge System" })).toBeInTheDocument();
    expect(within(system).getAllByText("BUILD TRACK", { selector: "small" })).toHaveLength(3);
    expect(within(system).getAllByText("SOLVE TRACK", { selector: "small" })).toHaveLength(3);
    expect(system.querySelectorAll(".python-system-topic")).toHaveLength(15);
    expect(within(system).getByText("Syntax", { selector: ".python-system-topic > summary b" }).closest("summary")).toHaveTextContent("7 cards");
    expect(within(system).getByText("Project Engineering", { selector: ".python-system-topic > summary b" }).closest("summary")).toHaveTextContent("24 cards");
  });

  it("opens a compact card directory from each knowledge-system topic", () => {
    render(<MemoryRouter initialEntries={["/python"]}><App /></MemoryRouter>);
    const system = screen.getByRole("region", { name: "Python 系统知识图谱" });
    const coreTrigger = within(system).getByLabelText("Open Core Patterns menu");
    expect(coreTrigger).not.toBeNull();
    fireEvent.click(coreTrigger);
    const coreTopic = coreTrigger.closest("details")!;
    expect(coreTopic).toHaveAttribute("open");
    expect(within(coreTopic).getByRole("link", { name: /Flexible function parameters/ })).toHaveAttribute(
      "href",
      "/python#core-args-kwargs",
    );
    const fullDirectory = within(coreTopic).getByRole("link", { name: /View all Core Patterns cards/ });
    expect(fullDirectory).toHaveAttribute(
      "href",
      "/python#python-directory-core-patterns",
    );
    fireEvent.click(fullDirectory);
    return waitFor(() => expect(document.getElementById("python-directory-core-patterns")).toHaveAttribute("open"));
  });

  it("repositions the focused card on every directory direct-card navigation", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    render(<MemoryRouter initialEntries={["/python"]}><App /></MemoryRouter>);
    const directory = screen.getByRole("region", { name: "Python 中文知识目录" });
    const listSummaryLabel = within(directory).getAllByText("List").find((element) => element.closest("summary"));
    expect(listSummaryLabel).toBeDefined();
    fireEvent.click(listSummaryLabel as HTMLElement);
    fireEvent.click(within(directory).getByRole("link", { name: /Add to list/ }));
    expect(await screen.findByRole("heading", { name: "Add to list" })).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    const callsAfterFirstNavigation = scrollIntoView.mock.calls.length;
    const recent = screen.getByRole("region", { name: "最近查看的 Python 知识" });
    fireEvent.click(within(recent).getByRole("link", { name: /Add to list/ }));
    await waitFor(() => expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsAfterFirstNavigation));
  });

  it("searches Python knowledge in Chinese and supports the slash shortcut", async () => {
    render(<MemoryRouter initialEntries={["/python"]}><App /></MemoryRouter>);
    const search = screen.getByRole("searchbox", { name: "Search Python cheatsheet" });
    fireEvent.keyDown(window, { key: "/" });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "读取字典" } });
    const finder = screen.getByRole("region", { name: "Python 知识搜索" });
    const result = within(finder).getByRole("link", { name: /Access dict value/ });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(result).toHaveClass("active");
    fireEvent.keyDown(search, { key: "Enter" });
    const focusedCard = await screen.findByRole("region", { name: "当前 Python 知识卡片" });
    expect(within(focusedCard).getByRole("heading", { name: "Access dict value" })).toBeInTheDocument();
    expect(search).toHaveValue("读取字典");
  });

  it("understands natural language, tolerates typos, and paginates category cards", () => {
    render(<MemoryRouter initialEntries={["/python"]}><App /></MemoryRouter>);
    expect(document.querySelectorAll(".python-cheat-card")).toHaveLength(0);
    const search = screen.getByRole("searchbox", { name: "Search Python cheatsheet" });
    const finder = screen.getByRole("region", { name: "Python 知识搜索" });
    fireEvent.change(search, { target: { value: "怎么安全读取字典" } });
    expect(within(finder).getByRole("link", { name: /Access dict value/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "defualtdict" } });
    expect(within(finder).getByRole("link", { name: /Default dict/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    const workspace = screen.getByRole("region", { name: "Python cheatsheet" });
    fireEvent.click(within(workspace).getByRole("button", { name: /Algorithms.*26/ }));
    expect(document.querySelectorAll(".python-cheat-card")).toHaveLength(20);
    fireEvent.click(within(workspace).getByRole("button", { name: /再显示 6 张/ }));
    expect(document.querySelectorAll(".python-cheat-card")).toHaveLength(26);
  });

  it("opens Python data-structure implementations from global search", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const search = screen.getByRole("searchbox", { name: "Global search" });
    fireEvent.change(search, { target: { value: "implement trie" } });
    const result = await screen.findByRole("button", { name: /Trie \/ prefix tree.*实现 Trie/ });
    fireEvent.click(result);
    expect(await screen.findByRole("heading", { name: "Trie / prefix tree" })).toBeInTheDocument();
    expect(screen.getByText(/insert\/search O\(L\)/)).toBeInTheDocument();
    expect(screen.getByText(/class Trie:/)).toBeInTheDocument();
  });

  it("renders the read-only activity radar and news feed", async () => {
    render(<MemoryRouter initialEntries={["/discover"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Bay Area Events" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Silicon Valley AI Builders/ })).toHaveAttribute("href", "https://luma.com/example");
    expect(screen.getByRole("link", { name: /Bay Area AI on Luma/ })).toHaveAttribute("href", "https://luma.com/discover/sf/ai");
    expect(screen.getByRole("link", { name: /CMU Silicon Valley/ })).toHaveAttribute("href", "https://events.cmu.edu/sv/");
    expect(screen.getByRole("link", { name: /AI ships/ })).toHaveAttribute("href", "https://example.com/news");
    expect(screen.getByText(/READ ONLY · NO AUTO-REGISTRATION/)).toBeInTheDocument();
  });

  it("restores the original Learning Hub tracks, resources, and local progress", async () => {
    render(<MemoryRouter initialEntries={["/learn"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("LearningHub");
    expect(screen.getByTitle("JavaScript Foundations course player")).toHaveAttribute("src", expect.stringContaining("jS4aFq5-91M"));
    expect(screen.getByRole("link", { name: /JavaScript V9/ })).toHaveAttribute("href", "https://www.freecodecamp.org/learn/javascript-v9/");
    expect(screen.getByRole("link", { name: /FastAPI Tutorial/ })).toHaveAttribute("href", "https://fastapi.tiangolo.com/tutorial/");
    fireEvent.click(screen.getByRole("button", { name: /Advanced TypeScript/ }));
    expect(screen.getByTitle("Advanced TypeScript course player")).toHaveAttribute("src", expect.stringContaining("PLIvujZeVDLMx040"));
    fireEvent.click(screen.getByRole("button", { name: /MARK TODAY DONE/ }));
    expect(screen.getByRole("button", { name: "✓ DONE TODAY / 已完成" })).toBeInTheDocument();
    expect(window.localStorage.getItem("daily-dashboard:learning-progress:v1")).toContain("typescript");
  });

  it("keeps the Learning Hub customizer without the retired roadmap block", async () => {
    render(<MemoryRouter initialEntries={["/learn"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Courses & References" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Learning Roadmaps" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "CUSTOMIZE WITH AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tell the agent what to change" }), {
      target: { value: "隐藏课程与参考" },
    });
    fireEvent.click(screen.getByRole("button", { name: "PREVIEW CHANGES" }));
    expect(screen.getByText("隐藏 Courses & References")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "APPLY 1 CHANGE" }));
    expect(screen.queryByRole("heading", { name: "Courses & References" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "UNDO" }));
    expect(screen.getByRole("heading", { name: "Courses & References" })).toBeInTheDocument();
  });

  it("moves all frontend design resources into the Learning Hub", async () => {
    render(<MemoryRouter initialEntries={["/learn"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Frontend design ideas" })).toBeInTheDocument();

    const resourceUrls = [
      "https://noiced.com/",
      "https://mnmm.xyz/",
      "https://deck.gallery/",
      "https://recent.design/",
      "https://logosystem.co/",
      "https://craft.wild.as/",
      "https://reactbits.dev/backgrounds/dither",
      "https://canvasui.dev/components",
      "https://github.com/greensock/gsap",
      "https://www.unicorn.studio/inspiration",
    ];
    const renderedUrls = Array.from(document.querySelectorAll<HTMLAnchorElement>(".learning-library a"))
      .map((link) => link.getAttribute("href"));
    resourceUrls.forEach((url) => expect(renderedUrls).toContain(url));
  });

  it("restores the actionable Learning Hub project missions", async () => {
    render(<MemoryRouter initialEntries={["/learn"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Learning Progress API" })).toBeInTheDocument();
    const task = screen.getByRole("checkbox", { name: "Design the learning session API contract" });
    fireEvent.click(task);
    expect(task).toBeChecked();
    expect(window.localStorage.getItem("daily-dashboard:project-gym:v1")).toContain("api-contract");
    expect(screen.getByRole("heading", { name: "Project Challenges (Optional)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ENTER GUIDED CHANNEL/ })).toHaveAttribute("href", "https://github.com/practical-tutorials/project-based-learning#python");
  });

  it("renders the full-screen bilingual knowledge map in its own roadmap module", async () => {
    render(<MemoryRouter initialEntries={["/roadmap"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("region", { name: "Interactive software knowledge map" })).toBeInTheDocument();
    expect(screen.getByText("软件系统全景图")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Focus FRONTEND" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Focus AGENTIC AI" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Learning path/ })).toBeInTheDocument();
    expect(screen.queryByText("Learning Roadmaps")).not.toBeInTheDocument();
    expect(screen.queryByText("Codebase Gym")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CUSTOMIZE WITH AI" })).not.toBeInTheDocument();
  });

  it("opens a bilingual node drawer and saves simple progress", async () => {
    render(<MemoryRouter initialEntries={["/roadmap"]}><App /></MemoryRouter>);

    const reactNode = await screen.findByRole("button", { name: /ReactReact/ });
    fireEvent.click(reactNode);
    expect(screen.getByRole("complementary", { name: "React details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "React" })).toBeInTheDocument();
    expect(screen.getByText(/把应用状态映射为组件树/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New · 新概念" }));
    expect(screen.getByRole("button", { name: "Learning · 学习中" })).toBeInTheDocument();
    expect(window.localStorage.getItem("daily-dashboard:knowledge-map:progress:v1")).toContain("\"react\":\"learning\"");
  });

  it("uses a path overlay, search, and next-node navigation without locking nodes", async () => {
    render(<MemoryRouter initialEntries={["/roadmap"]}><App /></MemoryRouter>);
    const path = await screen.findByRole("combobox", { name: /Learning path/ });
    fireEvent.change(path, { target: { value: "agentic-ai" } });
    expect(screen.getByText("Agentic AI Software", { selector: ".knowledge-path-bar b" })).toBeInTheDocument();
    expect(screen.getByText("1 / 11")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "NEXT →" }));
    expect(screen.getByText("2 / 11")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search knowledge map" });
    fireEvent.change(search, { target: { value: "pi web" } });
    const searchResults = await screen.findByRole("listbox", { name: "Knowledge search results" });
    fireEvent.click(within(searchResults).getByRole("button", { name: /Pi AgentPi Agent/ }));
    expect(screen.getByRole("complementary", { name: "Pi Agent details" })).toBeInTheDocument();
  });

  it("keeps external links in one verified resources drawer", async () => {
    render(<MemoryRouter initialEntries={["/roadmap"]}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /RESOURCES/ }));
    expect(screen.getByRole("complementary", { name: "Learning resources" })).toBeInTheDocument();
    expect(screen.getAllByText("VERIFIED 2026-07-26")).toHaveLength(10);
    expect(screen.getByRole("link", { name: /Learn React/ })).toHaveAttribute("href", "https://react.dev/learn");
    expect(screen.getByRole("link", { name: /Pi Web Source/ })).toHaveAttribute("href", "https://github.com/agegr/pi-web");
  });

  it("renders the local application CRM with follow-up and resume context", async () => {
    render(<MemoryRouter initialEntries={["/applications"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Today toApply" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Today to apply" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Official company career portals" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Google.*OFFICIAL CAREERS/ })).toHaveAttribute("href", "https://www.google.com/about/careers/applications/jobs/results/");
    expect(screen.getByText("1 NEW TODAY · 1 MATCHED")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agent Software Engineer - New Grad" })).toBeInTheDocument();
    expect(screen.getByText("96% MATCH")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OPEN RESUME ↗" })).toHaveAttribute("href", "/api/v1/candidate-profile/resume");
    expect(screen.getByRole("heading", { name: "OpenAI" })).toBeInTheDocument();
    expect(screen.getAllByText("Follow up with CMU alumnus")).toHaveLength(2);
    expect(screen.getByText("backend-v3.pdf")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Follow-up queue" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Gmail application suggestions" })).toBeInTheDocument();
    expect(screen.getByText("OpenAI coding assessment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CONFIRM & UPDATE CRM" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /MANUAL ENTRY/ }));
    expect(screen.getByRole("region", { name: "New application" })).toBeInTheDocument();
    expect(screen.getByText("Primary contact / 主要联系人")).toBeInTheDocument();
  });

  it("asks for the solution only after the user finishes the problem", async () => {
    render(<MemoryRouter initialEntries={["/neetcode"]}><App /></MemoryRouter>);
    expect(screen.queryByLabelText("Solution is required to mark Solved")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "完成并写心得" }));
    expect(screen.getByRole("dialog", { name: "Save Attempt" })).toBeInTheDocument();
    const editor = screen.getByLabelText("Solution is required to mark Solved");
    const solved = screen.getByRole("button", { name: "MARK SOLVED" });
    expect(solved).toBeDisabled();
    fireEvent.change(editor, { target: { value: "def two_sum():\n    return []" } });
    expect(solved).toBeEnabled();
  });

  it("renders the NeetCode topic dependency graph", async () => {
    render(<MemoryRouter initialEntries={["/neetcode"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("region", { name: "NeetCode 150 topic graph" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Two Pointers: 0 of 1 completed" }));
    expect(screen.getByRole("link", { name: "Valid Palindrome" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "DO NOW" }));
    expect(screen.getByRole("heading", { name: "Valid Palindrome" })).toBeInTheDocument();
  });

  it("renders complete attempt history with stats and saved notes", async () => {
    render(<MemoryRouter initialEntries={["/neetcode#history"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("region", { name: "Problem history" })).toBeInTheDocument();
    expect(screen.getByLabelText("Problem history summary")).toBeInTheDocument();
    expect(screen.getByText("Use a complement map.")).toBeInTheDocument();
    expect(screen.getByText(/def two_sum/)).toBeInTheDocument();
  });
});
