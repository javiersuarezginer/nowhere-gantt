import { useState, useEffect, useRef } from "react";

// ── API ───────────────────────────────────────────────────────
async function todoistFetch(token, path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-todoist-token": token,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/todoist?path=${path}`, opts);
  if (!res.ok) throw new Error(`Todoist error ${res.status}`);
  return res.json();
}

// ── UTILS ─────────────────────────────────────────────────────
const PROJECT_COLORS = {
  berry_red: "#b8256f", red: "#db4035", orange: "#ff9933",
  yellow: "#fad000", olive_green: "#afb83b", lime_green: "#7ecc49",
  green: "#299438", mint_green: "#6accbc", teal: "#158fad",
  sky_blue: "#14aaf5", light_blue: "#96c3eb", blue: "#4073ff",
  grape: "#884dff", violet: "#af38eb", lavender: "#eb96eb",
  magenta: "#e05194", salmon: "#ff8d85", charcoal: "#808080",
  grey: "#b8b8b8", taupe: "#ccac93",
};

function getProjectColor(color) {
  return PROJECT_COLORS[color] || "#4073ff";
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseDate(str) {
  if (!str) return null;
  return new Date(str.split("T")[0] + "T00:00:00");
}

function formatDate(date) {
  if (!date) return "";
  return date.toISOString().split("T")[0];
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

function getTaskDates(task) {
  const deadline = task.deadline?.date ? parseDate(task.deadline.date) : null;
  const due = task.due?.date ? parseDate(task.due.date) : null;
  const end = deadline || due;
  if (!end) return null;

  // Intenta leer fecha inicio de la descripción
  const match = task.description?.match(/Inicio:\s*(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
  let start = end;
  if (match) {
    const monthMap = {
      enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
      julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
    };
    const d = parseInt(match[1]);
    const m = monthMap[match[2].toLowerCase()];
    const y = end.getFullYear();
    const candidate = new Date(y, m, d);
    if (candidate <= end) start = candidate;
  }
  return { start, end };
}

// ── TOKEN SCREEN ─────────────────────────────────────────────
function TokenScreen({ onConnect }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      await todoistFetch(token.trim(), "projects");
      localStorage.setItem("todoist_token", token.trim());
      onConnect(token.trim());
    } catch {
      setError("Token inválido. Compruébalo en Todoist → Settings → Integrations → Developer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0D0D0D", fontFamily: "'DM Mono', monospace",
    }}>
      <div style={{
        background: "#111", border: "1px solid #1E1E1E", borderRadius: 12,
        padding: "48px 56px", maxWidth: 420, width: "100%",
      }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 10, letterSpacing: 5, color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
            NOWHERE DEPARTMENT
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#F0F0F0", letterSpacing: -1, fontFamily: "'DM Sans', sans-serif" }}>
            Timeline
          </div>
          <div style={{ fontSize: 12, color: "#444", marginTop: 6, lineHeight: 1.5 }}>
            Gantt interactivo conectado a Todoist
          </div>
        </div>

        <label style={{ display: "block", fontSize: 10, color: "#444", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
          Todoist API Token
        </label>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleConnect()}
          placeholder="••••••••••••••••••••••••••••••••••••••••"
          style={{
            width: "100%", background: "#0D0D0D", border: "1px solid #2A2A2A",
            borderRadius: 6, padding: "12px 14px", color: "#F0F0F0",
            fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none",
            marginBottom: 12,
          }}
        />

        {error && <div style={{ fontSize: 11, color: "#E74C3C", marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}

        <button
          onClick={handleConnect}
          disabled={loading || !token.trim()}
          style={{
            width: "100%", padding: "13px", background: token.trim() ? "#F0F0F0" : "#1A1A1A",
            color: "#0D0D0D", border: "none", borderRadius: 6, fontSize: 12,
            fontFamily: "'DM Mono', monospace", fontWeight: 700, cursor: token.trim() ? "pointer" : "default",
            letterSpacing: 2, textTransform: "uppercase", transition: "background 0.2s",
          }}
        >
          {loading ? "Conectando..." : "Conectar →"}
        </button>

        <div style={{ marginTop: 20, fontSize: 11, color: "#2A2A2A", lineHeight: 1.7 }}>
          Settings → Integrations → Developer → API token
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const saved = localStorage.getItem("todoist_token");
  const [token, setToken] = useState(saved || null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const [rangeStart, setRangeStart] = useState(() => {
    const d = today();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const DAYS = 120;
  const DAY_W = 26;
  const ROW_H = 38;
  const LABEL_W = 240;
  const HEADER_H = 60;
  const dragRef = useRef(null);

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [projs, tsks] = await Promise.all([
        todoistFetch(token, "projects"),
        todoistFetch(token, "tasks"),
      ]);
      setProjects(projs);
      setTasks(tsks);
      if (!selectedProjects) {
        setSelectedProjects(new Set(projs.map(p => p.id)));
      }
    } catch (e) {
      setError("Error cargando datos. " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    localStorage.removeItem("todoist_token");
    setToken(null);
    setProjects([]);
    setTasks([]);
    setSelectedProjects(null);
  }

  function toggleProject(id) {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p; });

  // Tareas visibles con fechas
  const rangeEnd = addDays(rangeStart, DAYS);
  const tasksWithDates = tasks
    .filter(t => selectedProjects?.has(t.project_id))
    .map(t => ({ task: t, dates: getTaskDates(t) }))
    .filter(({ dates }) => dates && dates.end >= rangeStart && dates.start <= rangeEnd);

  // Agrupar por proyecto (orden de Todoist)
  const byProject = {};
  tasksWithDates.forEach(({ task, dates }) => {
    if (!byProject[task.project_id]) byProject[task.project_id] = [];
    byProject[task.project_id].push({ task, dates });
  });

  const orderedProjectIds = projects
    .map(p => p.id)
    .filter(id => byProject[id]?.length > 0 && selectedProjects?.has(id));

  // Filas
  const rows = [];
  orderedProjectIds.forEach(pid => {
    const proj = projectMap[pid];
    rows.push({ type: "header", proj });
    byProject[pid].forEach(({ task, dates }) => {
      rows.push({ type: "task", task, dates, proj });
    });
  });

  function dateToX(date) {
    return LABEL_W + daysBetween(rangeStart, date) * DAY_W;
  }

  // Drag
  const [dragState, setDragState] = useState(null);

  function onBarMouseDown(e, task, dates) {
    e.preventDefault();
    const startX = e.clientX;
    const origEnd = new Date(dates.end);
    const origStart = new Date(dates.start);

    const state = { taskId: task.id, startX, origEnd, origStart, currentDelta: 0 };
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
        saveDate(task, dates, newEnd);
      }
      dragRef.current = null;
      setDragState(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function saveDate(task, dates, newEnd) {
    setSaving(task.id);
    try {
      const body = {};
      if (task.deadline?.date) {
        body.deadline = { date: formatDate(newEnd) };
      } else {
        body.due_date = formatDate(newEnd);
      }
      await todoistFetch(token, `tasks/${task.id}`, "POST", body);
      setTasks(prev => prev.map(t => {
        if (t.id !== task.id) return t;
        const u = { ...t };
        if (t.deadline?.date) u.deadline = { ...t.deadline, date: formatDate(newEnd) };
        else u.due = { ...t.due, date: formatDate(newEnd) };
        return u;
      }));
    } catch {
      setError("Error guardando en Todoist.");
    } finally {
      setSaving(null);
    }
  }

  function getBarDates(task, dates) {
    if (dragState?.taskId === task.id) {
      return {
        start: addDays(dates.start, dragState.currentDelta),
        end: addDays(dates.end, dragState.currentDelta),
      };
    }
    return dates;
  }

  if (!token) return <TokenScreen onConnect={setToken} />;

  const todayDate = today();
  const totalW = LABEL_W + DAYS * DAY_W + 40;
  const totalH = HEADER_H + rows.length * ROW_H + 60;

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", fontFamily: "'DM Mono', monospace", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52, borderBottom: "1px solid #1A1A1A",
        background: "#0D0D0D", position: "sticky", top: 0, zIndex: 200, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: 4, color: "#333", textTransform: "uppercase" }}>NOWHERE</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#F0F0F0", marginLeft: 10, fontFamily: "'DM Sans', sans-serif" }}>Timeline</span>
          </div>
          {saving && <span style={{ fontSize: 10, color: "#F39C12", letterSpacing: 2 }}>GUARDANDO</span>}
          {error && <span style={{ fontSize: 10, color: "#E74C3C" }}>{error}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Btn onClick={() => setRangeStart(d => addDays(d, -30))}>← 30d</Btn>
          <Btn onClick={() => setRangeStart(() => { const d = today(); d.setDate(d.getDate() - 7); return d; })}>HOY</Btn>
          <Btn onClick={() => setRangeStart(d => addDays(d, 30))}>30d →</Btn>
          <Btn onClick={loadData} style={{ marginLeft: 8 }}>↻ Sync</Btn>
          <Btn onClick={disconnect} style={{ marginLeft: 4, color: "#444" }}>Salir</Btn>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <div style={{
          width: 200, background: "#0D0D0D", borderRight: "1px solid #1A1A1A",
          overflowY: "auto", flexShrink: 0,
        }}>
          <div style={{ padding: "16px 16px 8px", fontSize: 9, letterSpacing: 3, color: "#333", textTransform: "uppercase" }}>
            Proyectos
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 10px" }}>
            <MiniBtn onClick={() => setSelectedProjects(new Set(projects.map(p => p.id)))}>Todos</MiniBtn>
            <MiniBtn onClick={() => setSelectedProjects(new Set())}>Ninguno</MiniBtn>
          </div>
          {projects.map(p => {
            const color = getProjectColor(p.color);
            const active = selectedProjects?.has(p.id);
            const hasTasks = tasks.some(t => t.project_id === p.id && getTaskDates(t));
            return (
              <div
                key={p.id}
                onClick={() => toggleProject(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 16px 7px 13px", cursor: "pointer",
                  borderLeft: `3px solid ${active ? color : "transparent"}`,
                  background: active ? hexToRgba(color, 0.05) : "transparent",
                  transition: "all 0.15s",
                  opacity: hasTasks ? 1 : 0.4,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? color : "#2A2A2A", flexShrink: 0, transition: "background 0.15s" }} />
                <div style={{ fontSize: 11, color: active ? "#C0C0C0" : "#444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Gantt area */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#333", fontSize: 12, letterSpacing: 2 }}>
              CARGANDO TODOIST...
            </div>
          ) : (
            <div style={{ width: totalW, minHeight: totalH, position: "relative" }}>

              {/* Header sticky */}
              <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#0D0D0D", borderBottom: "1px solid #1A1A1A", height: HEADER_H, display: "flex" }}>
                <div style={{ width: LABEL_W, flexShrink: 0, borderRight: "1px solid #1A1A1A", display: "flex", alignItems: "flex-end", padding: "0 20px 10px", fontSize: 9, color: "#2A2A2A", letterSpacing: 2, textTransform: "uppercase" }}>
                  Tarea
                </div>
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
                        background: isToday ? "#0A1A0A" : isWeekend ? "#0A0A0A" : "transparent",
                        borderRight: "1px solid #141414",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
                        paddingBottom: 8, position: "relative",
                      }}>
                        {isFirst && (
                          <div style={{ position: "absolute", top: 10, left: 2, fontSize: 8, color: "#3A3A3A", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                            {d.toLocaleString("es", { month: "short" })}
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: isToday ? "#4CAF50" : isWeekend ? "#2A2A2A" : "#3A3A3A", fontWeight: isToday ? 700 : 400 }}>
                          {d.getDate()}
                        </div>
                        {isToday && <div style={{ position: "absolute", bottom: 0, width: 2, height: 5, background: "#4CAF50" }} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Línea de hoy */}
              {daysBetween(rangeStart, todayDate) >= 0 && daysBetween(rangeStart, todayDate) < DAYS && (
                <div style={{
                  position: "absolute", top: HEADER_H, bottom: 0,
                  left: LABEL_W + daysBetween(rangeStart, todayDate) * DAY_W + DAY_W / 2,
                  width: 1, background: "#1A2A1A", pointerEvents: "none", zIndex: 5,
                }} />
              )}

              {/* Filas */}
              {rows.map((row, ri) => {
                const y = HEADER_H + ri * ROW_H;
                const rowBg = ri % 2 === 0 ? "transparent" : "#080808";

                if (row.type === "header") {
                  const color = getProjectColor(row.proj.color);
                  return (
                    <div key={`h_${row.proj.id}_${ri}`} style={{
                      position: "absolute", top: y, left: 0, width: totalW, height: ROW_H,
                      background: "#0F0F0F", borderBottom: "1px solid #1A1A1A",
                      borderLeft: `3px solid ${color}`,
                      display: "flex", alignItems: "center",
                    }}>
                      <div style={{ width: LABEL_W - 3, paddingLeft: 14, fontSize: 9, fontWeight: 700, color, letterSpacing: 3, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.proj.name}
                      </div>
                    </div>
                  );
                }

                // Task row
                const { task, dates, proj } = row;
                const color = getProjectColor(proj.color);
                const barDates = getBarDates(task, dates);
                const isDragging = dragState?.taskId === task.id;
                const isSaving = saving === task.id;
                const isLate = dates.end < todayDate;

                const x1 = dateToX(barDates.start);
                const x2 = dateToX(barDates.end) + DAY_W;
                const barW = Math.max(x2 - x1, DAY_W);

                return (
                  <div
                    key={task.id}
                    style={{
                      position: "absolute", top: y, left: 0, width: totalW, height: ROW_H,
                      background: rowBg, borderBottom: "1px solid #111",
                      display: "flex", alignItems: "center",
                    }}
                    onMouseEnter={e => setTooltip({ task, dates, proj, clientY: e.clientY, x: x1 })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* Label */}
                    <div style={{
                      width: LABEL_W, flexShrink: 0, paddingLeft: 22, paddingRight: 10,
                      fontSize: 11, color: isLate ? "#8B3A3A" : "#555",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      borderRight: "1px solid #141414",
                    }}>
                      {isLate && "⚑ "}{task.content}
                    </div>

                    {/* Bar zone */}
                    <div style={{ position: "relative", flex: 1, height: "100%" }}>
                      <div
                        onMouseDown={e => onBarMouseDown(e, task, dates)}
                        style={{
                          position: "absolute",
                          left: x1 - LABEL_W,
                          width: barW,
                          top: 7, height: ROW_H - 14,
                          background: isDragging
                            ? hexToRgba(color, 0.6)
                            : isSaving
                              ? "#1A1A1A"
                              : hexToRgba(color, 0.25),
                          border: `1px solid ${hexToRgba(color, isDragging ? 1 : 0.5)}`,
                          borderRadius: 4,
                          cursor: isDragging ? "grabbing" : "grab",
                          display: "flex", alignItems: "center",
                          paddingLeft: 8,
                          fontSize: 9, color: hexToRgba(color, 0.9),
                          fontWeight: 600, letterSpacing: 0.5,
                          whiteSpace: "nowrap", overflow: "hidden",
                          userSelect: "none",
                          boxShadow: isDragging ? `0 0 20px ${hexToRgba(color, 0.3)}` : "none",
                          transition: isDragging ? "none" : "all 0.15s",
                        }}
                      >
                        {barW > 70 && formatDate(barDates.end)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty state */}
              {rows.length === 0 && !loading && (
                <div style={{ position: "absolute", top: HEADER_H + 60, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#2A2A2A" }}>
                  <div style={{ fontSize: 40 }}>◻</div>
                  <div style={{ fontSize: 12, letterSpacing: 1 }}>SIN TAREAS EN ESTE RANGO</div>
                  <div style={{ fontSize: 10, color: "#1A1A1A" }}>Selecciona proyectos o ajusta el rango</div>
                </div>
              )}
            </div>
          )}

          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position: "fixed",
              left: Math.min(tooltip.x + 20, window.innerWidth - 280),
              top: Math.min(tooltip.clientY + 12, window.innerHeight - 140),
              background: "#111", border: `1px solid ${hexToRgba(getProjectColor(tooltip.proj.color), 0.4)}`,
              borderRadius: 8, padding: "14px 18px", maxWidth: 280, zIndex: 999,
              pointerEvents: "none",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#E8E8E8", marginBottom: 6, lineHeight: 1.4 }}>
                {tooltip.task.content}
              </div>
              <div style={{ fontSize: 10, color: getProjectColor(tooltip.proj.color), marginBottom: 6 }}>
                {tooltip.proj.name}
              </div>
              <div style={{ fontSize: 10, color: "#555" }}>
                {formatDate(tooltip.dates.start)} → {formatDate(tooltip.dates.end)}
              </div>
              {tooltip.task.description && (
                <div style={{ fontSize: 10, color: "#3A3A3A", marginTop: 8, lineHeight: 1.6 }}>
                  {tooltip.task.description.replace(/Inicio:.*/, "").trim().slice(0, 100)}
                </div>
              )}
              <div style={{ fontSize: 9, color: "#2A2A2A", marginTop: 10, letterSpacing: 1 }}>
                ARRASTRA PARA MOVER
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "1px solid #1E1E1E", color: "#555",
      padding: "5px 12px", borderRadius: 4, cursor: "pointer",
      fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: 1,
      transition: "all 0.15s", ...style,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#888"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1E1E1E"; e.currentTarget.style.color = style?.color || "#555"; }}
    >
      {children}
    </button>
  );
}

function MiniBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: "transparent", border: "1px solid #1A1A1A", color: "#444",
      padding: "4px 6px", borderRadius: 3, cursor: "pointer",
      fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: 1,
    }}>
      {children}
    </button>
  );
}
