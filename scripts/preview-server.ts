/**
 * Local preview: static Stitch HTML + finance-core API (no wrangler required)
 * Usage: npx tsx scripts/preview-server.ts
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFallbackCopy,
  parseCsvTransactions,
  aggregateMonthlyFromTransactions,
  rowsToTransactions,
} from "../packages/finance-core/src/index.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = 8080;

let dashboardCache: { mtimeMs: number; data: unknown } = { mtimeMs: 0, data: null };

async function getDashboard() {
  const jsonPath = join(ROOT, "ai_cashflow_commander/fallback-dashboard.json");
  const st = await stat(jsonPath);
  if (!dashboardCache.data || st.mtimeMs !== dashboardCache.mtimeMs) {
    const raw = await readFile(jsonPath, "utf8");
    dashboardCache = { mtimeMs: st.mtimeMs, data: JSON.parse(raw) };
  }
  return dashboardCache.data as Record<string, unknown>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function cors(res: import("node:http").ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res: import("node:http").ServerResponse, data: unknown, status = 200) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === "/health") {
    return json(res, { ok: true, preview: true });
  }

  if (path === "/api/dashboard/deterministic" && req.method === "POST") {
    const data = await getDashboard();
    return json(res, data);
  }

  if (path === "/api/import/csv" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as { csv?: string; monthPrefix?: string };
      if (!body.csv) return json(res, { error: "csv required" }, 400);
      const rows = parseCsvTransactions(body.csv);
      const prefix = body.monthPrefix ?? new Date().toISOString().slice(0, 7);
      return json(res, {
        rowCount: rows.length,
        aggregated: aggregateMonthlyFromTransactions(rows, prefix),
        transactions: rowsToTransactions(rows),
      });
    } catch {
      return json(res, { error: "invalid request" }, 400);
    }
  }

  if (path === "/" || path === "") {
    res.writeHead(302, { Location: "/_7/code.html" });
    res.end();
    return;
  }

  const filePath = join(ROOT, decodeURIComponent(path));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    cors(res);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Preview server: http://127.0.0.1:${PORT}/`);
  console.log(`Dashboard:      http://127.0.0.1:${PORT}/_7/code.html`);
  console.log(`API:            http://127.0.0.1:${PORT}/api/dashboard/deterministic`);
});
