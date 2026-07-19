"use client";
import useSWR from "swr";
const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then(r => r.json()).catch(()=>null);

export default function UsageBadges() {
  const { data } = useSWR("/api/usage", fetcher, { refreshInterval: 15000 });
  if (!data) return null;
  const { plan, counts, caps } = data;

  const pill = (label: string, used: number, max: number) => {
    const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
    return (
      <span style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 10px",
        border:"1px solid #ddd",borderRadius:999,background:"#fff"}}>
        <strong>{label}</strong>
        <span style={{ color: used>=max ? "#b00" : "inherit", fontWeight: used>=max ? 600 : 400 }}>
          {used}/{max}
        </span>
        <span style={{ width:60, background:"#eee", height:4, borderRadius:3, overflow:"hidden" }}>
          <span style={{ width: pct+"%", height:4, background:"#0a0" }}/>
        </span>
      </span>
    );
  };

  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",
      padding:"8px 12px",borderBottom:"1px solid #eee",background:"#fafafa"}}>
      <span style={{fontSize:12,opacity:.8}}>Plan:</span>
      <span style={{padding:"4px 10px",border:"1px solid #ccc",borderRadius:999,
        background:"#fff",textTransform:"capitalize"}}>{plan}</span>
      {pill("Vendors", counts.vendors, caps.vendors)}
      {pill("Members", counts.members, caps.members)}
      {pill("Assessments", counts.assessments, caps.assessments)}
      {plan === "free" ? <a href="/upgrade" style={{marginLeft:6,fontSize:12}}>Upgrade →</a> : null}
    </div>
  );
}


