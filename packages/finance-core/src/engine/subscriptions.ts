import type { Subscription, SubscriptionCandidate, SubscriptionOptimization } from "../types.js";

/** Category groups that commonly overlap for solo entrepreneurs */
const OVERLAP_GROUPS: Record<string, string[]> = {
  design: ["design", "デザイン", "creative", "figma", "adobe"],
  storage: ["storage", "ストレージ", "backup", "dropbox", "drive"],
  meeting: ["meeting", "会議", "video", "zoom", "meet"],
  ai: ["ai", "assistant", "chatgpt", "claude"],
};

function normalizeCategory(cat: string): string {
  const lower = cat.toLowerCase();
  for (const [group, keywords] of Object.entries(OVERLAP_GROUPS)) {
    if (keywords.some((k) => lower.includes(k))) return group;
  }
  return lower;
}

/** Layer 1 — subscription duplicate detection & savings ranking (no AI) */
export function analyzeSubscriptions(subscriptions: Subscription[]): SubscriptionOptimization {
  const byGroup = new Map<string, Subscription[]>();

  for (const sub of subscriptions) {
    const group = normalizeCategory(sub.category);
    const list = byGroup.get(group) ?? [];
    list.push(sub);
    byGroup.set(group, list);
  }

  const duplicateCategories: string[] = [];
  const candidates: SubscriptionCandidate[] = [];

  for (const [group, subs] of byGroup) {
    if (subs.length > 1) duplicateCategories.push(group);

    for (const sub of subs) {
      const candidate = evaluateCancelCandidate(sub, subs.length > 1);
      if (candidate) candidates.push(candidate);
    }
  }

  candidates.sort((a, b) => b.yearlySaving - a.yearlySaving || a.priority - b.priority);

  const monthlySavingPotential = candidates.reduce((s, c) => s + c.monthlyCost, 0);
  const yearlySavingPotential = candidates.reduce((s, c) => s + c.yearlySaving, 0);

  return {
    monthlySavingPotential,
    yearlySavingPotential,
    candidates: candidates.slice(0, 5),
    duplicateCategories,
  };
}

function evaluateCancelCandidate(
  sub: Subscription,
  hasDuplicateInCategory: boolean,
): SubscriptionCandidate | null {
  const yearlySaving = sub.monthlyCost * 12;
  let reason = "";
  let priority = 99;

  if (sub.usageScore === 0 || (sub.lastUsedDaysAgo !== undefined && sub.lastUsedDaysAgo > 90)) {
    reason = `過去90日間の利用実績がありません（最終利用: ${sub.lastUsedDaysAgo ?? 90}日前）`;
    priority = 1;
  } else if (sub.usageScore < 20) {
    reason = `利用頻度が低いです（利用率 ${sub.usageScore}%）。代替ツールで代替可能`;
    priority = 2;
  } else if (hasDuplicateInCategory && sub.usageScore < 50) {
    reason = `同一カテゴリに複数契約があります（${sub.category}）。統合でコスト削減可能`;
    priority = 2;
  } else if (sub.usageScore < 40) {
    reason = `月間利用率 ${sub.usageScore}% — 解約またはダウングレードを検討`;
    priority = 3;
  } else {
    return null;
  }

  return {
    subscriptionId: sub.id,
    name: sub.name,
    monthlyCost: sub.monthlyCost,
    yearlySaving,
    reason,
    priority,
  };
}

export function sumMonthlySubscriptions(subscriptions: Subscription[]): number {
  return subscriptions.reduce((s, sub) => s + sub.monthlyCost, 0);
}
