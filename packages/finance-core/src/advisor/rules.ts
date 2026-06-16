import type {
  AdvisorBrief,
  FinanceInput,
  LLMPolishInput,
  RecommendedAction,
  SafetyMetrics,
  SubscriptionOptimization,
} from "../types.js";
import { buildCalendarMarkers, getPaymentWarnings } from "../engine/calendar.js";
import {
  analyzeSubscriptions,
} from "../engine/subscriptions.js";
import {
  computeGapWorkDays,
  computeSafetyMetrics,
  computeProjectedBalance,
} from "../engine/safety.js";

/** Layer 2 — rule-based advisor (no LLM) */
export function buildAdvisorBrief(input: FinanceInput): AdvisorBrief {
  const metrics = computeSafetyMetrics(input);
  const subscriptionOptimization = analyzeSubscriptions(input.subscriptions);
  const gapWorkDays = computeGapWorkDays(metrics.gapToSafety, input.dailyWorkIncome);

  const gapMessage = buildGapMessage(metrics);
  const workDaysMessage = buildWorkDaysMessage(metrics, gapWorkDays);

  const priorityActions = buildPriorityActions(input, metrics, subscriptionOptimization);
  const primaryAction = priorityActions[0] ?? fallbackAction(metrics);

  const calendarMarkers = buildCalendarMarkers(input, metrics.runwayDays);
  const paymentWarnings = getPaymentWarnings(input.upcomingPayments, input.asOfDate);

  return {
    status: metrics.status,
    score: metrics.score,
    gapToSafety: metrics.gapToSafety,
    gapWorkDays,
    runwayDays: metrics.runwayDays,
    safeUntilDate: metrics.safeUntilDate,
    gapMessage,
    workDaysMessage,
    primaryAction,
    priorityActions: priorityActions.slice(0, 3) as AdvisorBrief["priorityActions"],
    subscriptionOptimization,
    calendarMarkers,
    paymentWarnings,
  };
}

function buildGapMessage(metrics: SafetyMetrics): string {
  if (metrics.gapToSafety <= 0) return "今のペースなら問題ありません";
  return `あと ¥${metrics.gapToSafety.toLocaleString("ja-JP")} で安全圏です`;
}

function buildWorkDaysMessage(metrics: SafetyMetrics, gapWorkDays: number): string {
  if (metrics.gapToSafety <= 0) return "追加稼働は不要です";
  if (gapWorkDays <= 0) return "追加収入の確保を検討してください";
  return `あと ${gapWorkDays} 日の追加稼働を推奨します`;
}

function buildPriorityActions(
  input: FinanceInput,
  metrics: SafetyMetrics,
  subs: SubscriptionOptimization,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  if (metrics.gapToSafety > 0) {
    actions.push({
      priority: 1,
      id: "close-gap",
      title: `追加収入 ¥${metrics.gapToSafety.toLocaleString("ja-JP")} を確保`,
      impactYen: metrics.gapToSafety,
      category: "income",
      templateReason: `安全圏バッファまで ¥${metrics.gapToSafety.toLocaleString("ja-JP")} 不足しています`,
    });
  }

  if (subs.candidates.length > 0) {
    const top = subs.candidates[0];
    actions.push({
      priority: actions.length === 0 ? 1 : 2,
      id: `cancel-${top.subscriptionId}`,
      title: `${top.name} を解約（年間 ¥${top.yearlySaving.toLocaleString("ja-JP")} 削減）`,
      impactYen: top.yearlySaving,
      category: "subscription",
      templateReason: top.reason,
    });
  }

  if (subs.monthlySavingPotential > 0 && subs.candidates.length > 1) {
    actions.push({
      priority: 2,
      id: "subscription-cleanup",
      title: `サブスク整理（月 ¥${subs.monthlySavingPotential.toLocaleString("ja-JP")} 改善）`,
      impactYen: subs.monthlySavingPotential * 12,
      category: "subscription",
      templateReason: `${subs.candidates.length} 件の解約候補を検出`,
    });
  }

  const taxReserve = Math.round(input.projectedIncome * 0.1);
  if (metrics.status !== "DANGER" && taxReserve > 0) {
    actions.push({
      priority: 3,
      id: "tax-reserve",
      title: `税金積立 ¥${taxReserve.toLocaleString("ja-JP")} を開始`,
      impactYen: taxReserve,
      category: "tax",
      templateReason: "今月収入の10%を納税準備口座へ",
    });
  }

  const overdue = input.transactions.filter(
    (t) => t.category === "income" && t.amount > 0 && t.description.includes("未回収"),
  );
  if (overdue.length > 0) {
    const total = overdue.reduce((s, t) => s + t.amount, 0);
    actions.unshift({
      priority: 1,
      id: "collect-receivables",
      title: `未回収売掛 ¥${total.toLocaleString("ja-JP")} の督促`,
      impactYen: total,
      category: "collection",
      templateReason: `${overdue.length} 件の請求が期限超過`,
    });
  }

  return renumberPriorities(actions).slice(0, 5);
}

function renumberPriorities(actions: RecommendedAction[]): RecommendedAction[] {
  return actions.map((a, i) => ({
    ...a,
    priority: (Math.min(i + 1, 3) as 1 | 2 | 3),
  }));
}

function fallbackAction(metrics: SafetyMetrics): RecommendedAction {
  return {
    priority: 1,
    id: "maintain",
    title: "現状維持 — 安全圏内です",
    impactYen: 0,
    category: "reserve",
    templateReason: `Runway ${metrics.runwayDays} 日、スコア ${metrics.score}/100`,
  };
}

/** Compress brief to minimal JSON for Layer 3 LLM */
export function briefToLLMInput(brief: AdvisorBrief): LLMPolishInput {
  return {
    status: brief.status,
    score: brief.score,
    gapYen: brief.gapToSafety,
    gapWorkDays: brief.gapWorkDays,
    runwayDays: brief.runwayDays,
    safeUntilDate: brief.safeUntilDate,
    primaryActionTitle: brief.primaryAction.title,
    primaryActionImpactYen: brief.primaryAction.impactYen,
    priorityActions: brief.priorityActions.map((a) => ({
      priority: a.priority,
      title: a.title,
      impactYen: a.impactYen,
    })),
    subscriptionCandidates: brief.subscriptionOptimization.candidates.map((c) => ({
      name: c.name,
      yearlySaving: c.yearlySaving,
      reason: c.reason,
    })),
    monthlySavingPotential: brief.subscriptionOptimization.monthlySavingPotential,
  };
}

export function buildDashboardKpis(input: FinanceInput) {
  return {
    projectedIncome: input.projectedIncome,
    confirmedExpenses: input.confirmedExpenses,
    projectedBalance: computeProjectedBalance(input),
  };
}
