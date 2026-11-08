import type { CheckResult } from "@/lib/types";

export type RiskSummary = {
  label: string;
  detail: string;
};

/** Plain-language risk from the existing status. Not a new score. */
export function riskSummary(result: CheckResult): RiskSummary {
  if (result.securityStatus === "vulnerable") {
    return {
      label: "Confirmed issues in the checked data",
      detail: `${result.counts.confirmed} confirmed finding${result.counts.confirmed === 1 ? "" : "s"} (${result.counts.critical} critical, ${result.counts.high} high, ${result.counts.medium} medium, ${result.counts.low} low). A match does not prove every deployment can be exploited.`,
    };
  }
  if (result.securityStatus === "caution") {
    return {
      label: "Review required",
      detail: result.statusExplanation,
    };
  }
  if (result.securityStatus === "no_known_issues") {
    return {
      label: "No confirmed issue in the checked data",
      detail: "Green is not a full application audit and not a guarantee the runtime is secure.",
    };
  }
  return {
    label: "Could not assess",
    detail: result.statusExplanation,
  };
}
