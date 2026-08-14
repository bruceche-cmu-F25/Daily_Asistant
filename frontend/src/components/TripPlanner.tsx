import { useEffect, useMemo, useState } from "react";

import { deleteTripPlan, loadTripPlan, saveTripPlan } from "../api";
import type { TripPlan, TripPlanPayload, TripStop } from "../types";


type TripDraft = Omit<TripPlanPayload, "stops">;
type StopDraft = { title: string; location: string; visit_at: string; notes: string };
type MapMode = "place" | "day-route" | "trip-route";

const emptyTrip: TripDraft = { title: "", destination: "", start_date: null, end_date: null, notes: "" };
const emptyStop: StopDraft = { title: "", location: "", visit_at: "", notes: "" };

function sortedStops(stops: TripStop[]) {
  return [...stops].sort((left, right) => {
    const leftTime = left.visit_at ?? "9999";
    const rightTime = right.visit_at ?? "9999";
    return leftTime.localeCompare(rightTime) || left.position - right.position;
  });
}

function tripRange(plan: TripDraft) {
  if (!plan.start_date && !plan.end_date) return "DATES OPEN";
  const format = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00`));
  if (plan.start_date && plan.end_date) return `${format(plan.start_date)} — ${format(plan.end_date)}`;
  return format((plan.start_date ?? plan.end_date)!);
}

function stopTime(value: string | null) {
  if (!value) return "TIME OPEN";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dayLabel(value: string) {
  if (value === "unscheduled") return "UNSCHEDULED / 待安排";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${value}T12:00`));
}

function mapSearchUrl(query: string, embed = false) {
  const encoded = encodeURIComponent(query);
  return embed
    ? `https://www.google.com/maps?q=${encoded}&output=embed`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

function routeUrl(stops: TripStop[]) {
  const places = stops.map((stop) => stop.location || stop.title).filter(Boolean);
  if (places.length < 2) return places[0] ? mapSearchUrl(places[0]) : "";
  const parameters = new URLSearchParams({ api: "1", origin: places[0], destination: places[places.length - 1] });
  if (places.length > 2) parameters.set("waypoints", places.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}

function routeEmbedUrl(stops: TripStop[]) {
  const places = stops.slice(0, 10).map((stop) => stop.location || stop.title).filter(Boolean);
  if (places.length < 2) return places[0] ? mapSearchUrl(places[0], true) : "";
  const parameters = new URLSearchParams({
    output: "embed",
    saddr: places[0],
    daddr: places.slice(1).join(" to:"),
  });
  return `https://www.google.com/maps?${parameters.toString()}`;
}

export function TripPlanner() {
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [draft, setDraft] = useState<TripDraft>(emptyTrip);
  const [stopDraft, setStopDraft] = useState<StopDraft>(emptyStop);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("place");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTripPlan().then((loaded) => {
      setPlan(loaded);
      if (loaded) {
        setDraft({ title: loaded.title, destination: loaded.destination, start_date: loaded.start_date, end_date: loaded.end_date, notes: loaded.notes });
        setActiveStopId(sortedStops(loaded.stops)[0]?.id ?? null);
      }
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load trip plan");
    }).finally(() => setLoading(false));
  }, []);

  const stops = useMemo(() => sortedStops(plan?.stops ?? []), [plan]);
  const grouped = useMemo(() => {
    const groups = new Map<string, TripStop[]>();
    stops.forEach((stop) => {
      const day = stop.visit_at?.slice(0, 10) ?? "unscheduled";
      groups.set(day, [...(groups.get(day) ?? []), stop]);
    });
    return [...groups.entries()];
  }, [stops]);
  const activeStop = stops.find((stop) => stop.id === activeStopId) ?? stops[0] ?? null;
  const mapQuery = activeStop?.location || activeStop?.title || draft.destination;
  const activeDayStops = activeStop?.visit_at
    ? stops.filter((stop) => stop.visit_at?.slice(0, 10) === activeStop.visit_at!.slice(0, 10))
    : activeStop ? [activeStop] : [];
  const mapStops = mapMode === "day-route" ? activeDayStops : mapMode === "trip-route" ? stops : [];
  const mapSrc = mapMode === "place"
    ? mapQuery ? mapSearchUrl(mapQuery, true) : ""
    : routeEmbedUrl(mapStops);
  const mapTitle = mapMode === "day-route"
    ? "day route"
    : mapMode === "trip-route" ? "full trip route" : activeStop?.title || draft.destination || "trip destination";
  const routeStops = mapMode === "day-route" ? activeDayStops : stops;

  const persist = async (nextStops: TripPlanPayload["stops"] = plan?.stops ?? []) => {
    if (!draft.title.trim()) return null;
    setBusy(true);
    setError("");
    try {
      const saved = await saveTripPlan({
        ...draft,
        title: draft.title.trim(),
        destination: draft.destination.trim(),
        notes: draft.notes.trim(),
        stops: nextStops,
      });
      setPlan(saved);
      setDraft({ title: saved.title, destination: saved.destination, start_date: saved.start_date, end_date: saved.end_date, notes: saved.notes });
      return saved;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save trip plan");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveStop = async () => {
    if (!stopDraft.title.trim() || !draft.title.trim()) return;
    const item = {
      id: editingStopId,
      title: stopDraft.title.trim(),
      location: stopDraft.location.trim(),
      visit_at: stopDraft.visit_at || null,
      notes: stopDraft.notes.trim(),
    };
    const nextStops = editingStopId
      ? (plan?.stops ?? []).map((stop) => stop.id === editingStopId ? item : stop)
      : [...(plan?.stops ?? []), item];
    const saved = await persist(nextStops);
    if (!saved) return;
    const selected = editingStopId
      ? saved.stops.find((stop) => stop.id === editingStopId)
      : [...saved.stops].reverse().find((stop) => stop.title === item.title && stop.location === item.location);
    setActiveStopId(selected?.id ?? saved.stops[0]?.id ?? null);
    setMapMode("place");
    setEditingStopId(null);
    setStopDraft(emptyStop);
  };

  const editStop = (stop: TripStop) => {
    setEditingStopId(stop.id);
    setStopDraft({ title: stop.title, location: stop.location, visit_at: stop.visit_at ?? "", notes: stop.notes });
    setActiveStopId(stop.id);
    setMapMode("place");
  };

  const removeStop = async (stop: TripStop) => {
    const saved = await persist((plan?.stops ?? []).filter((item) => item.id !== stop.id));
    if (saved && activeStopId === stop.id) setActiveStopId(saved.stops[0]?.id ?? null);
  };

  const clearTrip = async () => {
    if (!window.confirm(`Clear “${plan?.title ?? draft.title}” and every itinerary stop?`)) return;
    setBusy(true);
    try {
      await deleteTripPlan();
      setPlan(null);
      setDraft(emptyTrip);
      setStopDraft(emptyStop);
      setActiveStopId(null);
      setMapMode("place");
      setEditingStopId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to clear trip plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="trip-planner panel" aria-label="Trip planner">
      <header className="trip-planner-head">
        <div><h2>Trip Planner</h2><p>Edit the itinerary and map side by side.</p></div>
        <div><b>{plan ? `${stops.length} STOPS` : "NEW TRIP"}</b><span>{tripRange(draft)}</span></div>
      </header>
      {error && <div className="trip-error" role="alert">{error}</div>}
      {loading ? <div className="trip-loading">LOADING LOCAL TRIP…</div> : <>
        <form className="trip-overview-form" onSubmit={(event) => event.preventDefault()}>
          <label><span>Trip name / 旅行名称 *</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：Japan 2026" /></label>
          <label><span>Destination / 目的地</span><input value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} placeholder="Tokyo, Japan" /></label>
          <label><span>Start / 出发</span><input type="date" value={draft.start_date ?? ""} onChange={(event) => setDraft({ ...draft, start_date: event.target.value || null })} /></label>
          <label><span>End / 返回</span><input type="date" value={draft.end_date ?? ""} onChange={(event) => setDraft({ ...draft, end_date: event.target.value || null })} /></label>
          <label className="wide"><span>Trip notes / 总备注（可换行）</span><textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="航班、酒店、需要提前预订的东西…" /></label>
          <div className="trip-overview-actions wide"><button className="primary" type="button" disabled={busy || !draft.title.trim()} onClick={() => persist()}>{busy ? "SAVING…" : plan ? "SAVE TRIP" : "CREATE TRIP"}</button>{plan && <button className="danger" type="button" disabled={busy} onClick={clearTrip}>CLEAR TRIP</button>}</div>
        </form>

        <div className="trip-workspace">
          <div className="trip-itinerary">
            <div className="trip-stop-editor">
              <div><h3>{editingStopId ? "Edit Place" : "Add a Place"}</h3></div>
              <form onSubmit={(event) => event.preventDefault()}>
                <label><span>Place / 活动 *</span><input value={stopDraft.title} onChange={(event) => setStopDraft({ ...stopDraft, title: event.target.value })} placeholder="Senso-ji morning visit" /></label>
                <label><span>Map location / 地图地点</span><input value={stopDraft.location} onChange={(event) => setStopDraft({ ...stopDraft, location: event.target.value })} placeholder="Senso-ji, Tokyo" /></label>
                <label><span>When / 时间</span><input type="datetime-local" value={stopDraft.visit_at} onChange={(event) => setStopDraft({ ...stopDraft, visit_at: event.target.value })} /></label>
                <label className="wide"><span>Notes / 备注（可换行）</span><textarea rows={2} value={stopDraft.notes} onChange={(event) => setStopDraft({ ...stopDraft, notes: event.target.value })} placeholder="门票、预约号、想吃什么…" /></label>
                <div className="trip-stop-actions wide"><button className="primary" type="button" disabled={busy || !draft.title.trim() || !stopDraft.title.trim()} onClick={saveStop}>{editingStopId ? "SAVE STOP" : "+ ADD TO ITINERARY"}</button>{editingStopId && <button type="button" onClick={() => { setEditingStopId(null); setStopDraft(emptyStop); }}>CANCEL</button>}</div>
              </form>
            </div>

            {grouped.length ? <div className="trip-days">{grouped.map(([day, dayStops], dayIndex) => (
              <section className="trip-day" key={day}>
                <header><span>DAY {String(dayIndex + 1).padStart(2, "0")}</span><div><b>{dayLabel(day)}</b><small>{dayStops.length} PLACE{dayStops.length === 1 ? "" : "S"}</small></div></header>
                <div>{dayStops.map((stop, index) => <article className={activeStop?.id === stop.id ? "active" : ""} key={stop.id}>
                  <button className="trip-stop-focus" type="button" aria-label={`Focus ${stop.title} on map`} onClick={() => { setActiveStopId(stop.id); setMapMode("place"); }}><span>{index + 1}</span><div><time>{stopTime(stop.visit_at)}</time><h4>{stop.title}</h4><p>{stop.location || "Uses place name for map"}</p>{stop.notes && <small>{stop.notes}</small>}</div></button>
                  <div><button type="button" onClick={() => editStop(stop)}>EDIT</button><button type="button" onClick={() => removeStop(stop)}>×</button></div>
                </article>)}</div>
              </section>
            ))}</div> : <div className="trip-empty"><b>NO STOPS YET</b><p>Add the first place above. It will appear here and on the map.</p></div>}
          </div>

          <aside className="trip-map" aria-label="Trip map">
            <header><div><h3>{mapMode === "day-route" ? "Day Route" : mapMode === "trip-route" ? "Full Route" : activeStop?.title || draft.destination || "Add a Destination"}</h3></div><span>{mapMode === "place" ? activeStop ? stopTime(activeStop.visit_at) : "CURRENT TRIP" : `${Math.min(mapStops.length, 10)} STOPS`}</span></header>
            <div className="trip-map-modes" aria-label="Map display mode">
              <button type="button" className={mapMode === "place" ? "active" : ""} onClick={() => setMapMode("place")}>PLACE</button>
              <button type="button" className={mapMode === "day-route" ? "active" : ""} disabled={activeDayStops.length < 2} onClick={() => setMapMode("day-route")}>DAY ROUTE</button>
              <button type="button" className={mapMode === "trip-route" ? "active" : ""} disabled={stops.length < 2} onClick={() => setMapMode("trip-route")}>FULL ROUTE</button>
              <small>ROUTE FOLLOWS ITINERARY TIME ORDER</small>
            </div>
            {mapSrc ? <iframe title={`Map for ${mapTitle}`} src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="trip-map-empty"><span>⌖</span><b>MAP WAITING</b><p>Add a destination or at least two itinerary places to plan a route.</p></div>}
            <footer>{mapMode === "place" && mapQuery && <a href={mapSearchUrl(mapQuery)} target="_blank" rel="noopener noreferrer">OPEN MAP ↗</a>}{mapMode !== "place" && routeStops.length > 1 && <a href={routeUrl(routeStops.slice(0, 10))} target="_blank" rel="noopener noreferrer">OPEN ROUTE ↗</a>}<small>Google Maps embed · {stops.length > 10 ? "first 10 stops · " : ""}no API key stored</small></footer>
          </aside>
        </div>
      </>}
    </section>
  );
}
