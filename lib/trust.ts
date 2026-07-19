
export type TrustInputs = {
  answers: Array<{ answer?: string; maturity?: number; criticality: "Low"|"Medium"|"High"; frameworks?: string[] }>;
  evidenceApproved: number;
  evidencePending: number;
  disclosuresHigh: boolean;
};
export function computeTrustScore(i: TrustInputs){
  const w: Record<string, number> = { Low: 1, Medium: 2, High: 3 };
  let total=0, denom=0;
  for(const a of i.answers){
    const base =
      a.answer==="yes" ? 100 :
      a.answer==="partial" ? 60 :
      a.answer==="no" ? 0 :
      a.maturity ? (a.maturity>=5?100:a.maturity>=3?60:20) :
      null;
    if(base===null) continue;
    const weight = w[a.criticality] || 1;
    total += base * weight;
    denom += 100 * weight;
  }
  const controlsScore = denom>0 ? (total/denom)*100 : 0;
  const evBonus = Math.min(10, i.evidenceApproved * 1.5);
  const disclosureCap = i.disclosuresHigh ? 49 : 100;
  const raw = Math.round(Math.min(disclosureCap, controlsScore + evBonus));
  const level = raw>=80 ? "High" : raw>=60 ? "Medium" : "Low";
  return { score: raw, level };
}





