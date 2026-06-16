import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

let dashboardCache = null;

async function getDashboard() {
  if (!dashboardCache) {
    const raw = await readFile(join(ROOT, "ai_cashflow_commander/fallback-dashboard.json"), "utf8");
    dashboardCache = JSON.parse(raw);
  }
  return dashboardCache;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, data, status = 200) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

function parseCsvRows(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.toLowerCase());
  const dateIdx = header.findIndex((h) => /日付|date/.test(h));
  const debitIdx = header.findIndex((h) => /出金|debit/.test(h));
  const creditIdx = header.findIndex((h) => /入金|credit/.test(h));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const date = cols[dateIdx]?.trim().replace(/\//g, "-");
    const credit = Number(cols[creditIdx]?.replace(/"/g, "") || 0);
    const debit = Number(cols[debitIdx]?.replace(/"/g, "") || 0);
    const amount = credit > 0 ? credit : debit > 0 ? -debit : 0;
    if (date && amount) rows.push({ date, amount });
  }
  return rows;
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

  if (path === "/health") return json(res, { ok: true, preview: true });

  if (path === "/api/dashboard/deterministic" && req.method === "POST") {
    const data = await getDashboard();
    return json(res, data);
  }

  if (path === "/api/import/csv" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const rows = parseCsvRows(body.csv || "");
      return json(res, { rowCount: rows.length, aggregated: { income: 350000, expenses: 12780 }, transactions: rows });
    } catch {
      return json(res, { error: "invalid" }, 400);
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
    cors(res);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Preview: http://127.0.0.1:${PORT}/_7/code.html`);
});
