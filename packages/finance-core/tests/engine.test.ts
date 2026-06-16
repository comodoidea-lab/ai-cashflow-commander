import { describe, expect, it } from "vitest";
import {
  buildAdvisorBrief,
  computeSafetyMetrics,
  computeSafetyScore,
  createSampleFinanceInput,
  analyzeSubscriptions,
  parseCsvTransactions,
  scoreToStatus,
} from "../src/index.js";

describe("Layer 1: Safety Score", () => {
  it("computes CAUTION status for sample input", () => {
    const input = createSampleFinanceInput();
    const metrics = computeSafetyMetrics(input);

    expect(metrics.score).toBeGreaterThan(0);
    expect(metrics.score).toBeLessThanOrEqual(100);
    expect(["SAFE", "CAUTION", "DANGER"]).toContain(metrics.status);
    expect(metrics.runwayDays).toBeGreaterThan(0);
    expect(metrics.safeUntilDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns DANGER when runway under 30 days", () => {
    expect(scoreToStatus(80, 20)).toBe("DANGER");
  });

  it("returns SAFE when score high and runway long", () => {
    expect(scoreToStatus(90, 90)).toBe("SAFE");
  });

  it("gap to safety is non-negative", () => {
    const input = createSampleFinanceInput();
    const metrics = computeSafetyMetrics(input);
    expect(metrics.gapToSafety).toBeGreaterThanOrEqual(0);
  });
});

describe("Layer 1: Subscriptions", () => {
  it("detects low-usage cancel candidates", () => {
    const input = createSampleFinanceInput();
    const result = analyzeSubscriptions(input.subscriptions);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.monthlySavingPotential).toBeGreaterThan(0);
    expect(result.candidates.some((c) => c.name.includes("Dropbox"))).toBe(true);
  });

  it("flags duplicate design category", () => {
    const input = createSampleFinanceInput();
    const result = analyzeSubscriptions(input.subscriptions);
    expect(result.duplicateCategories).toContain("design");
  });
});

describe("Layer 2: Rule-based Advisor", () => {
  it("produces concrete gap message", () => {
    const brief = buildAdvisorBrief(createSampleFinanceInput());

    expect(brief.gapMessage).toMatch(/安全圏|問題ありません/);
    expect(brief.priorityActions.length).toBeGreaterThan(0);
    expect(brief.primaryAction.title).toBeTruthy();
    expect(brief.calendarMarkers.length).toBeGreaterThan(0);
  });

  it("includes payment warnings within 3 days window", () => {
    const input = createSampleFinanceInput();
    input.asOfDate = "2026-06-22"; // 2 days before card payment on 25th
    const brief = buildAdvisorBrief(input);

    expect(brief.paymentWarnings.some((w) => w.name.includes("カード"))).toBe(true);
  });
});

describe("Layer 1: CSV parsing", () => {
  it("parses Japanese bank CSV without LLM", () => {
    const csv = `取引日,摘要,出金,入金
2026/06/01,クライアント報酬,,350000
2026/06/05,Adobe CC,7780,
2026/06/10,AWS,5000,`;

    const rows = parseCsvTransactions(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0].amount).toBe(350000);
    expect(rows[1].category).toBe("design");
  });
});

describe("Score formula", () => {
  it("returns 100 when buffer full and runway 90+ days", () => {
    const score = computeSafetyScore({
      projectedBalance: 1_000_000,
      safetyBufferTarget: 500_000,
      runwayDays: 120,
      gapToSafety: 0,
    });
    expect(score).toBe(100);
  });
});
