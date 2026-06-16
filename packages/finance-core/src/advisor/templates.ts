import type { AdvisorBrief, LLMPolishInput, LLMPolishOutput } from "../types.js";

/** Layer 2 fallback copy when Layer 3 LLM is skipped */
export function buildFallbackCopy(brief: AdvisorBrief): LLMPolishOutput {
  const topSub = brief.subscriptionOptimization.candidates[0];

  const adviceText = truncate(
    brief.gapToSafety > 0
      ? `${brief.gapMessage}。${brief.workDaysMessage}。最優先: ${brief.primaryAction.title}`
      : `スコア ${brief.score}/100・Runway ${brief.runwayDays}日。${brief.primaryAction.title}`,
    120,
  );

  const priorityActionsText = padActions(
    brief.priorityActions.map((a) => a.title),
  );

  const subscriptionComment = topSub
    ? `${topSub.name} 解約で年間 ¥${topSub.yearlySaving.toLocaleString("ja-JP")} 削減可能。${topSub.reason}`
    : brief.subscriptionOptimization.monthlySavingPotential > 0
      ? `月 ¥${brief.subscriptionOptimization.monthlySavingPotential.toLocaleString("ja-JP")} の改善余地があります`
      : "サブスク構成は最適化済みです";

  return {
    adviceText,
    priorityActionsText,
    subscriptionComment,
    usedFallback: true,
  };
}

/** Layer 2 template from LLM input (used when polisher returns invalid output) */
export function buildFallbackFromLLMInput(input: LLMPolishInput): LLMPolishOutput {
  const adviceText = truncate(
    input.gapYen > 0
      ? `あと ¥${input.gapYen.toLocaleString("ja-JP")} で安全圏。${input.primaryActionTitle}`
      : `安全圏内（${input.score}/100）。Runway ${input.runwayDays}日。${input.primaryActionTitle}`,
    120,
  );

  const priorityActionsText = padActions(input.priorityActions.map((a) => a.title));

  const sub = input.subscriptionCandidates[0];
  const subscriptionComment = sub
    ? `${sub.name}: 年間 ¥${sub.yearlySaving.toLocaleString("ja-JP")} 削減 — ${sub.reason}`
    : "解約候補はありません";

  return {
    adviceText,
    priorityActionsText,
    subscriptionComment,
    usedFallback: true,
  };
}

function padActions(titles: string[]): [string, string, string] {
  const padded = [...titles];
  while (padded.length < 3) padded.push("—");
  return [padded[0], padded[1], padded[2]];
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export const LLM_SYSTEM_PROMPT = `あなたは個人事業主向けAI CFOの文案担当です。
数値計算は禁止。入力JSONの事実のみを使い、日本語で簡潔に書いてください。
出力は必ずJSONのみ:
{"adviceText":"120字以内","priorityActionsText":["優先1","優先2","優先3"],"subscriptionComment":"80字以内"}
曖昧表現（「見直しましょう」等）は禁止。金額・日数・サービス名をそのまま使うこと。`;

export function buildLLMUserPrompt(input: LLMPolishInput): string {
  return JSON.stringify(input);
}

/** Parse LLM JSON response with validation */
export function parseLLMResponse(raw: string): LLMPolishOutput | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
      adviceText?: string;
      priorityActionsText?: string[];
      subscriptionComment?: string;
    };

    if (!parsed.adviceText || !Array.isArray(parsed.priorityActionsText)) return null;

    const adviceText = parsed.adviceText.slice(0, 120);
    const priorityActionsText = padActions(parsed.priorityActionsText);
    const subscriptionComment = (parsed.subscriptionComment ?? "").slice(0, 120);

    return {
      adviceText,
      priorityActionsText,
      subscriptionComment,
      usedFallback: false,
    };
  } catch {
    return null;
  }
}
