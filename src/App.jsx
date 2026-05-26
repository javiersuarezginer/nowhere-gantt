import { useState, useEffect, useRef } from "react";

async function todoistFetch(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/todoist?path=${path}`, opts);
  if (!res.ok) throw new Error(`Todoist error ${res.status}`);
  return res.json();
}

const PROJECT_COLORS = {
  berry_red:"#b8256f",red:"#db4035",orange:"#ff9933",yellow:"#e0ac00",
  olive_green:"#afb83b",lime_green:"#7ecc49",green:"#299438",mint_green:"#6accbc",
  teal:"#158fad",sky_blue:"#14aaf5",light_blue:"#96c3eb",blue:"#4073ff",
  grape:"#884dff",violet:"#af38eb",lavender:"#eb96eb",magenta:"#e05194",
  salmon:"#ff8d85",charcoal:"#555e6e",grey:"#808080",taupe:"#ccac93",
};

const PHASE_COLORS = {
  preproduccion:     { bg:"#DBEAFE", border:"#3B82F6", text:"#1E3A8A" },
  "modelos-ia":      { bg:"#EDE9FE", border:"#7C3AED", text:"#4C1D95" },
  "produccion-foto": { bg:"#D1FAE5", border:"#059669", text:"#064E3B" },
  "produccion-video":{ bg:"#FEF3C7", border:"#D97706", text:"#78350F" },
  postproduccion:    { bg:"#FCE7F3", border:"#DB2777", text:"#831843" },
  entrega:           { bg:"#FFEDD5", border:"#EA580C", text:"#7C2D12" },
  default:           { bg:"#F1F5F9", border:"#94A3B8", text:"#334155" },
};

function getPhaseColor(labels=[]) {
  for (const l of labels) {
    const k = l.toLowerCase().replace(/_/g,"-");
    if (PHASE_COLORS[k]) return PHASE_COLORS[k];
  }
  return PHASE_COLORS.default;
}

function getProjectColor(c) { return PROJECT_COLORS[c] || "#4073ff"; }

function hex2rgba(hex, a) {
  if (!hex||hex.length<7) return `rgba(0,0,0,${a})`;
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
}

function parseDate(s) { if(!s) return null; return new Date(s.split("T")[0]+"T00:00:00"); }
function fmtDate(d) { if(!d) return ""; return d.toISOString().split("T")[0]; }
function fmtShort(d) { if(!d) return "—"; return d.toLocaleDateString("es",{day:"numeric",month:"short"}); }
function addDays(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function diff(a,b) { return Math.round((b-a)/86400000); }
function today() { const d=new Date(); d.setHours(0,0,0,0); return d; }

function getTaskDates(t) {
  const end = (t.deadline?.date ? parseDate(t.deadline.date) : null) || (t.due?.date ? parseDate(t.due.date) : null);
  if (!end) return null;
  const m = t.description?.match(/Inicio:\s*(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
  let start = end;
  if (m) {
    const mm={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11};
    const c=new Date(end.getFullYear(),mm[m[2].toLowerCase()],parseInt(m[1]));
    if (c<=end) start=c;
  }
  return {start,end};
}

function getDeps(t) {
  const m=t.description?.match(/Depende:\s*([^\n]+)/i);
  return m ? m[1].split(",").map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
}

// ── DATE PICKER ───────────────────────────────────────────────
function DatePicker({value, onChange, onClose}) {
  const [month, setMonth] = useState(value ? new Date(value.getFullYear(),value.getMonth(),1) : new Date());
  const total = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const firstDow = new Date(month.getFullYear(),month.getMonth(),1).getDay();
  const offset = firstDow===0 ? 6 : firstDow-1;
  const cells = [];
  for(let i=0;i<offset;i++) cells.push(null);
  for(let i=1;i<=total;i++) cells.push(new Date(month.getFullYear(),month.getMonth(),i));
  return (
    <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:10,padding:12,width:220,boxShadow:"0 8px 24px rgba(0,0,0,0.12)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button onClick={()=>setMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#64748B",padding:"0 4px"}}>‹</button>
        <span style={{fontSize:12,fontWeight:600,color:"#334155"}}>{month.toLocaleString("es",{month:"long",year:"numeric"})}</span>
        <button onClick={()=>setMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#64748B",padding:"0 4px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {["L","M","X","J","V","S","D"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"#94A3B8",fontWeight:600,padding:"2px 0"}}>{d}</div>)}
        {cells.map((d,i)=>{
          const isSel = d&&value&&d.getTime()===value.getTime();
          return <div key={i} onClick={()=>{if(d){onChange(d);onClose();}}} style={{textAlign:"center",fontSize:11,padding:"5px 2px",borderRadius:4,cursor:d?"pointer":"default",background:isSel?"#3B82F6":"transparent",color:isSel?"#FFF":d?"#334155":"transparent",fontWeight:isSel?700:400}}
            onMouseEnter={e=>{if(d&&!isSel)e.currentTarget.style.background="#F1F5F9";}}
            onMouseLeave={e=>{if(d&&!isSel)e.currentTarget.style.background="transparent";}}
          >{d?d.getDate():""}</div>;
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [projects,setProjects]=useState([]);
  const [tasks,setTasks]=useState([]);
  const [taskOrder,setTaskOrder]=useState({});
  const [selProj,setSelProj]=useState(null);
  const [collapsed,setCollapsed]=useState(new Set());
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(null);
  const [error,setError]=useState("");
  const [tooltip,setTooltip]=useState(null);
  const [labelW,setLabelW]=useState(260);
  const DATE_COL=180;
  const [datePicker,setDatePicker]=useState(null);
  const [connectMode,setConnectMode]=useState(false);
  const [connSrc,setConnSrc]=useState(null);
  const [vertDrag,setVertDrag]=useState(null);
  const [rangeStart,setRangeStart]=useState(()=>{const d=today();d.setDate(d.getDate()-7);return d;});
  const DAYS=120,DAY_W=26,ROW_H=36,HEADER_H=56;
  const vdRef=useRef(null);

  useEffect(()=>{loadData();},[]);

  async function loadData() {
    setLoading(true);setError("");
    try {
      const [projs,tsks]=await Promise.all([todoistFetch("projects"),todoistFetch("tasks")]);
      setProjects(projs);setTasks(tsks);
      if(!selProj) setSelProj(new Set(projs.map(p=>p.id)));
      const ord={};
      projs.forEach(p=>{ord[p.id]=tsks.filter(t=>t.project_id===p.id).map(t=>t.id);});
      setTaskOrder(ord);
    } catch(e){setError("Error: "+e.message);}
    finally{setLoading(false);}
  }

  const projMap={};projects.forEach(p=>{projMap[p.id]=p;});
  const rangeEnd=addDays(rangeStart,DAYS);

  const twDates=tasks.filter(t=>selProj?.has(t.project_id)).map(t=>({task:t,dates:getTaskDates(t)})).filter(({dates})=>dates&&dates.end>=rangeStart&&dates.start<=rangeEnd);

  const byProj={};
  twDates.forEach(({task,dates})=>{
    if(!byProj[task.project_id])byProj[task.project_id]=[];
    byProj[task.project_id].push({task,dates});
  });

  Object.keys(byProj).forEach(pid=>{
    const ord=taskOrder[pid]||[];
    byProj[pid].sort((a,b)=>{const ia=ord.indexOf(a.task.id),ib=ord.indexOf(b.task.id);return (ia<0?999:ia)-(ib<0?999:ib);});
  });

  const ordProjIds=projects.map(p=>p.id).filter(id=>byProj[id]?.length>0&&selProj?.has(id));
  const rows=[];
  ordProjIds.forEach(pid=>{
    const proj=projMap[pid],isCol=collapsed.has(pid);
    rows.push({type:"header",proj,isCol});
    if(!isCol) byProj[pid].forEach(({task,dates})=>rows.push({type:"task",task,dates,proj}));
  });

  function x(date){return labelW+DATE_COL+diff(rangeStart,date)*DAY_W;}
  const FIXED_W=labelW+DATE_COL;
  const totalW=FIXED_W+DAYS*DAY_W+40;
  const totalH=HEADER_H+rows.length*ROW_H+60;

  async function saveDate(task,ns,ne) {
    setSaving(task.id);
    const old=getTaskDates(task);
    const delta=diff(old?.end||ne,ne);
    const toUpdate=[{task,ns,ne}];
    const vis=new Set([task.id]);
    function collectDeps(t,d){
      tasks.filter(x=>getDeps(x).includes(t.content.toLowerCase())).forEach(dep=>{
        if(vis.has(dep.id))return;vis.add(dep.id);
        const dd=getTaskDates(dep);if(!dd)return;
        const dns=addDays(dd.start,d),dne=addDays(dd.end,d);
        toUpdate.push({task:dep,ns:dns,ne:dne});collectDeps(dep,d);
      });
    }
    collectDeps(task,delta);
    try {
      const MN=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
      for(const {task:t,ns,ne} of toUpdate){
        const body={};
        if(t.deadline?.date) body.deadline={date:fmtDate(ne)};
        else body.due_date=fmtDate(ne);
        const sl=`Inicio: ${ns.getDate()} ${MN[ns.getMonth()]}`;
        let desc=(t.description||"").replace(/Inicio:.*(\n|$)/i,"").trim();
        body.description=sl+(desc?"\n"+desc:"");
        await todoistFetch(`tasks/${t.id}`,"POST",body);
      }
      setTasks(prev=>prev.map(t=>{
        const u=toUpdate.find(x=>x.task.id===t.id);if(!u)return t;
        const {ns,ne}=u,r={...t};
        const MN=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
        if(t.deadline?.date)r.deadline={...t.deadline,date:fmtDate(ne)};
        else r.due={...t.due,date:fmtDate(ne)};
        let desc=(t.description||"").replace(/Inicio:.*(\n|$)/i,"").trim();
        r.description=`Inicio: ${ns.getDate()} ${MN[ns.getMonth()]}`+(desc?"\n"+desc:"");
        return r;
      }));
    } catch{setError("Error guardando.");}
    finally{setSaving(null);}
  }

  async function handleBarClick(task) {
    if(!connectMode)return;
    if(!connSrc){setConnSrc(task);return;}
    if(connSrc.id===task.id){setConnSrc(null);return;}
    setSaving(task.id);
    try {
      const ex=getDeps(task),src=connSrc.content;
      if(!ex.includes(src.toLowerCase())){
        const depLine=`Depende: ${[...ex,src].join(", ")}`;
        let desc=(task.description||"").replace(/Depende:.*(\n|$)/i,"").trim();
        const nd=depLine+(desc?"\n"+desc:"");
        await todoistFetch(`tasks/${task.id}`,"POST",{description:nd});
        setTasks(prev=>prev.map(t=>t.id===task.id?{...t,description:nd}:t));
      }
    } catch{setError("Error.");}
    finally{setSaving(null);setConnSrc(null);setConnectMode(false);}
  }

  function onVertDragStart(e,task,proj) {
    e.preventDefault();
    const sy=e.clientY,pid=proj.id;
    const ord=[...(taskOrder[pid]||byProj[pid]?.map(x=>x.task.id)||[])];
    const ci=ord.indexOf(task.id);
    vdRef.current={taskId:task.id,pid,sy,ord,ci,ti:ci};
    setVertDrag({taskId:task.id,pid,ti:ci});
    function onMove(ev){
      const nd=Math.round((ev.clientY-sy)/ROW_H);
      const ni=Math.max(0,Math.min(ord.length-1,ci+nd));
      if(ni!==vdRef.current.ti){vdRef.current.ti=ni;setVertDrag({taskId:task.id,pid,ti:ni});}
    }
    function onUp(){
      window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);
      const {ord:o,ci,ti}=vdRef.current;
      if(ci!==ti){const no=[...o];const [r]=no.splice(ci,1);no.splice(ti,0,r);setTaskOrder(prev=>({...prev,[pid]:no}));}
      vdRef.current=null;setVertDrag(null);
    }
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
  }

  function onLabelResizeDown(e) {
    e.preventDefault();const sx=e.clientX,ow=labelW;
    function onMove(ev){setLabelW(Math.max(160,ow+ev.clientX-sx));}
    function onUp(){window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);}
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
  }

  const todayD=today();

  return (
    <div style={{minHeight:"100vh",background:"#F8FAFC",fontFamily:"'Inter','DM Sans',sans-serif",display:"flex",flexDirection:"column",color:"#1E293B"}}>
      {/* Topbar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:52,borderBottom:"1px solid #E2E8F0",background:"#FFF",position:"sticky",top:0,zIndex:300,flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div><span style={{fontSize:10,letterSpacing:3,color:"#94A3B8",textTransform:"uppercase",fontWeight:600}}>NOWHERE</span><span style={{fontSize:15,fontWeight:700,color:"#0F172A",marginLeft:10}}>Timeline</span></div>
          {loading&&<span style={{fontSize:11,color:"#94A3B8"}}>Cargando...</span>}
          {saving&&<span style={{fontSize:11,color:"#F59E0B",fontWeight:600}}>Guardando...</span>}
          {error&&<span style={{fontSize:11,color:"#EF4444"}}>{error}</span>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <Btn onClick={()=>setRangeStart(d=>addDays(d,-30))}>← 30d</Btn>
          <Btn onClick={()=>setRangeStart(()=>{const d=today();d.setDate(d.getDate()-7);return d;})} primary>Hoy</Btn>
          <Btn onClick={()=>setRangeStart(d=>addDays(d,30))}>30d →</Btn>
          <Btn onClick={loadData} style={{marginLeft:8}}>↻ Sync</Btn>
          <Btn onClick={()=>{setConnectMode(m=>!m);setConnSrc(null);}} style={{marginLeft:8,background:connectMode?"#EFF6FF":"transparent",border:connectMode?"1px solid #3B82F6":"1px solid #E2E8F0",color:connectMode?"#3B82F6":"#64748B"}}>
            {connectMode?(connSrc?`← Clic en destino`:"Clic en origen"):"🔗 Dependencia"}
          </Btn>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{width:200,background:"#FFF",borderRight:"1px solid #E2E8F0",overflowY:"auto",flexShrink:0}}>
          <div style={{padding:"14px 16px 8px",fontSize:10,letterSpacing:2,color:"#94A3B8",textTransform:"uppercase",fontWeight:600}}>Proyectos</div>
          <div style={{display:"flex",gap:6,padding:"0 12px 10px"}}>
            <MiniBtn onClick={()=>setSelProj(new Set(projects.map(p=>p.id)))}>Todos</MiniBtn>
            <MiniBtn onClick={()=>setSelProj(new Set())}>Ninguno</MiniBtn>
          </div>
          {projects.map(p=>{
            const color=getProjectColor(p.color),active=selProj?.has(p.id);
            return <div key={p.id} onClick={()=>{setSelProj(prev=>{const n=new Set(prev);n.has(p.id)?n.delete(p.id):n.add(p.id);return n;});}} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 16px 7px 12px",cursor:"pointer",borderLeft:`3px solid ${active?color:"transparent"}`,background:active?hex2rgba(color,0.06):"transparent",transition:"all 0.12s",opacity:tasks.some(t=>t.project_id===p.id&&getTaskDates(t))?1:0.35}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:active?color:"#CBD5E1",flexShrink:0}}/>
              <div style={{fontSize:12,color:active?"#1E293B":"#94A3B8",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:active?500:400}}>{p.name}</div>
            </div>;
          })}
        </div>

        {/* Gantt */}
        <div style={{flex:1,overflow:"auto",position:"relative"}} onClick={()=>{if(datePicker)setDatePicker(null);}}>
          <div style={{width:totalW,minHeight:totalH,position:"relative"}}>

            {/* Header */}
            <div style={{position:"sticky",top:0,zIndex:100,background:"#FFF",borderBottom:"1px solid #E2E8F0",height:HEADER_H,display:"flex",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{width:FIXED_W,flexShrink:0,display:"flex",position:"sticky",left:0,zIndex:10,background:"#FFF"}}>
                <div style={{width:labelW,borderRight:"1px solid #E2E8F0",display:"flex",alignItems:"flex-end",padding:"0 16px 10px",fontSize:10,color:"#94A3B8",letterSpacing:2,textTransform:"uppercase",fontWeight:600,position:"relative"}}>
                  Tarea
                  <div onMouseDown={onLabelResizeDown} style={{position:"absolute",right:0,top:0,bottom:0,width:6,cursor:"col-resize",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:2,height:20,background:"#E2E8F0",borderRadius:1}}/>
                  </div>
                </div>
                <div style={{width:DATE_COL,borderRight:"1px solid #E2E8F0",display:"flex",alignItems:"flex-end",paddingBottom:10}}>
                  <div style={{flex:1,textAlign:"center",fontSize:10,color:"#94A3B8",letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Inicio</div>
                  <div style={{width:1,background:"#E2E8F0",height:16,marginBottom:2}}/>
                  <div style={{flex:1,textAlign:"center",fontSize:10,color:"#94A3B8",letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Fin</div>
                </div>
              </div>
              <div style={{display:"flex"}}>
                {Array.from({length:DAYS},(_,i)=>{
                  const d=addDays(rangeStart,i),isT=d.getTime()===todayD.getTime(),dow=d.getDay(),isW=dow===0||dow===6,isF=d.getDate()===1;
                  return <div key={i} style={{width:DAY_W,flexShrink:0,background:isT?"#EFF6FF":isW?"#F8FAFC":"#FFF",borderRight:"1px solid #F1F5F9",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",paddingBottom:8,position:"relative"}}>
                    {isF&&<div style={{position:"absolute",top:10,left:2,fontSize:8,color:"#94A3B8",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap",fontWeight:600}}>{d.toLocaleString("es",{month:"short"})}</div>}
                    <div style={{fontSize:9,color:isT?"#3B82F6":isW?"#CBD5E1":"#94A3B8",fontWeight:isT?700:400}}>{d.getDate()}</div>
                    {isT&&<div style={{position:"absolute",bottom:0,width:2,height:4,background:"#3B82F6",borderRadius:1}}/>}
                  </div>;
                })}
              </div>
            </div>

            {/* Hoy line */}
            {diff(rangeStart,todayD)>=0&&diff(rangeStart,todayD)<DAYS&&<div style={{position:"absolute",top:HEADER_H,bottom:0,left:FIXED_W+diff(rangeStart,todayD)*DAY_W+DAY_W/2,width:1,background:"#BFDBFE",pointerEvents:"none",zIndex:5}}/>}

            {/* Rows */}
            {rows.map((row,ri)=>{
              const y=HEADER_H+ri*ROW_H, rowBg=ri%2===0?"#FFF":"#F8FAFC";
              if(row.type==="header"){
                const color=getProjectColor(row.proj.color);
                return <div key={`h_${row.proj.id}`} style={{position:"absolute",top:y,left:0,width:totalW,height:ROW_H,background:"#F1F5F9",borderBottom:"1px solid #E2E8F0",borderLeft:`3px solid ${color}`,display:"flex",alignItems:"center",cursor:"pointer"}} onClick={()=>setCollapsed(prev=>{const n=new Set(prev);n.has(row.proj.id)?n.delete(row.proj.id):n.add(row.proj.id);return n;})}>
                  <div style={{width:FIXED_W-3,display:"flex",alignItems:"center",paddingLeft:12,gap:6,position:"sticky",left:3,background:"#F1F5F9",zIndex:6}}>
                    <span style={{fontSize:10,color:"#94A3B8",display:"inline-block",transform:row.isCol?"rotate(-90deg)":"rotate(0deg)",transition:"transform 0.15s"}}>▾</span>
                    <span style={{fontSize:11,fontWeight:700,color,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{row.proj.name}</span>
                  </div>
                </div>;
              }
              const {task,dates,proj}=row;
              const pc=getPhaseColor(task.labels||[]),projC=getProjectColor(proj.color);
              const isLate=dates.end<todayD,isCS=connSrc?.id===task.id,deps=getDeps(task);
              const bx1=x(dates.start),bx2=x(dates.end)+DAY_W,bw=Math.max(bx2-bx1,DAY_W);
              const isDragging=vertDrag?.taskId===task.id;

              return <div key={task.id} style={{position:"absolute",top:y,left:0,width:totalW,height:ROW_H,background:isDragging?hex2rgba(projC,0.08):rowBg,borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",opacity:saving===task.id?0.6:1}}>
                {/* Fixed cols */}
                <div style={{width:FIXED_W,flexShrink:0,display:"flex",alignItems:"center",position:"sticky",left:0,background:isDragging?hex2rgba(projC,0.08):rowBg,zIndex:6,height:"100%",borderRight:"1px solid #F1F5F9"}}>
                  {/* Vert drag handle */}
                  <div onMouseDown={e=>onVertDragStart(e,task,proj)} style={{width:18,flexShrink:0,height:"100%",cursor:"ns-resize",display:"flex",alignItems:"center",justifyContent:"center",color:"#CBD5E1",fontSize:11,userSelect:"none",padding:"0 2px"}}>⠿</div>
                  {/* Label */}
                  <div style={{width:labelW-18,paddingRight:16,fontSize:12,color:isLate?"#EF4444":isCS?"#3B82F6":"#334155",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:isCS?600:400,cursor:connectMode?"pointer":"default",position:"relative"}} onClick={()=>handleBarClick(task)}>
                    {isLate&&<span style={{marginRight:4,fontSize:10}}>⚑</span>}
                    {deps.length>0&&<span title={`Depende de: ${deps.join(", ")}`} style={{marginRight:4,fontSize:10,color:"#94A3B8"}}>🔗</span>}
                    {task.content}
                    <div onMouseDown={onLabelResizeDown} style={{position:"absolute",right:0,top:0,bottom:0,width:6,cursor:"col-resize"}}/>
                  </div>
                  {/* Date cols */}
                  <div style={{width:DATE_COL,flexShrink:0,display:"flex",alignItems:"center",height:"100%"}}>
                    <div style={{flex:1,textAlign:"center"}}>
                      <button onClick={e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();setDatePicker({taskId:task.id,field:"start",rect:r,task,dates});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#64748B",padding:"2px 4px",borderRadius:4,width:"100%"}} onMouseEnter={e=>e.currentTarget.style.background="#F1F5F9"} onMouseLeave={e=>e.currentTarget.style.background="none"}>{fmtShort(dates.start)}</button>
                    </div>
                    <div style={{width:1,background:"#F1F5F9",height:16}}/>
                    <div style={{flex:1,textAlign:"center"}}>
                      <button onClick={e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();setDatePicker({taskId:task.id,field:"end",rect:r,task,dates});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#64748B",padding:"2px 4px",borderRadius:4,width:"100%"}} onMouseEnter={e=>e.currentTarget.style.background="#F1F5F9"} onMouseLeave={e=>e.currentTarget.style.background="none"}>{fmtShort(dates.end)}</button>
                    </div>
                  </div>
                </div>
                {/* Bar */}
                <div style={{position:"relative",flex:1,height:"100%"}}>
                  <div style={{position:"absolute",left:bx1-FIXED_W,width:bw,top:7,height:ROW_H-14,background:isCS?hex2rgba(pc.border,0.3):pc.bg,border:`1.5px solid ${hex2rgba(pc.border,isCS?1:0.6)}`,borderRadius:5,display:"flex",alignItems:"center",paddingLeft:8,fontSize:10,color:pc.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",userSelect:"none",boxShadow:"0 1px 2px rgba(0,0,0,0.06)",cursor:connectMode?"pointer":"default"}}
                    onClick={()=>handleBarClick(task)}
                    onMouseEnter={e=>setTooltip({task,dates,proj,cy:e.clientY,cx:e.clientX})}
                    onMouseLeave={()=>setTooltip(null)}
                  >
                    {bw>80&&(task.labels?.length>0?task.labels[0]:"")}
                  </div>
                </div>
              </div>;
            })}

            {rows.length===0&&!loading&&<div style={{position:"absolute",top:HEADER_H+60,left:0,right:0,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><div style={{fontSize:36,color:"#CBD5E1"}}>◻</div><div style={{fontSize:13,color:"#94A3B8"}}>Sin tareas en este rango</div></div>}
          </div>

          {/* Tooltip */}
          {tooltip&&<div style={{position:"fixed",left:Math.min(tooltip.cx+16,window.innerWidth-280),top:Math.min(tooltip.cy+12,window.innerHeight-160),background:"#FFF",border:"1px solid #E2E8F0",borderRadius:10,padding:"14px 16px",maxWidth:280,zIndex:999,pointerEvents:"none",boxShadow:"0 8px 24px rgba(0,0,0,0.10)"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:4,lineHeight:1.4}}>{tooltip.task.content}</div>
            <div style={{fontSize:11,color:getProjectColor(tooltip.proj.color),marginBottom:6,fontWeight:600}}>{tooltip.proj.name}</div>
            <div style={{fontSize:11,color:"#64748B"}}>{fmtShort(tooltip.dates.start)} → {fmtShort(tooltip.dates.end)}</div>
            {tooltip.task.labels?.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>{tooltip.task.labels.map(l=><span key={l} style={{fontSize:10,background:"#F1F5F9",color:"#64748B",padding:"2px 6px",borderRadius:4,fontWeight:500}}>@{l}</span>)}</div>}
            {getDeps(tooltip.task).length>0&&<div style={{fontSize:10,color:"#94A3B8",marginTop:8}}>🔗 Depende de: {getDeps(tooltip.task).join(", ")}</div>}
          </div>}

          {/* Date picker */}
          {datePicker&&<div style={{position:"fixed",left:datePicker.rect.left,top:datePicker.rect.bottom+4,zIndex:1000}} onClick={e=>e.stopPropagation()}>
            <DatePicker value={datePicker.field==="start"?datePicker.dates.start:datePicker.dates.end} onChange={d=>{const {task,dates,field}=datePicker;if(field==="start"&&d<=dates.end)saveDate(task,d,dates.end);else if(field==="end"&&d>=dates.start)saveDate(task,dates.start,d);}} onClose={()=>setDatePicker(null)}/>
          </div>}
        </div>
      </div>
    </div>
  );
}

function Btn({children,onClick,style,primary}){return <button onClick={onClick} style={{background:primary?"#3B82F6":"transparent",border:primary?"none":"1px solid #E2E8F0",color:primary?"#FFF":"#64748B",padding:"5px 14px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:500,transition:"all 0.12s",...style}}>{children}</button>;}
function MiniBtn({children,onClick}){return <button onClick={onClick} style={{flex:1,background:"transparent",border:"1px solid #E2E8F0",color:"#94A3B8",padding:"4px 6px",borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:500}}>{children}</button>;}
