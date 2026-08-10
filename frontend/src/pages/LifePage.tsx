import { useCallback, useEffect, useMemo, useState } from "react";

import { createLifeTask, deleteLifeTask, loadLifeTasks, updateLifeTask } from "../api";
import { TripPlanner } from "../components/TripPlanner";
import type { LifeCategory, LifeTask, LifeTaskPayload } from "../types";


const categories: Array<{ value: LifeCategory; label: string; mark: string }> = [
  { value: "personal", label: "Personal / 个人", mark: "ME" },
  { value: "home", label: "Home / 家里", mark: "HM" },
  { value: "health", label: "Health / 健康", mark: "HP" },
  { value: "finance", label: "Finance / 财务", mark: "$" },
  { value: "errands", label: "Errands / 跑腿", mark: "GO" },
  { value: "social", label: "Social / 社交", mark: "US" },
  { value: "admin", label: "Admin / 手续", mark: "ID" },
  { value: "other", label: "Other / 其他", mark: "+" },
];

const emptyForm: LifeTaskPayload = {
  title: "",
  category: "personal",
  due_at: null,
  notes: "",
};

function localMinuteKey() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dueLabel(value: string | null) {
  if (!value) return "SOMEDAY";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: value.includes("T") ? "numeric" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(new Date(value.includes("T") ? value : `${value}T12:00`));
}

function categoryInfo(category: LifeCategory) {
  return categories.find((item) => item.value === category) ?? categories[0];
}

function byDueTime(left: LifeTask, right: LifeTask) {
  const dueOrder = (left.due_at ?? "").localeCompare(right.due_at ?? "");
  return dueOrder || left.id - right.id;
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + amount, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function clockLabel(value: string) {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return "ALL DAY";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function LifeCalendar({
  monthKey,
  tasks,
  now,
  onMonthChange,
  onEdit,
}: {
  monthKey: string;
  tasks: LifeTask[];
  now: string;
  onMonthChange: (month: string) => void;
  onEdit: (task: LifeTask) => void;
}) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, month - 1, 1));
  const daysInMonth = new Date(year, month, 0).getDate();
  const mondayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const todayKey = now.slice(0, 10);
  const tasksByDay = new Map<number, LifeTask[]>();

  tasks.forEach((task) => {
    if (!task.due_at || task.due_at.slice(0, 7) !== monthKey) return;
    const day = Number(task.due_at.slice(8, 10));
    tasksByDay.set(day, [...(tasksByDay.get(day) ?? []), task]);
  });
  tasksByDay.forEach((items) => items.sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? "")));

  return (
    <div className="life-calendar-shell">
      <header className="life-calendar-head">
        <div><h3>{monthName} <span>{year}</span></h3></div>
        <div className="life-calendar-nav">
          <button type="button" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(monthKey, -1))}>← PREV</button>
          <button type="button" onClick={() => onMonthChange(now.slice(0, 7))}>TODAY</button>
          <button type="button" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(monthKey, 1))}>NEXT →</button>
        </div>
      </header>
      <div className="life-calendar-scroll">
        <div className="life-calendar-canvas">
          <div className="life-calendar-weekdays" aria-hidden="true">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="life-calendar-grid" role="grid" aria-label={`${monthName} ${year} life calendar`}>
            {Array.from({ length: mondayOffset }, (_, index) => <span className="life-calendar-blank" aria-hidden="true" key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
              const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
              const dayTasks = tasksByDay.get(day) ?? [];
              const hasOverdue = dayTasks.some((task) => task.due_at! < now);
              return (
                <div className={`life-calendar-day${dateKey === todayKey ? " today" : ""}${dayTasks.length ? " has-tasks" : ""}${hasOverdue ? " overdue" : ""}`} role="gridcell" aria-label={`${monthName} ${day}${dayTasks.length ? `, ${dayTasks.length} tasks` : ""}`} key={day}>
                  <span className="life-calendar-date">{String(day).padStart(2, "0")}</span>
                  <div className="life-calendar-events">
                    {dayTasks.slice(0, 2).map((task) => <button className={`life-calendar-event ${task.category}`} type="button" onClick={() => onEdit(task)} aria-label={`Edit ${task.title} at ${clockLabel(task.due_at!)}`} key={task.id}><time>{clockLabel(task.due_at!)}</time><span>{task.title}</span></button>)}
                    {dayTasks.length > 2 && <b>+{dayTasks.length - 2} MORE</b>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <footer className="life-calendar-foot"><span><i className="scheduled" />SCHEDULED</span><span><i className="overdue" />OVERDUE</span><b>{tasks.filter((task) => task.due_at?.slice(0, 7) === monthKey).length} THIS MONTH</b></footer>
    </div>
  );
}

export function LifePage() {
  const [tasks, setTasks] = useState<LifeTask[]>([]);
  const [form, setForm] = useState<LifeTaskPayload>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = localMinuteKey();
  const [calendarMonth, setCalendarMonth] = useState(now.slice(0, 7));

  const refreshTasks = useCallback(() => {
    loadLifeTasks().then((items) => {
      setTasks(items);
      const dated = items
        .filter((task) => !task.completed && task.due_at)
        .sort((a, b) => a.due_at!.localeCompare(b.due_at!));
      const currentMonth = now.slice(0, 7);
      if (!dated.some((task) => task.due_at!.slice(0, 7) === currentMonth)) {
        const nearest = dated.find((task) => task.due_at! >= now) ?? dated[0];
        if (nearest?.due_at) setCalendarMonth(nearest.due_at.slice(0, 7));
      }
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load life timeline");
    });
  }, [now]);

  useEffect(() => {
    refreshTasks();
    window.addEventListener("daily-agent:changed", refreshTasks);
    return () => window.removeEventListener("daily-agent:changed", refreshTasks);
  }, [refreshTasks]);

  const active = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const overdue = active.filter((task) => task.due_at && task.due_at < now).sort(byDueTime);
  const scheduled = active.filter((task) => task.due_at && task.due_at >= now).sort(byDueTime);
  const someday = active.filter((task) => !task.due_at);
  const completed = tasks.filter((task) => task.completed).sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const payload = { ...form, title: form.title.trim(), notes: form.notes.trim() };
      const saved = editingId === null
        ? await createLifeTask(payload)
        : await updateLifeTask(editingId, payload);
      setTasks((current) => editingId === null
        ? [...current, saved]
        : current.map((task) => task.id === saved.id ? saved : task));
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save life task");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (task: LifeTask) => {
    setError("");
    try {
      const updated = await updateLifeTask(task.id, { completed: !task.completed });
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update life task");
    }
  };

  const edit = (task: LifeTask) => {
    setEditingId(task.id);
    setForm({ title: task.title, category: task.category, due_at: task.due_at, notes: task.notes });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (task: LifeTask) => {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    setError("");
    try {
      await deleteLifeTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      if (editingId === task.id) resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete life task");
    }
  };

  const taskCard = (task: LifeTask, state: "overdue" | "scheduled" | "someday" | "done") => {
    const category = categoryInfo(task.category);
    return (
      <article className={`life-task-card ${state}`} key={task.id}>
        <button className="life-check" type="button" aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => toggle(task)}>{task.completed ? "✓" : ""}</button>
        <span className="life-category-mark">{category.mark}</span>
        <div className="life-task-copy">
          <div><span>{category.label}</span><time>{task.completed ? `DONE ${dueLabel(task.completed_at?.slice(0, 16) ?? null)}` : dueLabel(task.due_at)}</time></div>
          <h3>{task.title}</h3>
          {task.notes && <p>{task.notes}</p>}
        </div>
        <div className="life-task-actions"><button type="button" onClick={() => edit(task)}>EDIT</button><button type="button" onClick={() => remove(task)}>DELETE</button></div>
      </article>
    );
  };

  return (
    <main className="life-page">
      <section className="life-hero panel">
        <div><p className="eyebrow">LOCAL ONLY</p><h1>Life<br /><span>Queue</span></h1><p>Personal tasks only. No Calendar or Notion sync.</p></div>
        <div className="life-stats"><div><b>{active.length}</b><span>OPEN</span></div><div className={overdue.length ? "attention" : ""}><b>{overdue.length}</b><span>OVERDUE</span></div><div><b>{completed.length}</b><span>DONE</span></div></div>
      </section>

      {error && <div className="life-error" role="alert">{error}</div>}

      <section className="life-capture panel" aria-label={editingId === null ? "Add life task" : "Edit life task"}>
        <div className="life-section-head"><div><h2>{editingId === null ? "Add a Task" : "Edit Task"}</h2></div>{editingId !== null && <button type="button" onClick={resetForm}>CANCEL</button>}</div>
        <form onSubmit={(event) => event.preventDefault()}>
          <label className="life-title-field"><span>Task / 事项 *</span><input autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：续驾照、预约牙医、退 Amazon 包裹…" /></label>
          <label><span>Category / 类别</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as LifeCategory })}>{categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
          <label><span>When / 什么时候</span><input type="datetime-local" value={form.due_at ?? ""} onChange={(event) => setForm({ ...form, due_at: event.target.value || null })} /></label>
          <label className="life-notes-field"><span>Notes / 备注（可选，可换行）</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="地址、需要带什么、下一步…" /></label>
          <button className="life-save" type="button" onClick={save} disabled={busy || !form.title.trim()}>{busy ? "SAVING…" : editingId === null ? "ADD TO LIFE →" : "SAVE CHANGES"}</button>
        </form>
      </section>

      <section className="life-timeline panel" aria-label="Life timeline">
        <div className="life-section-head"><div><h2>Timeline</h2></div><b>{active.length} OPEN</b></div>
        <LifeCalendar monthKey={calendarMonth} tasks={active} now={now} onMonthChange={setCalendarMonth} onEdit={edit} />
        <TripPlanner />
        {!active.length && <div className="life-empty"><b>NOTHING WAITING</b><p>生活事项已经清空。新的事情直接在上面快速记录。</p></div>}
        {overdue.length > 0 && <div className="life-group"><header><span>!</span><div><b>OVERDUE</b><small>Complete, reschedule, or delete</small></div></header>{overdue.map((task) => taskCard(task, "overdue"))}</div>}
        {scheduled.length > 0 && <div className="life-group"><header><span>→</span><div><b>UPCOMING</b><small>Sorted by time</small></div></header>{scheduled.map((task) => taskCard(task, "scheduled"))}</div>}
        {someday.length > 0 && <div className="life-group"><header><span>∞</span><div><b>SOMEDAY</b><small>No deadline</small></div></header>{someday.map((task) => taskCard(task, "someday"))}</div>}
      </section>

      <details className="life-history panel">
        <summary><span><b>COMPLETED</b><small>Collapsed by default; tasks can be reopened</small></span><strong>{completed.length}</strong></summary>
        <div>{completed.length ? completed.map((task) => taskCard(task, "done")) : <p className="life-history-empty">还没有完成记录。</p>}</div>
      </details>
    </main>
  );
}
