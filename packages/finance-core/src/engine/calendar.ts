import type { CalendarDayMarker, FinanceInput, UpcomingPayment } from "../types.js";
import { addDays, daysBetween } from "./safety.js";

const WITHDRAWAL_WARNING_DAYS = 3;
const DANGER_RUNWAY_THRESHOLD = 30;

/** Layer 1 — calendar markers from payment schedule (no AI) */
export function buildCalendarMarkers(input: FinanceInput, runwayDays: number): CalendarDayMarker[] {
  const markers: CalendarDayMarker[] = [];
  const monthStart = input.asOfDate.slice(0, 7);

  for (const payment of input.upcomingPayments) {
    if (!payment.dueDate.startsWith(monthStart)) continue;

    const daysUntil = daysBetween(input.asOfDate, payment.dueDate);

    if (daysUntil >= 0 && daysUntil <= WITHDRAWAL_WARNING_DAYS) {
      markers.push({
        date: payment.dueDate,
        type: "withdrawal_warning",
        label: `${payment.name} 引落まで${daysUntil}日`,
        countdownDays: daysUntil,
        amount: payment.amount,
      });
    }

    markers.push({
      date: payment.dueDate,
      type: payment.type === "subscription" ? "bill" : "bill",
      label: `${payment.name} ¥${payment.amount.toLocaleString("ja-JP")}`,
      countdownDays: daysUntil >= 0 ? daysUntil : undefined,
      amount: payment.amount,
    });

    if (runwayDays < DANGER_RUNWAY_THRESHOLD && daysUntil >= 0 && daysUntil <= 7) {
      markers.push({
        date: payment.dueDate,
        type: "danger",
        label: `危険日: 支払後ランウェイ不足リスク`,
        amount: payment.amount,
      });
    }
  }

  for (const tx of input.transactions) {
    if (tx.amount <= 0 || !tx.date.startsWith(monthStart)) continue;
    markers.push({
      date: tx.date,
      type: "income",
      label: `入金 ¥${tx.amount.toLocaleString("ja-JP")}`,
      amount: tx.amount,
    });
  }

  // Recommend work days when gap exists — spread across remaining month
  const gap = Math.max(
    0,
    input.safetyBufferTarget -
      (input.currentBalance + input.projectedIncome - input.confirmedExpenses),
  );
  if (gap > 0 && input.dailyWorkIncome > 0) {
    const workDaysNeeded = Math.ceil(gap / input.dailyWorkIncome);
    for (let i = 1; i <= Math.min(workDaysNeeded, 5); i++) {
      const workDate = addDays(input.asOfDate, i * 2);
      if (workDate.startsWith(monthStart)) {
        markers.push({
          date: workDate,
          type: "work_recommended",
          label: `追加稼働推奨（+¥${input.dailyWorkIncome.toLocaleString("ja-JP")}/日）`,
        });
      }
    }
  }

  return markers.sort((a, b) => a.date.localeCompare(b.date));
}

export function getPaymentWarnings(
  payments: UpcomingPayment[],
  asOfDate: string,
): Array<{ name: string; dueDate: string; daysUntil: number; amount: number }> {
  return payments
    .map((p) => ({
      name: p.name,
      dueDate: p.dueDate,
      daysUntil: daysBetween(asOfDate, p.dueDate),
      amount: p.amount,
    }))
    .filter((p) => p.daysUntil >= 0 && p.daysUntil <= WITHDRAWAL_WARNING_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
