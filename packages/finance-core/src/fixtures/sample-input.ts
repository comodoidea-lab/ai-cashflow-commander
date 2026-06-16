import type { FinanceInput } from "../types.js";

/** Demo scenario: CAUTION — gap ¥18,000, runway 34 days */
export function createSampleFinanceInput(): FinanceInput {
  return {
    currentBalance: 820_000,
    projectedIncome: 1_250_000,
    confirmedExpenses: 420_000,
    monthlyBurnRate: 380_000,
    safetyBufferTarget: 900_000,
    dailyWorkIncome: 6_000,
    asOfDate: "2026-06-15",
    transactions: [
      {
        id: "tx-1",
        date: "2026-06-10",
        amount: 350_000,
        category: "income",
        description: "クライアントA 6月分",
      },
      {
        id: "tx-2",
        date: "2026-06-05",
        amount: -50_000,
        category: "infrastructure",
        description: "AWS 6月分",
      },
    ],
    subscriptions: [
      {
        id: "sub-adobe",
        name: "Adobe Creative Cloud",
        monthlyCost: 7_780,
        category: "design",
        usageScore: 15,
        lastUsedDaysAgo: 45,
        billingDay: 27,
      },
      {
        id: "sub-zoom",
        name: "Zoom Pro",
        monthlyCost: 2_100,
        category: "meeting",
        usageScore: 24,
        lastUsedDaysAgo: 12,
        billingDay: 20,
      },
      {
        id: "sub-dropbox",
        name: "Dropbox Professional",
        monthlyCost: 1_980,
        category: "storage",
        usageScore: 0,
        lastUsedDaysAgo: 120,
        billingDay: 25,
      },
      {
        id: "sub-chatgpt",
        name: "ChatGPT Plus",
        monthlyCost: 3_000,
        category: "ai",
        usageScore: 92,
        lastUsedDaysAgo: 0,
        billingDay: 15,
      },
      {
        id: "sub-figma",
        name: "Figma Professional",
        monthlyCost: 1_800,
        category: "design",
        usageScore: 88,
        lastUsedDaysAgo: 1,
        billingDay: 10,
      },
    ],
    upcomingPayments: [
      {
        id: "pay-rent",
        name: "オフィス家賃",
        amount: 88_000,
        dueDate: "2026-06-20",
        type: "fixed",
      },
      {
        id: "pay-card",
        name: "ビジネスカード引落",
        amount: 125_000,
        dueDate: "2026-06-25",
        type: "card",
      },
      {
        id: "pay-adobe",
        name: "Adobe CC",
        amount: 7_780,
        dueDate: "2026-06-27",
        type: "subscription",
      },
    ],
  };
}
