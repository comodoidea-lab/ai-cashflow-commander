import { Hono } from "hono";
import { cors } from "hono/cors";
import type { FinanceInput } from "@acc/finance-core";
import {
  buildDeterministicDashboard,
  createSampleFinanceInput,
  parseCsvTransactions,
  rowsToTransactions,
  aggregateMonthlyFromTransactions,
} from "@acc/finance-core";
import type { Env } from "./ai/polisher.js";
import { polishCopy, ESTIMATED_NEURONS_PER_CALL } from "./ai/polisher.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "ai-cashflow-commander",
    layers: ["deterministic", "rule-based", "llm-polisher"],
  }),
);

/** Full dashboard: Layer 1 + 2 + optional Layer 3 */
app.post("/api/dashboard", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<FinanceInput> & {
    skipPolish?: boolean;
  };

  const input: FinanceInput = {
    ...createSampleFinanceInput(),
    ...body,
    subscriptions: body.subscriptions ?? createSampleFinanceInput().subscriptions,
    upcomingPayments: body.upcomingPayments ?? createSampleFinanceInput().upcomingPayments,
    transactions: body.transactions ?? createSampleFinanceInput().transactions,
  };

  const partial = buildDeterministicDashboard(input);

  const copy =
    body.skipPolish === true
      ? (await import("@acc/finance-core")).buildFallbackCopy(partial.brief)
      : await polishCopy(c.env, partial.llmInput, caches.default);

  return c.json({
    metrics: partial.metrics,
    brief: partial.brief,
    kpis: partial.kpis,
    copy,
  });
});

/** Layer 1+2 only — zero AI cost */
app.post("/api/dashboard/deterministic", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<FinanceInput>;
  const input = { ...createSampleFinanceInput(), ...body };
  const partial = buildDeterministicDashboard(input);
  const { buildFallbackCopy } = await import("@acc/finance-core");

  return c.json({
    metrics: partial.metrics,
    brief: partial.brief,
    kpis: partial.kpis,
    copy: buildFallbackCopy(partial.brief),
  });
});

/** CSV import — Layer 1 code only, no LLM */
app.post("/api/import/csv", async (c) => {
  const { csv, monthPrefix } = (await c.req.json()) as {
    csv: string;
    monthPrefix?: string;
  };

  if (!csv || typeof csv !== "string") {
    return c.json({ error: "csv field required" }, 400);
  }

  const rows = parseCsvTransactions(csv);
  const prefix = monthPrefix ?? new Date().toISOString().slice(0, 7);
  const aggregated = aggregateMonthlyFromTransactions(rows, prefix);
  const transactions = rowsToTransactions(rows);

  return c.json({
    rowCount: rows.length,
    aggregated,
    transactions,
    // Pass to /api/dashboard — never send raw csv to LLM
  });
});

/** Layer 3 polish endpoint — accepts pre-computed LLM input JSON only */
app.post("/api/ai/polish", async (c) => {
  const input = await c.req.json();
  const copy = await polishCopy(c.env, input, caches.default);
  return c.json(copy);
});

app.get("/api/ai/cost-estimate", (c) => {
  const budget = Number(c.env.AI_DAILY_NEURON_BUDGET) || 8000;
  const freeTierDaily = 10_000;
  const costPer1kNeurons = 0.011;

  return c.json({
    model: c.env.AI_MODEL,
    estimatedNeuronsPerPolishCall: ESTIMATED_NEURONS_PER_CALL,
    maxPolishCallsPerDayWithinBudget: Math.floor(budget / ESTIMATED_NEURONS_PER_CALL),
    cloudflareFreeTierNeuronsPerDay: freeTierDaily,
    overageUsdPer1000Neurons: costPer1kNeurons,
    aiGateway: c.env.AI_GATEWAY_ENABLED === "true",
    note: "Safety Score / Runway / Gap are computed in Layer 1 — no neurons consumed",
  });
});

app.get("/", (c) => c.redirect("/_7/code.html", 302));

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
