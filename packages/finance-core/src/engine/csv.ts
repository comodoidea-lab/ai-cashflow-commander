import type { FinanceInput, Transaction } from "../types.js";

/** Layer 1 — CSV row parsing (no LLM). Supports common Japanese bank CSV shapes. */
export interface ParsedCsvRow {
  date: string;
  amount: number;
  description: string;
  category: string;
}

const DATE_PATTERNS = [
  /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
  /^(\d{4})(\d{2})(\d{2})/,
];

function parseDateCell(raw: string): string | null {
  const trimmed = raw.trim();
  for (const pattern of DATE_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m) {
      const y = m[1];
      const mo = m[2].padStart(2, "0");
      const d = m[3].padStart(2, "0");
      return `${y}-${mo}-${d}`;
    }
  }
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[¥,\s"]/g, "").replace(/^\((.+)\)$/, "-$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Heuristic category from description keywords */
export function categorizeDescription(description: string): string {
  const d = description.toLowerCase();
  if (/adobe|figma|canva|creative/.test(d)) return "design";
  if (/dropbox|google|icloud|storage/.test(d)) return "storage";
  if (/zoom|meet|teams/.test(d)) return "meeting";
  if (/openai|chatgpt|anthropic|claude/.test(d)) return "ai";
  if (/aws|azure|gcp|server|hosting/.test(d)) return "infrastructure";
  if (/tax|税金|国税|地方税/.test(d)) return "tax";
  if (/振込|入金|報酬|売上/.test(d)) return "income";
  return "other";
}

export function parseCsvTransactions(csvText: string): ParsedCsvRow[] {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = header.findIndex((h) => /日付|date|取引日|年月日/.test(h));
  const amountIdx = header.findIndex((h) => /^金額|amount|取引金額$/.test(h));
  const debitIdx = header.findIndex((h) => /出金|debit|支出/.test(h));
  const creditIdx = header.findIndex((h) => /入金|credit|収入/.test(h));
  const descIdx = header.findIndex((h) => /摘要|内容|description|メモ|取引内容/.test(h));

  if (dateIdx < 0) return [];
  if (amountIdx < 0 && debitIdx < 0 && creditIdx < 0) return [];

  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const date = parseDateCell(cols[dateIdx] ?? "");
    if (!date) continue;

    let amount: number | null = null;
    if (amountIdx >= 0) {
      amount = parseAmount(cols[amountIdx] ?? "");
    } else {
      const debit = debitIdx >= 0 ? parseAmount(cols[debitIdx] ?? "") : null;
      const credit = creditIdx >= 0 ? parseAmount(cols[creditIdx] ?? "") : null;
      if (credit !== null && credit > 0) amount = credit;
      else if (debit !== null && debit > 0) amount = -debit;
      else if (debit !== null && debit < 0) amount = debit;
      else if (credit !== null && credit < 0) amount = -Math.abs(credit);
    }
    if (amount === null) continue;

    const description = (descIdx >= 0 ? cols[descIdx] : cols.join(" "))?.trim() ?? "";
    rows.push({
      date,
      amount,
      description,
      category: categorizeDescription(description),
    });
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

export function aggregateMonthlyFromTransactions(
  rows: ParsedCsvRow[],
  monthPrefix: string,
): { income: number; expenses: number } {
  let income = 0;
  let expenses = 0;

  for (const row of rows) {
    if (!row.date.startsWith(monthPrefix)) continue;
    if (row.amount > 0) income += row.amount;
    else expenses += Math.abs(row.amount);
  }

  return { income, expenses };
}

export function rowsToTransactions(rows: ParsedCsvRow[]): Transaction[] {
  return rows.map((r, i) => ({
    id: `csv-${i}-${r.date}`,
    date: r.date,
    amount: r.amount,
    category: r.category,
    description: r.description,
  }));
}
