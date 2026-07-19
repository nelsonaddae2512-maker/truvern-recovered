export type GovernanceHealthState =
  | "HEALTHY"
  | "WATCH"
  | "AT_RISK"
  | "EXPIRED";

export function getGovernanceHealthState(
  finalizedAt: Date | string | null | undefined,
): GovernanceHealthState {
  if (!finalizedAt) return "EXPIRED";

  const ts = new Date(finalizedAt).getTime();
  if (!Number.isFinite(ts)) return "EXPIRED";

  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);

  if (ageDays >= 365) return "EXPIRED";
  if (ageDays >= 180) return "AT_RISK";
  if (ageDays >= 90) return "WATCH";

  return "HEALTHY";
}

export function getGovernanceHealthMeta(state: GovernanceHealthState) {
  switch (state) {
    case "HEALTHY":
      return {
        label: "Healthy",
        className:
          "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
      };

    case "WATCH":
      return {
        label: "Watch",
        className:
          "border border-yellow-400/20 bg-yellow-500/10 text-yellow-100",
      };

    case "AT_RISK":
      return {
        label: "At Risk",
        className:
          "border border-amber-400/20 bg-amber-500/10 text-amber-100",
      };

    default:
      return {
        label: "Expired",
        className:
          "border border-rose-400/20 bg-rose-500/10 text-rose-100",
      };
  }
}

