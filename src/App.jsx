import { useState, useEffect, useRef, useCallback } from "react";

// ── API ───────────────────────────────────────────────────────
async function todoistFetch(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/todoist?path=${path}`, opts);
  if (!res.ok) throw new Error(`Todoist error ${res.status}`);
  return res.json();
}

// ── COLORS ────────────────────────────────────────────────────
const PROJECT_COLORS = {
  berry_red: "#b8256f", red: "#db4035", orange: "#ff9933",
  yellow: "#e0ac00", olive_green: "#afb83b", lime_green: "#7ecc49",
  green: "#299438", mint_green: "#6accbc", teal: "#158fad",
  sky_blue: "#14aaf5", light_blue: "#96c3eb", blue: "#4073ff",
  grape: "#884dff", violet: "#af38eb", lavender: "#eb96eb",
  magenta: "#e05194", salmon: "#ff8d85", charcoal: "#555e6e",
  grey: "#808080", taupe: "#ccac93",
};

// Fases/tags → colores en el gantt
const PHASE_COLORS = {
  preproduccion:     { bg: "#DBEAFE", border: "#3B82F6", text: "#1E3A8A" },
  "modelos-ia":      { bg: "#EDE9FE", border: "#7C3AED", text: "#4C1D95" },
  "produccion-foto": { bg: "#D1FAE5", border: "#059669", text: "#064E3B" },
  "produccion-video":{ bg: "#FEF3C7", border: "#D97706", text: "#78350F" },
  postproduccion:    { bg: "#FCE7F3", border: "#DB2777", text: "#831843" },
  entrega:           { bg: "#FFEDD5", border: "#EA580C", text: "#7C2D12" },
  default:           { bg: "#F1F5F9", border: "#94A3B8", text: "#334155" },
};

function getPhaseColor(labels = []) {
  for (const label of labels) {
    const key = label.toLowerCase().replace(/_/g, "-");
    if (PHASE_COLORS[key]) return PHASE_COLORS[key];
  }
  return PHASE_COLORS.default;
}

function getProjectColor(color) {
  return PROJECT_COLORS[color] || "#4073ff";
}

function hexToRgba(hex, alpha) {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── DATE UTILS ────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  return new Date(str.split("T")[0] + "T00:00:00");
}

function formatDate(date) {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

function formatShort(date) {
  if (!date) return "—";
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── PARSE TASK DATES + DEPS ───────────────────────────────────
// Formato en descripción:
//   Inicio: 20 mayo
//   Depende: nombre-tarea-1, nombre-tarea-2
function getTaskDates(task) {
  const deadline = task.deadline?.date ? parseDate(task.deadline.date) : null;
  const due = task.due?.date ? parseDate(task.due.date) : null;
  const end = deadline || due;
  if (!end) return null;

  const match = task.description?.match(/Inicio:\s*(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
  let start = end;
  if (match) {
    const monthMap = { enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11 };
    const d = parseInt(match[1]);
    const m = monthMap[match[2].toLowerCase()];
    const y = end.getFullYear();
    const candidate = new Date(y, m, d);
    if (candidate <= end) start = candidate;
  }
  return { start, end };
}

function getTaskDeps(task) {
  const match = task.description?.match(/Depende:\s*([^\n]+)/i);
  if (!match) return [];
  return match[1].split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

// ── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState(null);
  const [collapsedProjects, setCollapsedProjects] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const [labelWidth, setLabelWidth] = useState(260);
  const [dateColWidth] = useState(180); // fecha inicio + fin
  const [rangeStart, setRangeStart] = useState(() => {
    const d = today(); d.setDate(d.getDate() - 7); return d;
  });

  const DAYS = 120;
  const DAY_W = 26;
  const ROW_H = 36;
  const HEADER_H = 56;
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const labelResizeRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true); setError("");
    try {
      const [projs, tsks] = await Promise.all([
        todoistFetch("projects"),
        todoistFetch("tasks"),
      ]);
      setProjects(projs);
      setTasks(tsks);
      if (!selectedProjects) setSelectedProjects(new Set(projs.map(p => p.id)));
    } catch (e) { setError("Error: " + e.message); }
    finally { setLoading(false); }
  }

  function toggleProject(id) {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCollapse(id) {
    setCollapsedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p; });

  // Mapa de tareas por nombre (para dependencias)
  const taskByName = {};
  tasks.forEach(t => { taskByName[t.content.toLowerCase()] = t; });

  const rangeEnd = addDays(rangeStart, DAYS);
  const tasksWithDates = tasks
    .filter(t => selectedProjects?.has(t.project_id))
    .map(t => ({ task: t, dates: getTaskDates(t) }))
    .filter(({ dates }) => dates && dates.end >= rangeStart && dates.start <= rangeEnd);

  const byProject = {};
  tasksWithDates.forEach(({ task, dates }) => {
    if (!byProject[task.project_id]) byProject[task.project_id] = [];
    byProject[task.project_id].push({ task, dates });
  });

  const orderedProjectIds = projects
    .map(p => p.id)
    .filter(id => byProject[id]?.length > 0 && selectedProjects?.has(id));

  const rows = [];
  orderedProjectIds.forEach(pid => {
    const proj = projectMap[pid];
    const isCollapsed = collapsedProjects.has(pid);
    rows.push({ type: "header", proj, isCollapsed });
    if (!isCollapsed) {
      byProject[pid].forEach(({ task, dates }) => {
        rows.push({ type: "task", task, dates, proj });
      });
    }
  });

  function dateToX(date) {
    return labelWidth + dateColWidth + daysBetween(rangeStart, date) * DAY_W;
  }

  // ── DRAG (mover barra entera) ──────────────────────────────
  function onBarMouseDown(e, task, dates) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const origEnd = new Date(dates.end);
    const origStart = new Date(dates.start);
    const state = { taskId: task.id, startX, origEnd, origStart, currentDelta: 0, mode: "move" };
    dragRef.current = state;
    setDragState({ ...state });

    function onMove(ev) {
      const delta = Math.round((ev.clientX - startX) / DAY_W);
      if (delta !== dragRef.current.currentDelta) {
        dragRef.current.currentDelta = delta;
        setDragState({ ...dragRef.current, currentDelta: delta });
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const delta = dragRef.current.currentDelta;
      if (delta !== 0) {
        const newEnd = addDays(origEnd, delta);
        const newStart = addDays(origStart, delta);
        saveDate(task, newStart, newEnd);
      }
      dragRef.current = null; setDragState(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── RESIZE (tirador izquierdo/derecho) ────────────────────
  function onResizeMouseDown(e, task, dates, side) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const origEnd = new Date(dates.end);
    const origStart = new Date(dates.start);
    const state = { taskId: task.id, startX, origEnd, origStart, currentDelta: 0, mode: "resize-" + side };
    resizeRef.current = state;
    setResizeState({ ...state });

    function onMove(ev) {
      const delta = Math.round((ev.clientX - startX) / DAY_W);
      if (delta !== resizeRef.current.currentDelta) {
        resizeRef.current.currentDelta = delta;
        setResizeState({ ...resizeRef.current, currentDelta: delta });
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const delta = resizeRef.current.currentDelta;
      if (delta !== 0) {
        if (side === "right") {
          const newEnd = addDays(origEnd, delta);
          if (newEnd >= origStart) saveDate(task, origStart, newEnd);
        } else {
          const newStart = addDays(origStart, delta);
          if (newStart <= origEnd) saveDate(task, newStart, origEnd);
        }
      }
      resizeRef.current = null; setResizeState(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── GUARDAR FECHAS + PROPAGAR DEPENDENCIAS ────────────────
  async function saveDate(task, newStart, newEnd) {
    setSaving(task.id);
    const oldDates = getTaskDates(task);
    const delta = daysBetween(oldDates.end, newEnd);

    // Encontrar tareas dependientes (en cadena)
    function getDependents(taskContent) {
      return tasks.filter(t => {
        const deps = getTaskDeps(t);
        return deps.includes(taskContent.toLowerCase());
      });
    }

    // Actualizar tarea principal + dependientes en cascada
    const toUpdate = [{ task, newStart, newEnd }];
    const visited = new Set([task.id]);

    function collectDeps(t, delta) {
      getDependents(t.content).forEach(dep => {
        if (visited.has(dep.id)) return;
        visited.add(dep.id);
        const depDates = getTaskDates(dep);
        if (!depDates) return;
        const depNewStart = addDays(depDates.start, delta);
        const depNewEnd = addDays(depDates.end, delta);
        toUpdate.push({ task: dep, newStart: depNewStart, newEnd: depNewEnd });
        collectDeps(dep, delta);
      });
    }
    collectDeps(task, delta);

    try {
      for (const { task: t, newStart: ns, newEnd: ne } of toUpdate) {
        const body = {};
        if (t.deadline?.date) body.deadline = { date: formatDate(ne) };
        else body.due_date = formatDate(ne);

        // Actualizar fecha inicio en descripción
        const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
        const startStr = `Inicio: ${ns.getDate()} ${monthNames[ns.getMonth()]}`;
        let newDesc = (t.description || "").replace(/Inicio:.*(\n|$)/i, "").trim();
        newDesc = startStr + (newDesc ? "\n" + newDesc : "");
        body.description = newDesc;

        await todoistFetch(`tasks/${t.id}`, "POST", body);
      }

      setTasks(prev => prev.map(t => {
        const updated = toUpdate.find(u => u.task.id === t.id);
        if (!updated) return t;
        const { newStart: ns, newEnd: ne } = updated;
        const u = { ...t };
        if (t.deadline?.date) u.deadline = { ...t.deadline, date: formatDate(ne) };
        else u.due = { ...t.due, date: formatDate(ne) };
        const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
        const startStr = `Inicio: ${ns.getDate()} ${monthNames[ns.getMonth()]}`;
        let newDesc = (t.description || "").replace(/Inicio:.*(\n|$)/i, "").trim();
        u.description = startStr + (newDesc ? "\n" + newDesc : "");
        return u;
      }));
    } catch { setError("Error guardando en Todoist."); }
    finally { setSaving(null); }
  }

  function getBarDates(task, dates) {
    const activeState = dragState?.taskId === task.id ? dragState : resizeState?.taskId === task.id ? resizeState : null;
    if (!activeState) return dates;
    const { origStart, origEnd, currentDelta, mode } = activeState;
    if (mode === "move") return { start: addDays(origStart, currentDelta), end: addDays(origEnd, currentDelta) };
    if (mode === "resize-right") return { start: origStart, end: addDays(origEnd, currentDelta) };
    if (mode === "resize-left") return { start: addDays(origStart, currentDelta), end: origEnd };
    return dates;
  }

  // ── RESIZE LABEL COLUMN ───────────────────────────────────
  function onLabelResizeMouseDown(e) {
    e.preventDefault();
    const startX = e.clientX;
    const origW = labelWidth;
    function onMove(ev) {
      const newW = Math.max(160, origW + ev.clientX - startX);
      setLabelWidth(newW);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const todayDate = today();
  const totalW = labelWidth + dateColWidth + DAYS * DAY_W + 40;
  const totalH = HEADER_H + rows.length * ROW_H + 60;

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Inter', 'DM Sans', sans-serif", display: "flex", flexDirection: "column", color: "#1E293B" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52, borderBottom: "1px solid #E2E8F0",
        background: "#FFFFFF", position: "sticky", top: 0, zIndex: 200, flexShrink: 0,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: 3, color: "#94A3B8", textTransform: "uppercase", fontWeight: 600 }}>NOWHERE</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginLeft: 10 }}>Timeline</span>
          </div>
          {loading && <span style={{ fontSize: 11, color: "#94A3B8", letterSpacing: 1 }}>Cargando...</span>}
          {saving && <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>Guardando...</span>}
          {error && <span style={{ fontSize: 11, color: "#EF4444" }}>{error}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Btn onClick={() => setRangeStart(d => addDays(d, -30))}>← 30d</Btn>
          <Btn onClick={() => setRangeStart(() => { const d = today(); d.setDate(d.getDate() - 7); return d; })} primary>Hoy</Btn>
          <Btn onClick={() => setRangeStart(d => addDays(d, 30))}>30d →</Btn>
          <Btn onClick={loadData} style={{ marginLeft: 8 }}>↻ Sync</Btn>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <div style={{ width: 200, background: "#FFFFFF", borderRight: "1px solid #E2E8F0", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "14px 16px 8px", fontSize: 10, letterSpacing: 2, color: "#94A3B8", textTransform: "uppercase", fontWeight: 600 }}>Proyectos</div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 10px" }}>
            <MiniBtn onClick={() => setSelectedProjects(new Set(projects.map(p => p.id)))}>Todos</MiniBtn>
            <MiniBtn onClick={() => setSelectedProjects(new Set())}>Ninguno</MiniBtn>
          </div>
          {projects.map(p => {
            const color = getProjectColor(p.color);
            const active = selectedProjects?.has(p.id);
            const hasTasks = tasks.some(t => t.project_id === p.id && getTaskDates(t));
            return (
              <div key={p.id} onClick={() => toggleProject(p.id)} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 16px 7px 12px", cursor: "pointer",
                borderLeft: `3px solid ${active ? color : "transparent"}`,
                background: active ? hexToRgba(color, 0.06) : "transparent",
                transition: "all 0.12s", opacity: hasTasks ? 1 : 0.35,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? color : "#CBD5E1", flexShrink: 0, transition: "background 0.12s" }} />
                <div style={{ fontSize: 12, color: active ? "#1E293B" : "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: active ? 500 : 400 }}>
                  {p.name}
                </div>
              </div>
            );
          })}

          {/* Leyenda fases */}
          <div style={{ padding: "20px 12px 12px", borderTop: "1px solid #F1F5F9", marginTop: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#94A3B8", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Fases</div>
            {Object.entries(PHASE_COLORS).filter(([k]) => k !== "default").map(([key, c]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1.5px solid ${c.border}`, flexShrink: 0 }} />
                <div style={{ fontSize: 11, color: "#64748B" }}>{key}</div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 10, lineHeight: 1.6 }}>
              Etiqueta tus tareas en Todoist con @preproduccion, @modelos-ia, @produccion-foto, @produccion-video, @postproduccion o @entrega
            </div>
          </div>
        </div>

        {/* Gantt */}
        <div style={{ flex: 1, overflow: "auto", position: "relative", background: "#F8FAFC" }}>
          <div style={{ width: totalW, minHeight: totalH, position: "relative" }}>

            {/* Header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 100, background: "#FFFFFF",
              borderBottom: "1px solid #E2E8F0", height: HEADER_H, display: "flex",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              {/* Label col header */}
              <div style={{
                width: labelWidth, flexShrink: 0, borderRight: "1px solid #E2E8F0",
                display: "flex", alignItems: "flex-end", padding: "0 16px 10px",
                fontSize: 10, color: "#94A3B8", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
                position: "relative",
              }}>
                Tarea
                {/* Resize handle */}
                <div onMouseDown={onLabelResizeMouseDown} style={{
                  position: "absolute", right: 0, top: 0, bottom: 0, width: 6,
                  cursor: "col-resize", background: "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 2, height: 20, background: "#E2E8F0", borderRadius: 1 }} />
                </div>
              </div>
              {/* Date cols header */}
              <div style={{ width: dateColWidth, flexShrink: 0, borderRight: "1px solid #E2E8F0", display: "flex", alignItems: "flex-end", padding: "0 0 10px" }}>
                <div style={{ flex: 1, textAlign: "center", fontSize: 10, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Inicio</div>
                <div style={{ width: 1, background: "#E2E8F0", alignSelf: "stretch" }} />
                <div style={{ flex: 1, textAlign: "center", fontSize: 10, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Fin</div>
              </div>
              {/* Day headers */}
              <div style={{ display: "flex" }}>
                {Array.from({ length: DAYS }, (_, i) => {
                  const d = addDays(rangeStart, i);
                  const isToday = d.getTime() === todayDate.getTime();
                  const dow = d.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const isFirst = d.getDate() === 1;
                  return (
                    <div key={i} style={{
                      width: DAY_W, flexShrink: 0,
                      background: isToday ? "#EFF6FF" : isWeekend ? "#F8FAFC" : "#FFFFFF",
                      borderRight: "1px solid #F1F5F9",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
                      paddingBottom: 8, position: "relative",
                    }}>
                      {isFirst && (
                        <div style={{ position: "absolute", top: 10, left: 2, fontSize: 8, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: 600 }}>
                          {d.toLocaleString("es", { month: "short" })}
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: isToday ? "#3B82F6" : isWeekend ? "#CBD5E1" : "#94A3B8", fontWeight: isToday ? 700 : 400 }}>
                        {d.getDate()}
                      </div>
                      {isToday && <div style={{ position: "absolute", bottom: 0, width: 2, height: 4, background: "#3B82F6", borderRadius: 1 }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Línea de hoy */}
            {daysBetween(rangeStart, todayDate) >= 0 && daysBetween(rangeStart, todayDate) < DAYS && (
              <div style={{
                position: "absolute", top: HEADER_H, bottom: 0,
                left: labelWidth + dateColWidth + daysBetween(rangeStart, todayDate) * DAY_W + DAY_W / 2,
                width: 1, background: "#BFDBFE", pointerEvents: "none", zIndex: 5,
              }} />
            )}

            {/* Filas */}
            {rows.map((row, ri) => {
              const y = HEADER_H + ri * ROW_H;
              const rowBg = ri % 2 === 0 ? "#FFFFFF" : "#F8FAFC";

              if (row.type === "header") {
                const color = getProjectColor(row.proj.color);
                const isCollapsed = row.isCollapsed;
                return (
                  <div key={`h_${row.proj.id}_${ri}`} style={{
                    position: "absolute", top: y, left: 0, width: totalW, height: ROW_H,
                    background: "#F1F5F9", borderBottom: "1px solid #E2E8F0",
                    borderLeft: `3px solid ${color}`, display: "flex", alignItems: "center",
                    cursor: "pointer",
                  }} onClick={() => toggleCollapse(row.proj.id)}>
                    <div style={{ width: labelWidth - 3, paddingLeft: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#94A3B8", transition: "transform 0.15s", display: "inline-block", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.proj.name}
                      </span>
                    </div>
                  </div>
                );
              }

              const { task, dates, proj } = row;
              const phaseColor = getPhaseColor(task.labels || []);
              const projColor = getProjectColor(proj.color);
              const barDates = getBarDates(task, dates);
              const isDragging = (dragState?.taskId === task.id) || (resizeState?.taskId === task.id);
              const isSaving = saving === task.id;
              const isLate = dates.end < todayDate;

              const x1 = dateToX(barDates.start);
              const x2 = dateToX(barDates.end) + DAY_W;
              const barW = Math.max(x2 - x1, DAY_W);

              return (
                <div key={task.id} style={{
                  position: "absolute", top: y, left: 0, width: totalW, height: ROW_H,
                  background: rowBg, borderBottom: "1px solid #F1F5F9",
                  display: "flex", alignItems: "center",
                }}>
                  {/* Label */}
                  <div style={{
                    width: labelWidth, flexShrink: 0, paddingLeft: 20, paddingRight: 24,
                    fontSize: 12, color: isLate ? "#EF4444" : "#334155",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    borderRight: "1px solid #F1F5F9", fontWeight: 400,
                    position: "relative",
                  }}>
                    {isLate && <span style={{ marginRight: 4, fontSize: 10 }}>⚑</span>}
                    {task.content}
                    <div onMouseDown={onLabelResizeMouseDown} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize" }} />
                  </div>

                  {/* Date cols */}
                  <div style={{ width: dateColWidth, flexShrink: 0, borderRight: "1px solid #F1F5F9", display: "flex", alignItems: "center" }}>
                    <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#64748B" }}>{formatShort(barDates.start)}</div>
                    <div style={{ width: 1, background: "#F1F5F9", alignSelf: "stretch" }} />
                    <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#64748B" }}>{formatShort(barDates.end)}</div>
                  </div>

                  {/* Bar zone */}
                  <div style={{ position: "relative", flex: 1, height: "100%" }}>
                    {/* Hover zone exacta sobre la barra */}
                    <div
                      style={{
                        position: "absolute",
                        left: x1 - labelWidth - dateColWidth,
                        width: barW,
                        top: 0, height: ROW_H,
                        zIndex: 2,
                      }}
                      onMouseEnter={e => setTooltip({ task, dates: barDates, proj, clientY: e.clientY, x: x1 })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {/* Barra */}
                      <div
                        onMouseDown={e => onBarMouseDown(e, task, dates)}
                        style={{
                          position: "absolute",
                          left: 0, width: barW,
                          top: 7, height: ROW_H - 14,
                          background: isSaving ? "#E2E8F0" : phaseColor.bg,
                          border: `1.5px solid ${isDragging ? phaseColor.border : hexToRgba(phaseColor.border, 0.6)}`,
                          borderRadius: 5,
                          cursor: isDragging ? "grabbing" : "grab",
                          display: "flex", alignItems: "center",
                          paddingLeft: 10, paddingRight: 10,
                          fontSize: 10, color: phaseColor.text, fontWeight: 600,
                          whiteSpace: "nowrap", overflow: "hidden",
                          userSelect: "none",
                          boxShadow: isDragging ? `0 4px 12px ${hexToRgba(phaseColor.border, 0.25)}` : "0 1px 2px rgba(0,0,0,0.06)",
                          transition: isDragging ? "none" : "box-shadow 0.15s",
                        }}
                      >
                        {/* Tirador izquierdo */}
                        <div
                          onMouseDown={e => onResizeMouseDown(e, task, dates, "left")}
                          style={{
                            position: "absolute", left: 0, top: 0, bottom: 0, width: 8,
                            cursor: "ew-resize", borderRadius: "5px 0 0 5px",
                            background: hexToRgba(phaseColor.border, 0.25),
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <div style={{ width: 1.5, height: 10, background: phaseColor.border, borderRadius: 1, opacity: 0.5 }} />
                        </div>

                        {barW > 80 && (
                          <span style={{ paddingLeft: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {task.labels?.length > 0 ? task.labels[0] : ""}
                          </span>
                        )}

                        {/* Tirador derecho */}
                        <div
                          onMouseDown={e => onResizeMouseDown(e, task, dates, "right")}
                          style={{
                            position: "absolute", right: 0, top: 0, bottom: 0, width: 8,
                            cursor: "ew-resize", borderRadius: "0 5px 5px 0",
                            background: hexToRgba(phaseColor.border, 0.25),
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <div style={{ width: 1.5, height: 10, background: phaseColor.border, borderRadius: 1, opacity: 0.5 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && !loading && (
              <div style={{ position: "absolute", top: HEADER_H + 60, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#CBD5E1" }}>
                <div style={{ fontSize: 36 }}>◻</div>
                <div style={{ fontSize: 13, color: "#94A3B8" }}>Sin tareas en este rango</div>
              </div>
            )}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position: "fixed",
              left: Math.min(tooltip.x + 16, window.innerWidth - 280),
              top: Math.min(tooltip.clientY + 12, window.innerHeight - 160),
              background: "#FFFFFF", border: "1px solid #E2E8F0",
              borderRadius: 10, padding: "14px 16px", maxWidth: 280, zIndex: 999,
              pointerEvents: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4, lineHeight: 1.4 }}>{tooltip.task.content}</div>
              <div style={{ fontSize: 11, color: getProjectColor(tooltip.proj.color), marginBottom: 6, fontWeight: 600 }}>{tooltip.proj.name}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>
                {formatShort(tooltip.dates.start)} → {formatShort(tooltip.dates.end)}
              </div>
              {tooltip.task.labels?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                  {tooltip.task.labels.map(l => (
                    <span key={l} style={{ fontSize: 10, background: "#F1F5F9", color: "#64748B", padding: "2px 6px", borderRadius: 4, fontWeight: 500 }}>
                      @{l}
                    </span>
                  ))}
                </div>
              )}
              {getTaskDeps(tooltip.task).length > 0 && (
                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 8 }}>
                  Depende de: {getTaskDeps(tooltip.task).join(", ")}
                </div>
              )}
              <div style={{ fontSize: 9, color: "#CBD5E1", marginTop: 10, letterSpacing: 0.5 }}>Arrastra para mover · Tiradores para redimensionar</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, style, primary }) {
  return (
    <button onClick={onClick} style={{
      background: primary ? "#3B82F6" : "transparent",
      border: primary ? "none" : "1px solid #E2E8F0",
      color: primary ? "#FFFFFF" : "#64748B",
      padding: "5px 14px", borderRadius: 6, cursor: "pointer",
      fontSize: 11, fontFamily: "inherit", fontWeight: 500,
      transition: "all 0.12s", ...style,
    }}>
      {children}
    </button>
  );
}

function MiniBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: "transparent", border: "1px solid #E2E8F0", color: "#94A3B8",
      padding: "4px 6px", borderRadius: 4, cursor: "pointer",
      fontSize: 10, fontFamily: "inherit", fontWeight: 500,
    }}>
      {children}
    </button>
  );
}
