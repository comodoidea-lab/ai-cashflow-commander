export * from "./types.js";
export * from "./engine/safety.js";
export * from "./engine/subscriptions.js";
export * from "./engine/calendar.js";
export * from "./engine/csv.js";
export * from "./advisor/rules.js";
export * from "./advisor/templates.js";

import type { DashboardResponse, FinanceInput } from "./types.js";
import { buildAdvisorBrief, buildDashboardKpis, briefToLLMInput } from "./advisor/rules.js";
import { buildFallbackCopy } from "./advisor/templates.js";
import { computeSafetyMetrics } from "./engine/safety.js";

/** Full pipeline Layers 1+2 (Layer 3 applied separately in worker) */
export function buildDeterministicDashboard(input: FinanceInput): Omit<DashboardResponse, "copy"> & {
  llmInput: ReturnType<typeof briefToLLMInput>;
} {
  const metrics = computeSafetyMetrics(input);
  const brief = buildAdvisorBrief(input);
  const kpis = buildDashboardKpis(input);
  const llmInput = briefToLLMInput(brief);

  return { metrics, brief, kpis, llmInput };
}

export function withFallbackCopy(
  partial: Omit<DashboardResponse, "copy"> & { llmInput: ReturnType<typeof briefToLLMInput> },
): DashboardResponse {
  const { llmInput, ...rest } = partial;
  return {
    ...rest,
    copy: buildFallbackCopy(rest.brief),
  };
}

export { createSampleFinanceInput } from "./fixtures/sample-input.js";
