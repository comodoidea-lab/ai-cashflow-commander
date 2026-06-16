import type { FinanceInput, SafetyMetrics, SafetyStatus } from "../types.js";

const MS_PER_DAY = 86_400_000;

function parseDate(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/** Layer 1 — all numeric KPIs are deterministic */
export function computeSafetyMetrics(input: FinanceInput): SafetyMetrics {
  const upcomingTotal = input.upcomingPayments.reduce((s, p) => s + p.amount, 0);
  const projectedBalanceAfterPayments =
    input.currentBalance + input.projectedIncome - input.confirmedExpenses - upcomingTotal;

  const gapToSafety = Math.max(0, input.safetyBufferTarget - projectedBalanceAfterPayments);

  const dailyBurn = input.monthlyBurnRate > 0 ? input.monthlyBurnRate / 30 : 0;
  const runwayDays =
    dailyBurn > 0
      ? Math.floor(Math.max(0, projectedBalanceAfterPayments) / dailyBurn)
      : projectedBalanceAfterPayments > 0
        ? 999
        : 0;

  const safeUntilDate = addDays(input.asOfDate, runwayDays);

  const score = computeSafetyScore({
    projectedBalance: projectedBalanceAfterPayments,
    safetyBufferTarget: input.safetyBufferTarget,
    runwayDays,
    gapToSafety,
  });

  const status = scoreToStatus(score, runwayDays);

  return {
    status,
    score,
    gapToSafety,
    runwayDays,
    safeUntilDate,
    projectedBalanceAfterPayments,
    monthlyBurnRate: input.monthlyBurnRate,
  };
}

interface ScoreInput {
  projectedBalance: number;
  safetyBufferTarget: number;
  runwayDays: number;
  gapToSafety: number;
}

/** 0–100 score: buffer coverage (60%) + runway (40%) */
export function computeSafetyScore(input: ScoreInput): number {
  const bufferRatio =
    input.safetyBufferTarget > 0
      ? Math.min(1, input.projectedBalance / input.safetyBufferTarget)
      : input.projectedBalance > 0
        ? 1
        : 0;

  const runwayScore = Math.min(1, input.runwayDays / 90); // 90 days = full runway component

  const raw = bufferRatio * 60 + runwayScore * 40;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function scoreToStatus(score: number, runwayDays: number): SafetyStatus {
  if (runwayDays < 30 || score < 50) return "DANGER";
  if (runwayDays < 60 || score < 75) return "CAUTION";
  return "SAFE";
}

export function computeGapWorkDays(gapYen: number, dailyWorkIncome: number): number {
  if (gapYen <= 0) return 0;
  if (dailyWorkIncome <= 0) return 0;
  return Math.ceil(gapYen / dailyWorkIncome);
}

export function computeProjectedBalance(input: FinanceInput): number {
  const upcomingTotal = input.upcomingPayments.reduce((s, p) => s + p.amount, 0);
  return input.currentBalance + input.projectedIncome - input.confirmedExpenses - upcomingTotal;
}

export { addDays, daysBetween, parseDate };
