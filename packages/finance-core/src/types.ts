/** Financial safety status — deterministic, never LLM-derived */
export type SafetyStatus = "SAFE" | "CAUTION" | "DANGER";

export interface Transaction {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  amount: number; // positive = income, negative = expense
  category: string;
  description: string;
  isRecurring?: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  monthlyCost: number;
  category: string;
  /** 0–100 usage score from login/API heuristics */
  usageScore: number;
  lastUsedDaysAgo?: number;
  billingDay?: number; // 1–31
}

export interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  type: "subscription" | "fixed" | "tax" | "card";
}

export interface FinanceInput {
  /** Current bank balance (yen) */
  currentBalance: number;
  /** Expected income this month */
  projectedIncome: number;
  /** Confirmed expenses this month */
  confirmedExpenses: number;
  /** Monthly burn rate (avg daily spend × 30) */
  monthlyBurnRate: number;
  /** Target safety buffer (yen) — e.g. 2 months fixed costs */
  safetyBufferTarget: number;
  /** Daily income when working (for gap-to-days conversion) */
  dailyWorkIncome: number;
  transactions: Transaction[];
  subscriptions: Subscription[];
  upcomingPayments: UpcomingPayment[];
  /** Reference date for calculations */
  asOfDate: string;
}

export interface SafetyMetrics {
  status: SafetyStatus;
  score: number; // 0–100
  gapToSafety: number; // yen needed to reach buffer; 0 if already safe
  runwayDays: number;
  safeUntilDate: string;
  projectedBalanceAfterPayments: number;
  monthlyBurnRate: number;
}

export interface SubscriptionCandidate {
  subscriptionId: string;
  name: string;
  monthlyCost: number;
  yearlySaving: number;
  reason: string;
  priority: number;
}

export interface SubscriptionOptimization {
  monthlySavingPotential: number;
  yearlySavingPotential: number;
  candidates: SubscriptionCandidate[];
  duplicateCategories: string[];
}

export interface CalendarDayMarker {
  date: string;
  type: "income" | "bill" | "danger" | "work_recommended" | "withdrawal_warning";
  label: string;
  countdownDays?: number;
  amount?: number;
}

export interface RecommendedAction {
  priority: 1 | 2 | 3;
  id: string;
  title: string;
  impactYen: number;
  category: "income" | "subscription" | "tax" | "reserve" | "collection";
  templateReason: string;
}

/** Layer 2 output — structured facts for LLM polisher (Layer 3) */
export interface AdvisorBrief {
  status: SafetyStatus;
  score: number;
  gapToSafety: number;
  gapWorkDays: number;
  runwayDays: number;
  safeUntilDate: string;
  gapMessage: string;
  workDaysMessage: string;
  primaryAction: RecommendedAction;
  priorityActions: RecommendedAction[];
  subscriptionOptimization: SubscriptionOptimization;
  calendarMarkers: CalendarDayMarker[];
  paymentWarnings: Array<{ name: string; dueDate: string; daysUntil: number; amount: number }>;
}

/** Minimal JSON passed to LLM — never raw CSV or full transactions */
export interface LLMPolishInput {
  status: SafetyStatus;
  score: number;
  gapYen: number;
  gapWorkDays: number;
  runwayDays: number;
  safeUntilDate: string;
  primaryActionTitle: string;
  primaryActionImpactYen: number;
  priorityActions: Array<{ priority: number; title: string; impactYen: number }>;
  subscriptionCandidates: Array<{ name: string; yearlySaving: number; reason: string }>;
  monthlySavingPotential: number;
}

export interface LLMPolishOutput {
  adviceText: string; // ≤120 chars
  priorityActionsText: [string, string, string];
  subscriptionComment: string;
  /** true when Layer 3 skipped (cache hit, budget, or error) */
  usedFallback: boolean;
}

export interface DashboardResponse {
  metrics: SafetyMetrics;
  brief: AdvisorBrief;
  copy: LLMPolishOutput;
  kpis: {
    projectedIncome: number;
    confirmedExpenses: number;
    projectedBalance: number;
  };
}
