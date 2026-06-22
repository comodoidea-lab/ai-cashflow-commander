import type { FinanceInput } from "../types.js";

/** Demo scenario: DANGER — 手取り18.5万・貯金ほぼなし・車ローン・リボ */
export function createSampleFinanceInput(): FinanceInput {
  return {
    currentBalance: 8_500,
    projectedIncome: 185_000,
    confirmedExpenses: 198_000,
    monthlyBurnRate: 198_000,
    safetyBufferTarget: 50_000,
    dailyWorkIncome: 0,
    asOfDate: "2026-06-22",
    transactions: [
      {
        id: "tx-1",
        date: "2026-06-25",
        amount: 185_000,
        category: "income",
        description: "給与",
      },
      {
        id: "tx-2",
        date: "2026-06-26",
        amount: -15_000,
        category: "loan",
        description: "車ローン",
      },
      {
        id: "tx-3",
        date: "2026-06-28",
        amount: -28_000,
        category: "card",
        description: "カードリボ引落",
      },
    ],
    subscriptions: [
      {
        id: "sub-netflix",
        name: "Netflix",
        monthlyCost: 1_490,
        category: "streaming",
        usageScore: 8,
        lastUsedDaysAgo: 14,
        billingDay: 12,
      },
      {
        id: "sub-spotify",
        name: "Spotify",
        monthlyCost: 980,
        category: "music",
        usageScore: 35,
        lastUsedDaysAgo: 2,
        billingDay: 18,
      },
      {
        id: "sub-icloud",
        name: "iCloud+ 200GB",
        monthlyCost: 400,
        category: "storage",
        usageScore: 100,
        lastUsedDaysAgo: 0,
        billingDay: 5,
      },
    ],
    upcomingPayments: [
      {
        id: "pay-salary",
        name: "給与入金",
        amount: 185_000,
        dueDate: "2026-06-25",
        type: "income",
      },
      {
        id: "pay-car",
        name: "車ローン",
        amount: 15_000,
        dueDate: "2026-06-26",
        type: "fixed",
      },
      {
        id: "pay-revo",
        name: "カード引落（リボ）",
        amount: 28_000,
        dueDate: "2026-06-28",
        type: "card",
      },
    ],
  };
}
