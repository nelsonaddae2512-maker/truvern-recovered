// lib/assessment-utils.ts

export function safeJsonParse(v: any) {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return v;
  try {
    return JSON.parse(s);
  } catch {
    return v;
  }
}

// Normalize old patterns like {"answer":"yes"} to "yes"
export function unwrapAnswerValue(v: any) {
  const parsed = safeJsonParse(v);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if ("answer" in parsed) return (parsed as any).answer;
    if ("value" in parsed) return (parsed as any).value;
  }
  return parsed;
}

export function isAnsweredValue(v: any) {
  const vv = unwrapAnswerValue(v);
  if (vv === null || vv === undefined) return false;
  if (typeof vv === "string") return vv.trim().length > 0;
  if (typeof vv === "number") return true;
  if (typeof vv === "boolean") return true;
  if (Array.isArray(vv)) return vv.length > 0;
  if (typeof vv === "object") return Object.keys(vv).length > 0;
  return Boolean(vv);
}

/**
 * Best-effort heuristic to detect a "bad"/risk-indicating answer.
 * Works with:
 *  - YES/NO booleans
 *  - strings like "no", "false", "fail"
 *  - arrays containing "no"/"fail"
 */
export function isNegativeAnswer(value: any): boolean {
  const v = unwrapAnswerValue(value);

  if (typeof v === "boolean") return v === false;

  if (typeof v === "number") {
    // numeric answers are contextual; treat 0 as not negative by default
    return false;
  }

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return (
      s === "no" ||
      s === "false" ||
      s === "fail" ||
      s === "failed" ||
      s === "noncompliant" ||
      s === "not compliant" ||
      s === "missing"
    );
  }

  if (Array.isArray(v)) {
    return v.some((x) => isNegativeAnswer(x));
  }

  // objects are contextual; default to not negative
  return false;
}





