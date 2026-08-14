import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { createApplication, decideApplicationSignal, deleteApplication, loadApplicationSignals, loadApplications, loadCandidateProfile, loadJobLeads, markJobLeadApplied, setJobLeadDecision, updateApplication } from "../api";
import { careerPortals } from "../resources";
import type { ApplicationSignal, ApplicationStage, CandidateProfile, ContactStatus, ContactType, GmailSignalConnection, JobApplication, JobApplicationPayload, JobLead } from "../types";

const stages: Array<{ value: ApplicationStage; label: string; short: string }> = [
  { value: "saved", label: "Saved / 待投", short: "SAVED" },
  { value: "applied", label: "Applied / 已投", short: "APPLIED" },
  { value: "oa", label: "OA / 笔试", short: "OA" },
  { value: "recruiter_screen", label: "Recruiter Screen", short: "SCREEN" },
  { value: "interview", label: "Interview / 面试", short: "INTERVIEW" },
  { value: "offer", label: "Offer", short: "OFFER" },
  { value: "rejected", label: "Rejected / 结束", short: "REJECTED" },
  { value: "withdrawn", label: "Withdrawn / 撤回", short: "WITHDRAWN" },
];

const contactTypes: Array<{ value: ContactType; label: string }> = [
  { value: "none", label: "No contact / 暂无" },
  { value: "alumni", label: "Alumni / 校友" },
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "employee", label: "Employee / 在职员工" },
  { value: "other", label: "Other" },
];

const contactStatuses: Array<{ value: ContactStatus; label: string }> = [
  { value: "not_contacted", label: "Not contacted / 未联系" },
  { value: "planned", label: "Planned / 准备联系" },
  { value: "contacted", label: "Contacted / 已联系" },
  { value: "replied", label: "Replied / 已回复" },
];

type ApplicationForm = Omit<JobApplicationPayload, "applied_at" | "follow_up_at" | "deadline_at"> & {
  applied_at: string;
  follow_up_at: string;
  deadline_at: string;
};

const blankForm: ApplicationForm = {
  company: "",
  role: "",
  job_url: "",
  stage: "applied",
  next_step: "",
  applied_at: "",
  follow_up_at: "",
  deadline_at: "",
  contact_name: "",
  contact_type: "none",
  contact_status: "not_contacted",
  resume_version: "",
  notes: "",
};

const terminalStages = new Set<ApplicationStage>(["rejected", "withdrawn"]);

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function displayDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function stageLabel(stage: ApplicationStage) {
  return stages.find((item) => item.value === stage)?.short ?? stage;
}

function contactLabel(type: ContactType, status: ContactStatus) {
  const typeText = contactTypes.find((item) => item.value === type)?.label.split(" / ")[0] ?? type;
  const statusText = contactStatuses.find((item) => item.value === status)?.label.split(" / ")[0] ?? status;
  return `${typeText} · ${statusText}`;
}

export function ApplicationsPage() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [signals, setSignals] = useState<ApplicationSignal[]>([]);
  const [gmailConnection, setGmailConnection] = useState<GmailSignalConnection | null>(null);
  const [signalBusy, setSignalBusy] = useState<number | null>(null);
  const [feedRefreshedAt, setFeedRefreshedAt] = useState("");
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [leadBusy, setLeadBusy] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<ApplicationStage | "all">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ApplicationForm>(blankForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = todayKey();

  const refresh = () => Promise.all([loadApplications(), loadJobLeads(), loadCandidateProfile(), loadApplicationSignals()])
    .then(([applicationItems, jobFeed, candidate, inbox]) => {
      setApplications(applicationItems);
      setLeads(jobFeed.items);
      setFeedRefreshedAt(jobFeed.refreshed_at);
      setNewLeadCount(jobFeed.new_count ?? jobFeed.items.filter((item) => item.is_new_today).length);
      setProfile(candidate);
      setSignals(inbox.items);
      setGmailConnection(inbox.connection);
    })
    .catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load the application workspace");
    });

  useEffect(() => {
    refresh();
  }, []);

  const due = useMemo(() => applications.filter((item) => (
    item.follow_up_at && item.follow_up_at <= today && !terminalStages.has(item.stage)
  )), [applications, today]);

  const pendingLeads = useMemo(() => leads.filter((lead) => lead.decision === "pending"), [leads]);
  const dailyLeads = pendingLeads.slice(0, 8);
  const visibleLeads = showAllLeads ? dailyLeads : dailyLeads.slice(0, 6);
  const bigTechLeads = pendingLeads.filter((lead) => lead.is_big_tech && (lead.age_days === null || lead.age_days <= 30)).slice(0, 8);

  const summary = useMemo(() => ({
    ready: dailyLeads.length,
    active: applications.filter((item) => !terminalStages.has(item.stage)).length,
    due: due.length,
    interviews: applications.filter((item) => item.stage === "recruiter_screen" || item.stage === "interview").length,
    offers: applications.filter((item) => item.stage === "offer").length,
  }), [applications, due.length, dailyLeads.length]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return applications
      .filter((item) => stageFilter === "all" || item.stage === stageFilter)
      .filter((item) => !normalized || `${item.company} ${item.role} ${item.next_step} ${item.contact_name} ${item.resume_version}`.toLowerCase().includes(normalized))
      .sort((left, right) => {
        const leftDue = Boolean(left.follow_up_at && left.follow_up_at <= today && !terminalStages.has(left.stage));
        const rightDue = Boolean(right.follow_up_at && right.follow_up_at <= today && !terminalStages.has(right.stage));
        if (leftDue !== rightDue) return leftDue ? -1 : 1;
        return right.updated_at.localeCompare(left.updated_at);
      });
  }, [applications, query, stageFilter, today]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...blankForm, applied_at: today, resume_version: profile?.resume_version ?? "" });
    setEditorOpen(true);
    setError("");
  };

  const appliedFromLead = async (lead: JobLead) => {
    setLeadBusy(lead.key);
    setError("");
    try {
      const saved = await markJobLeadApplied(lead.key);
      setLeads((current) => current.map((item) => item.key === lead.key ? saved.lead : item));
      setApplications((current) => current.some((item) => item.id === saved.application.id)
        ? current.map((item) => item.id === saved.application.id ? saved.application : item)
        : [saved.application, ...current]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to capture the application");
    } finally {
      setLeadBusy("");
    }
  };

  const skipLead = async (lead: JobLead) => {
    setLeadBusy(lead.key);
    setError("");
    try {
      const saved = await setJobLeadDecision(lead.key, "skipped");
      setLeads((current) => current.map((item) => item.key === lead.key ? saved : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to skip this role");
    } finally {
      setLeadBusy("");
    }
  };

  const openEdit = (application: JobApplication) => {
    setEditingId(application.id);
    setForm({
      company: application.company,
      role: application.role,
      job_url: application.job_url,
      stage: application.stage,
      next_step: application.next_step,
      applied_at: application.applied_at ?? "",
      follow_up_at: application.follow_up_at ?? "",
      deadline_at: application.deadline_at ?? "",
      contact_name: application.contact_name,
      contact_type: application.contact_type,
      contact_status: application.contact_status,
      resume_version: application.resume_version,
      notes: application.notes,
    });
    setEditorOpen(true);
    setError("");
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm(blankForm);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    setBusy(true);
    setError("");
    const payload: JobApplicationPayload = {
      ...form,
      company: form.company.trim(),
      role: form.role.trim(),
      applied_at: form.applied_at || null,
      follow_up_at: form.follow_up_at || null,
      deadline_at: form.deadline_at || null,
    };
    try {
      const saved = editingId === null
        ? await createApplication(payload)
        : await updateApplication(editingId, payload);
      setApplications((current) => editingId === null
        ? [saved, ...current]
        : current.map((item) => item.id === saved.id ? saved : item));
      closeEditor();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save application");
    } finally {
      setBusy(false);
    }
  };

  const changeStage = async (application: JobApplication, stage: ApplicationStage) => {
    setError("");
    try {
      const saved = await updateApplication(application.id, { stage });
      setApplications((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update stage");
    }
  };

  const remove = async (application: JobApplication) => {
    if (!window.confirm(`Delete ${application.company} — ${application.role}?`)) return;
    setError("");
    try {
      await deleteApplication(application.id);
      setApplications((current) => current.filter((item) => item.id !== application.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete application");
    }
  };

  const decideSignal = async (signal: ApplicationSignal, decision: "accepted" | "dismissed") => {
    setSignalBusy(signal.id);
    setError("");
    try {
      const result = await decideApplicationSignal(signal.id, decision);
      setSignals((current) => current.filter((item) => item.id !== signal.id));
      if (result.application) {
        setApplications((current) => current.some((item) => item.id === result.application!.id)
          ? current.map((item) => item.id === result.application!.id ? result.application! : item)
          : [result.application!, ...current]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to apply the inbox suggestion");
    } finally {
      setSignalBusy(null);
    }
  };

  return (
    <main className="applications-page">
      <section className="applications-hero panel">
        <div>
          <p className="eyebrow">BAY AREA FIRST · DAILY</p>
          <h1>Today to<br /><span>Apply</span></h1>
          <p>Open the role, apply, then mark it applied. Follow-up is scheduled automatically.</p>
          <div className="application-hero-actions">
            <a className="application-add" href="#today-apply">START TODAY / 开始投递</a>
            <button type="button" onClick={openNew}>+ MANUAL ENTRY</button>
            {profile?.resume_available && <a href="/api/v1/candidate-profile/resume" target="_blank" rel="noopener noreferrer">OPEN RESUME ↗</a>}
          </div>
          {profile && <p className="candidate-line"><b>{profile.resume_version}</b><span>{profile.location} · GRAD {profile.graduation}</span></p>}
        </div>
        <div className="application-summary" aria-label="Application pipeline summary">
          <div><b>{String(summary.ready).padStart(2, "0")}</b><span>Matched & ready</span></div>
          <div><b>{String(summary.active).padStart(2, "0")}</b><span>Active pipeline</span></div>
          <div className={summary.due ? "attention" : ""}><b>{String(summary.due).padStart(2, "0")}</b><span>Follow-up due</span></div>
          <div><b>{String(summary.interviews).padStart(2, "0")}</b><span>In interviews</span></div>
        </div>
      </section>

      {error && <div className="application-error" role="alert">{error}</div>}

      <section className="job-source-strip panel" aria-label="Automatic job sources">
        <div><span>LIVE SOURCES</span><b>{feedRefreshedAt ? `REFRESHED ${new Date(feedRefreshedAt).toLocaleString()}` : "WAITING FOR FIRST REFRESH"}</b></div>
        <a href="https://github.com/SimplifyJobs/New-Grad-Positions" target="_blank" rel="noopener noreferrer"><strong>SIMPLIFY</strong><span>NEW GRAD</span></a>
        <a href="https://github.com/speedyapply/2027-SWE-College-Jobs" target="_blank" rel="noopener noreferrer"><strong>SPEEDY</strong><span>2027 SWE</span></a>
        <a href="https://github.com/speedyapply/2027-AI-College-Jobs" target="_blank" rel="noopener noreferrer"><strong>SPEEDY</strong><span>2027 AI</span></a>
        <a href="https://simplify.jobs/jobs" target="_blank" rel="noopener noreferrer"><strong>SIMPLIFY</strong><span>SEARCH</span></a>
        <a href="https://career-ops.org/docs" target="_blank" rel="noopener noreferrer"><strong>CAREER OPS</strong><span>LOCAL TOOLS</span></a>
      </section>

      <section className="career-portal-panel panel" aria-label="Official company career portals">
        <div className="application-section-head">
          <div><h2>Career Portals</h2></div>
          <b>{careerPortals.length} OFFICIAL SITES</b>
        </div>
        <p className="career-portal-note">FAANG 优先，所有链接直达公司官方招聘搜索页。岗位提醒来自上方每日聚合源，不会把第三方结果伪装成官方全量数据。</p>
        <div className="career-portal-grid">{careerPortals.map((portal) => (
          <a className={portal.group === "FAANG" ? "faang" : ""} href={portal.url} target="_blank" rel="noopener noreferrer" key={portal.name}>
            <span>{portal.mark}</span><div><b>{portal.name}</b><small>{portal.group} · OFFICIAL CAREERS ↗</small></div>
          </a>
        ))}</div>
      </section>

      <section className="job-lead-queue panel" id="today-apply" aria-label="Today to apply">
        <div className="application-section-head">
          <div><p className="eyebrow">BAY AREA FIRST</p><h2>Today’s Matches</h2></div>
          <b>{newLeadCount} NEW TODAY · {pendingLeads.length} MATCHED</b>
        </div>
        {visibleLeads.length ? <div className="job-lead-grid">{visibleLeads.map((lead, index) => (
          <article key={lead.key}>
            <header><span>{String(index + 1).padStart(2, "0")}</span><div>{lead.is_new_today && <small className="new-today">NEW TODAY</small>}<b>{lead.match_score}% MATCH</b><small className={`location-${lead.location_tier}`}>{lead.location_tier === "bay_area" ? "BAY AREA" : lead.location_tier === "remote" ? "REMOTE US" : lead.location_tier === "other_us" ? "OTHER US" : "LOCATION ?"}</small><small>{lead.track === "internship" ? "INTERNSHIP" : "NEW GRAD"}</small></div></header>
            <div className="job-lead-title"><p>{lead.company}</p><h3>{lead.role}</h3><span>{lead.location || "Location not listed"}</span></div>
            <div className="job-match-reasons">{lead.match_reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
            <footer>
              <div><span>{lead.source}</span><b>{lead.posted_at ? `POSTED ${displayDate(lead.posted_at)}` : "FIRST SEEN TODAY"}</b></div>
              <div><a href={lead.url} target="_blank" rel="noopener noreferrer">OPEN & APPLY ↗</a><button type="button" disabled={leadBusy === lead.key} onClick={() => appliedFromLead(lead)}>{leadBusy === lead.key ? "SAVING…" : "I APPLIED / 自动归档"}</button><button className="skip" type="button" disabled={leadBusy === lead.key} onClick={() => skipLead(lead)}>SKIP</button></div>
            </footer>
          </article>
        ))}</div> : <div className="application-empty"><b>QUEUE CLEAR</b><p>今天匹配到的岗位已经处理完，或岗位源正在等待首次刷新。</p></div>}
        {dailyLeads.length > 6 && <button className="show-more-leads" type="button" onClick={() => setShowAllLeads((current) => !current)}>{showAllLeads ? "SHOW TOP 6" : `SHOW TODAY'S ${dailyLeads.length}`}</button>}
      </section>

      {bigTechLeads.length > 0 && <section className="big-tech-watch panel" aria-label="Big tech openings">
        <div className="application-section-head"><div><h2>Big Tech Openings</h2></div><b>VERIFIED DATES ONLY</b></div>
        <div>{bigTechLeads.map((lead) => <a href={lead.url} target="_blank" rel="noopener noreferrer" key={lead.key}><span>{lead.company}</span><b>{lead.role}</b><small>{lead.posted_at ? `POSTED ${displayDate(lead.posted_at)}` : "FIRST SEEN IN FEED"} · {lead.location}</small></a>)}</div>
      </section>}

      <section className="inbox-copilot panel" aria-label="Gmail application suggestions">
        <div className="application-section-head">
          <div><p className="eyebrow">READ-ONLY GMAIL</p><h2>Email Suggestions</h2></div>
          <b>{signals.length} NEED REVIEW</b>
        </div>
        <div className="inbox-connection">
          <span className={gmailConnection?.automatic ? "online" : "bridge"}>{gmailConnection?.automatic ? "AUTO SYNC" : "CODEX BRIDGE"}</span>
          <p>{gmailConnection?.last_import_at ? `Last imported ${new Date(gmailConnection.last_import_at).toLocaleString()}` : "Waiting for the first read-only Gmail import."} 邮件不会被修改；只有你点确认后才更新本地 CRM。</p>
        </div>
        {signals.length ? <div className="inbox-signal-list">{signals.map((signal) => (
          <article key={signal.id}>
            <header><span>{signal.signal_type.replace("_", " ")}</span><b>{signal.confidence}% CONFIDENCE</b></header>
            <h3>{signal.company || "Company needs review"} · {signal.role_hint}</h3>
            <p>{signal.subject}</p>
            <div><span>PROPOSED</span><strong>{stageLabel(signal.suggested_stage)} · {signal.suggested_next_step}</strong>{signal.suggested_deadline_at && <em>DEADLINE {displayDate(signal.suggested_deadline_at)}</em>}</div>
            <footer>{signal.source_url ? <a href={signal.source_url} target="_blank" rel="noopener noreferrer">OPEN EMAIL ↗</a> : <span />}
              <div><button className="accept" type="button" disabled={signalBusy === signal.id || !signal.company} title={!signal.company ? "Company could not be identified; dismiss this suggestion or add the application manually." : undefined} onClick={() => decideSignal(signal, "accepted")}>{signalBusy === signal.id ? "SAVING…" : signal.company ? "CONFIRM & UPDATE CRM" : "COMPANY REQUIRED"}</button><button type="button" disabled={signalBusy === signal.id} onClick={() => decideSignal(signal, "dismissed")}>DISMISS</button></div>
            </footer>
          </article>
        ))}</div> : <div className="inbox-empty"><b>NO PENDING EMAIL CHANGES</b><p>没有自动改动。新的申请确认、OA、面试、Offer 或拒信会先出现在这里等你确认。</p></div>}
      </section>

      {editorOpen && (
        <section className="application-editor panel" aria-label={editingId === null ? "New application" : "Edit application"}>
          <div className="application-section-head">
            <div><h2>{editingId === null ? "Log Application" : "Edit Application"}</h2></div>
            <button type="button" onClick={closeEditor}>CLOSE ×</button>
          </div>
          <form onSubmit={save}>
            <label><span>Company / 公司 *</span><input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="e.g. OpenAI" /></label>
            <label><span>Role / 岗位 *</span><input required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="e.g. Software Engineer" /></label>
            <label className="wide"><span>Job URL / 岗位链接</span><input type="url" value={form.job_url} onChange={(event) => setForm({ ...form, job_url: event.target.value })} placeholder="https://…" /></label>
            <label><span>Stage / 当前阶段</span><select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as ApplicationStage })}>{stages.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label><span>Applied / 投递日期</span><input type="date" value={form.applied_at} onChange={(event) => setForm({ ...form, applied_at: event.target.value })} /></label>
            <label className="wide"><span>Next step / 下一步</span><input value={form.next_step} onChange={(event) => setForm({ ...form, next_step: event.target.value })} placeholder="e.g. Send alumni note, prepare recruiter screen" /></label>
            <label><span>Follow up / 跟进日期</span><input type="date" value={form.follow_up_at} onChange={(event) => setForm({ ...form, follow_up_at: event.target.value })} /></label>
            <label><span>Deadline / 截止日期</span><input type="date" value={form.deadline_at} onChange={(event) => setForm({ ...form, deadline_at: event.target.value })} /></label>
            <label><span>Resume version / 简历版本</span><input value={form.resume_version} onChange={(event) => setForm({ ...form, resume_version: event.target.value })} placeholder="backend-v3.pdf" /></label>
            <label><span>Primary contact / 主要联系人</span><input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} placeholder="Name" /></label>
            <label><span>Contact type / 联系人类型</span><select value={form.contact_type} onChange={(event) => setForm({ ...form, contact_type: event.target.value as ContactType })}>{contactTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label><span>Outreach / 联系状态</span><select value={form.contact_status} onChange={(event) => setForm({ ...form, contact_status: event.target.value as ContactStatus })}>{contactStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className="wide"><span>Notes / 备注</span><textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="JD keywords, referral context, interview notes…" /></label>
            <div className="application-form-actions wide"><button className="save" type="submit" disabled={busy || !form.company.trim() || !form.role.trim()}>{busy ? "SAVING…" : "SAVE APPLICATION"}</button><button type="button" onClick={closeEditor}>CANCEL</button></div>
          </form>
        </section>
      )}

      {due.length > 0 && (
        <section className="follow-up-queue panel" aria-label="Follow-up queue">
          <div className="application-section-head"><div><h2>Follow Up Today</h2></div><b>{due.length} DUE</b></div>
          <div>{due.map((application) => <button type="button" onClick={() => openEdit(application)} key={application.id}><span>{application.follow_up_at! < today ? "OVERDUE" : "TODAY"}</span><b>{application.company} · {application.role}</b><small>{application.next_step || "Add the next concrete step"}</small></button>)}</div>
        </section>
      )}

      <section className="application-pipeline panel">
        <div className="application-section-head">
          <div><h2>Applications</h2></div>
          <label className="application-search"><span>⌕</span><input aria-label="Search applications" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, role, contact…" /></label>
        </div>
        <div className="application-stage-filters" aria-label="Filter applications by stage">
          <button className={stageFilter === "all" ? "active" : ""} type="button" onClick={() => setStageFilter("all")}>ALL <b>{applications.length}</b></button>
          {stages.map((stage) => <button className={stageFilter === stage.value ? "active" : ""} type="button" onClick={() => setStageFilter(stage.value)} key={stage.value}>{stage.short} <b>{applications.filter((item) => item.stage === stage.value).length}</b></button>)}
        </div>

        <div className="application-list">
          {filtered.length ? filtered.map((application) => {
            const needsFollowUp = Boolean(application.follow_up_at && application.follow_up_at <= today && !terminalStages.has(application.stage));
            return (
              <article className={`${needsFollowUp ? "due " : ""}stage-${application.stage}`} key={application.id}>
                <header>
                  <div><span>{stageLabel(application.stage)}</span><h3>{application.company}</h3><p>{application.role}</p></div>
                  <select aria-label={`Stage for ${application.company} ${application.role}`} value={application.stage} onChange={(event) => changeStage(application, event.target.value as ApplicationStage)}>{stages.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
                </header>
                <div className="application-card-grid">
                  <div className="application-next"><b>NEXT STEP</b><p>{application.next_step || "Add one concrete next step."}</p></div>
                  <div className={needsFollowUp ? "attention" : ""}><b>FOLLOW UP</b><p>{displayDate(application.follow_up_at)}{needsFollowUp ? application.follow_up_at! < today ? " · OVERDUE" : " · TODAY" : ""}</p></div>
                  <div className={application.deadline_at && application.deadline_at <= today ? "attention" : ""}><b>DEADLINE</b><p>{displayDate(application.deadline_at)}</p></div>
                  <div><b>NETWORK</b><p>{contactLabel(application.contact_type, application.contact_status)}{application.contact_name ? ` · ${application.contact_name}` : ""}</p></div>
                  <div><b>RESUME</b><p>{application.resume_version || "Not recorded"}</p></div>
                </div>
                {application.notes && <p className="application-notes">{application.notes}</p>}
                <footer>
                  <span>{application.applied_at ? `Applied ${displayDate(application.applied_at)}` : "Application date not set"}</span>
                  <div>{application.job_url && <a href={application.job_url} target="_blank" rel="noopener noreferrer">OPEN JOB ↗</a>}<button type="button" onClick={() => openEdit(application)}>EDIT</button><button className="delete" type="button" onClick={() => remove(application)}>DELETE</button></div>
                </footer>
              </article>
            );
          }) : <div className="application-empty"><b>{applications.length ? "NO MATCHING APPLICATIONS" : "NO APPLICATIONS YET"}</b><p>{applications.length ? "Try another stage or search term." : "Log the next role you apply to. Your follow-ups, contact status and resume version will stay on this Mac."}</p><button type="button" onClick={openNew}>+ LOG FIRST APPLICATION</button></div>}
        </div>
      </section>
    </main>
  );
}
