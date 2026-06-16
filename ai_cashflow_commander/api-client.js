/**
 * AI Cashflow Commander — API client & UI render helpers
 * Data source: POST /api/dashboard/deterministic (Layer 1+2, no LLM cost)
 */
(function (global) {
  const API_BASE = global.ACC_API_BASE || (typeof location !== "undefined" ? location.origin : "http://127.0.0.1:8080");

  const STATUS_STYLE = {
    SAFE: {
      text: "text-status-safe",
      bg: "bg-status-safe/10",
      border: "border-status-safe",
      bar: "bg-status-safe",
      icon: "verified",
    },
    CAUTION: {
      text: "text-status-caution",
      bg: "bg-status-caution/10",
      border: "border-status-caution",
      bar: "bg-status-caution",
      icon: "warning",
    },
    DANGER: {
      text: "text-status-danger",
      bg: "bg-status-danger/10",
      border: "border-status-danger",
      bar: "bg-status-danger",
      icon: "error",
    },
  };

  const MARKER_COLORS = {
    income: "bg-status-safe",
    bill: "bg-outline-variant",
    danger: "bg-status-danger",
    withdrawal_warning: "bg-status-caution",
    work_recommended: "bg-primary",
  };

  function formatYen(n) {
    return "¥" + Math.round(n).toLocaleString("ja-JP");
  }

  function formatDateJa(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatMonthJa(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long" });
  }

  function formatDateTimeJa(iso) {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getScenarioFromUrl() {
    if (typeof location === "undefined") return null;
    return new URLSearchParams(location.search).get("scenario");
  }

  function resolveScenarioData(scenario) {
    if (scenario === "caution") return CAUTION_FALLBACK;
    if (scenario === "danger") return DANGER_FALLBACK;
    return FALLBACK_DASHBOARD;
  }

  async function fetchDashboard() {
    const scenario = getScenarioFromUrl();
    if (scenario === "caution" || scenario === "danger") {
      return { data: resolveScenarioData(scenario), source: "fallback-" + scenario, ok: false };
    }
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/deterministic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { data: enrichDashboard(data), source: "api", ok: true };
    } catch (err) {
      console.warn("[ACC] API unavailable, using embedded fallback:", err.message);
      return { data: FALLBACK_DASHBOARD, source: "fallback", ok: false };
    }
  }

  function enrichDashboard(data) {
    return {
      ...FALLBACK_DASHBOARD,
      ...data,
      metrics: { ...FALLBACK_DASHBOARD.metrics, ...data.metrics },
      brief: { ...FALLBACK_DASHBOARD.brief, ...data.brief },
      kpis: { ...FALLBACK_DASHBOARD.kpis, ...data.kpis },
      fleetMetric: { ...FALLBACK_DASHBOARD.fleetMetric, ...(data.fleetMetric || {}) },
      surplus: { ...FALLBACK_DASHBOARD.surplus, ...(data.surplus || {}) },
      simulations: data.simulations || FALLBACK_DASHBOARD.simulations,
    };
  }

  async function fetchCsvPreview(csv) {
    try {
      const res = await fetch(`${API_BASE}/api/import/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { data: await res.json(), source: "api", ok: true };
    } catch (err) {
      return { data: null, source: "offline", ok: false, error: err.message };
    }
  }

  function statusStyle(status) {
    return STATUS_STYLE[status] || STATUS_STYLE.CAUTION;
  }

  /** FinancialSafetyHero */
  function renderSafetyHero(data, compact) {
    const m = data.metrics;
    const b = data.brief;
    const s = statusStyle(m.status);
    const scorePct = m.score;

    if (compact) {
      return `
        <section class="rounded-xl card-shadow border-2 ${s.border} ${s.bg} p-5 mb-4" data-acc="safety-hero">
          <div class="flex items-start justify-between gap-4">
            <div>
              <span class="inline-flex items-center gap-1 ${s.text} font-bold text-sm uppercase tracking-wider">
                <span class="material-symbols-outlined text-base">${s.icon}</span>${m.status}
              </span>
              <p class="text-3xl font-bold text-primary mt-1">${m.score}<span class="text-lg text-secondary font-semibold"> / 100</span></p>
              <p class="text-xs text-secondary mt-1">Financial Safety Score</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-secondary uppercase tracking-wider">Runway</p>
              <p class="text-2xl font-bold text-primary">${m.runwayDays}<span class="text-sm font-semibold">日</span></p>
              <p class="text-[10px] text-secondary mt-1">${formatDateJa(m.safeUntilDate)}まで</p>
            </div>
          </div>
        </section>`;
    }

    return `
      <section class="rounded-xl card-shadow border-2 ${s.border} bg-surface-white overflow-hidden mb-md" data-acc="safety-hero">
        <div class="h-1.5 ${s.bar} w-full"></div>
        <div class="p-lg grid grid-cols-1 md:grid-cols-3 gap-lg items-center">
          <div>
            <p class="text-label-md font-label-md text-secondary uppercase mb-2">Financial Safety Status</p>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full ${s.bg} ${s.text} text-xl font-bold uppercase tracking-wide">
                <span class="material-symbols-outlined text-2xl" style="font-variation-settings:'FILL' 1">${s.icon}</span>
                ${m.status}
              </span>
            </div>
          </div>
          <div class="text-center md:border-x border-border-subtle md:px-lg">
            <p class="text-label-md font-label-md text-secondary uppercase mb-2">Financial Safety Score</p>
            <p class="text-5xl font-bold text-primary tracking-tight">${m.score}<span class="text-2xl text-secondary font-semibold"> / 100</span></p>
            <div class="w-full max-w-xs mx-auto bg-surface-container h-2 rounded-full mt-3 overflow-hidden">
              <div class="${s.bar} h-full rounded-full transition-all duration-1000" style="width:${scorePct}%"></div>
            </div>
          </div>
          <div class="md:text-right" data-acc="runway">
            <p class="text-label-md font-label-md text-secondary uppercase mb-2">Runway</p>
            <p class="text-4xl font-bold text-primary">${m.runwayDays}<span class="text-xl font-semibold">日</span></p>
            <p class="text-sm text-secondary mt-2">現在のペースなら <strong class="text-primary">${formatDateJa(m.safeUntilDate)}</strong> まで安全</p>
          </div>
        </div>
      </section>`;
  }

  /** GapToSafetyBanner */
  function renderGapBanner(data) {
    const b = data.brief;
    const m = data.metrics;
    const s = statusStyle(m.status);
    const variant = m.gapToSafety > 0 ? s.bg : "bg-status-safe/10";

    return `
      <section class="rounded-xl ${variant} border border-border-subtle px-lg py-md mb-md flex flex-col md:flex-row md:items-center md:justify-between gap-3" data-acc="gap-banner">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined ${s.text}">flag</span>
          <p class="font-bold text-primary text-sm md:text-base">${b.gapMessage}</p>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="hidden md:inline text-secondary">|</span>
          <span class="material-symbols-outlined text-secondary text-base">schedule</span>
          <p class="font-semibold text-primary">${b.workDaysMessage}</p>
        </div>
      </section>`;
  }

  /** CommanderBrief — SAFE focuses on surplus allocation; CAUTION/DANGER on gap closure */
  function renderCommanderBrief(data) {
    const b = data.brief;
    const copy = data.copy;
    const m = data.metrics;
    const s = data.surplus || {};
    const isSafe = m.status === "SAFE";

    const title = isSafe
      ? "余剰資金の使い道を最適化"
      : b.primaryAction.title;
    const body = isSafe
      ? copy.adviceText ||
        `今月は安全圏です。余剰資金 ${formatYen(s.amount || 0)} のうち ${formatYen(s.taxReserveSuggested || 0)} を税金積立、${formatYen(s.aiDevBudgetSuggested || 0)} をAI開発予算に回せます。`
      : copy.adviceText || b.primaryAction.templateReason;

    const primaryCta = isSafe ? "税金積立を開始" : "推奨アクションを実行";
    const secondaryCta = isSafe ? "AI開発予算を確保" : "詳細を見る";

    return `
      <section class="bg-primary-container text-on-primary rounded-xl p-lg mb-md relative overflow-hidden card-shadow" data-acc="commander-brief">
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-md">
            <span class="material-symbols-outlined text-secondary-fixed" style="font-variation-settings:'FILL' 1">${isSafe ? "savings" : "auto_awesome"}</span>
            <h3 class="font-headline-md text-headline-md text-white font-bold">Commander Brief</h3>
            <span class="ml-auto text-[10px] uppercase tracking-wider bg-white/10 px-2 py-1 rounded-full">${copy.usedFallback ? "Rule-based" : "AI polished"}</span>
          </div>
          <p class="text-lg font-bold text-white mb-2 acc-break-words">${title}</p>
          <p class="text-body-md text-on-primary-fixed leading-relaxed max-w-3xl mb-lg acc-break-words">${body}</p>
          <div class="flex flex-wrap gap-md">
            <button class="bg-on-secondary text-primary px-lg py-sm rounded-xl font-bold tap-scale hover:scale-[1.02] transition-all">${primaryCta}</button>
            <button class="border border-on-primary-container text-white px-lg py-sm rounded-xl font-bold tap-scale hover:bg-primary/50 transition-all">${secondaryCta}</button>
          </div>
        </div>
      </section>`;
  }

  /** Secondary KPI row */
  function renderSecondaryKpis(data, compact) {
    const k = data.kpis;
    const card = compact
      ? "min-w-[140px] shrink-0 bg-surface-white p-4 rounded-xl shadow-sm border-t-2 border-primary"
      : "bg-surface-white p-md rounded-xl card-shadow border-t-2 border-primary";

    const wrap = compact
      ? `<div class="flex gap-3 overflow-x-auto pb-2 mb-4 snap-x" data-acc="kpis">`
      : `<div class="grid grid-cols-1 md:grid-cols-3 gap-md mb-md" data-acc="kpis">`;

    return (
      wrap +
      `
      <div class="${card}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">予測収入 <span class="normal-case">(FleetMetric Pro)</span></p>
        <p class="text-lg font-bold text-primary">${formatYen(k.projectedIncome)}</p>
        <p class="text-[10px] text-secondary mt-1 acc-break-words">売上は FleetMetric Pro から同期 — 手入力なし</p>
      </div>
      <div class="${card.replace("border-primary", "border-status-caution")}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">確定支出</p>
        <p class="text-lg font-bold text-primary">${formatYen(k.confirmedExpenses)}</p>
      </div>
      <div class="${card.replace("border-primary", "border-secondary")}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">予想残高</p>
        <p class="text-lg font-bold text-primary">${formatYen(k.projectedBalance)}</p>
      </div>
    </div>`
    );
  }

  /** ActionCalendar */
  function renderActionCalendar(data, asOfDate) {
    const markers = data.brief.calendarMarkers || [];
    const ref = asOfDate || data.brief.safeUntilDate;
    const monthPrefix = ref.slice(0, 7);
    const [y, mo] = monthPrefix.split("-").map(Number);
    const firstDay = new Date(Date.UTC(y, mo - 1, 1));
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const startPad = firstDay.getUTCDay();

    const byDate = {};
    for (const m of markers) {
      if (!m.date.startsWith(monthPrefix)) continue;
      const day = m.date.slice(8, 10);
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(m);
    }

    let cells = "";
    for (let i = 0; i < startPad; i++) {
      cells += `<div class="bg-surface-container-low min-h-[90px] p-2 opacity-30"></div>`;
    }
    const todayDay = ref.startsWith(monthPrefix) ? ref.slice(8, 10) : null;

    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, "0");
      const dayMarkers = byDate[dd] || [];
      const isToday = dd === todayDay;
      let bg = "bg-surface-white";
      if (dayMarkers.some((m) => m.type === "danger")) bg = "bg-status-danger/5 ring-1 ring-status-danger/30";
      else if (dayMarkers.some((m) => m.type === "withdrawal_warning")) bg = "bg-status-caution/5";

      const markerHtml = dayMarkers
        .slice(0, 2)
        .map((m) => {
          const color = MARKER_COLORS[m.type] || "bg-outline-variant";
          return `<div class="w-full h-1 ${color} rounded-full mt-1"></div>
            <p class="text-[9px] font-bold text-primary leading-tight mt-0.5">${m.label}</p>`;
        })
        .join("");

      cells += `
        <div class="${bg} min-h-[100px] p-2 hover:bg-surface-container-lowest transition-colors cursor-pointer relative">
          <span class="text-sm font-medium ${isToday ? "bg-primary text-white w-6 h-6 flex items-center justify-center rounded-full" : "text-primary"}">${d}</span>
          <div class="mt-1 space-y-0.5">${markerHtml}</div>
        </div>`;
    }

    return `
      <div data-acc="action-calendar">
        <div class="flex justify-between items-center mb-lg">
          <h3 class="font-headline-md text-headline-md text-primary font-bold">Action Calendar</h3>
          <span class="font-bold text-sm">${formatMonthJa(monthPrefix + "-01")}</span>
        </div>
        <div class="grid grid-cols-7 gap-px bg-border-subtle rounded-xl overflow-hidden border border-border-subtle">
          ${["日", "月", "火", "水", "木", "金", "土"].map((w) => `<div class="bg-surface-container-low p-2 text-center text-xs font-bold text-secondary">${w}</div>`).join("")}
          ${cells}
        </div>
        <div class="flex flex-wrap gap-md mt-md pt-md border-t border-border-subtle text-xs text-secondary">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-status-safe"></span>収入</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-outline-variant"></span>固定費</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-status-caution"></span>引落警告</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-status-danger"></span>危険日</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-primary"></span>追加稼働推奨</span>
        </div>
      </div>`;
  }

  /** Top 3 Actions */
  function renderTopActions(data) {
    const actions = data.brief.priorityActions.slice(0, 3);
    const icons = { income: "payments", subscription: "subscriptions", tax: "account_balance", reserve: "savings", collection: "receipt_long" };
    const colors = ["border-status-caution", "border-primary", "border-status-safe"];

    const items = actions
      .map((a, i) => {
        const border = colors[i] || "border-border-subtle";
        return `
        <div class="group p-md border border-border-subtle rounded-xl hover:${border} hover:bg-surface-container-low transition-all cursor-pointer border-l-4 ${border}">
          <div class="flex items-start gap-md">
            <div class="w-8 h-8 bg-surface-container rounded-lg flex items-center justify-center shrink-0 font-bold text-xs text-primary">${a.priority}</div>
            <div class="flex-1">
              <p class="text-sm font-bold text-primary">${a.title}</p>
              <p class="text-xs text-secondary mt-1">${a.templateReason}</p>
              ${a.impactYen > 0 ? `<p class="text-xs font-bold text-primary mt-1">${formatYen(a.impactYen)}</p>` : ""}
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-primary text-sm">chevron_right</span>
          </div>
        </div>`;
      })
      .join("");

    return `
      <div data-acc="top-actions">
        <h3 class="font-headline-md text-headline-md text-primary mb-lg font-bold">Top 3 Actions</h3>
        <div class="space-y-md">${items || "<p class=\"text-secondary text-sm\">推奨アクションはありません</p>"}</div>
      </div>`;
  }

  /** OptimizationSummaryPanel */
  function renderOptimizationPanel(data) {
    const opt = data.brief.subscriptionOptimization;
    const candidates = opt.candidates.slice(0, 3);

    const list = candidates
      .map(
        (c) => `
      <div class="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
        <div>
          <p class="font-bold text-primary text-sm">${c.name}</p>
          <p class="text-xs text-secondary">${c.reason}</p>
        </div>
        <span class="text-status-safe font-bold text-sm">${formatYen(c.yearlySaving)}/年</span>
      </div>`,
      )
      .join("");

    return `
      <section class="rounded-xl bg-surface-white border-2 border-status-caution/30 card-shadow p-lg mb-lg" data-acc="optimization-panel">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-md mb-md">
          <div>
            <h3 class="font-headline-md text-primary font-bold">改善余地</h3>
            <p class="text-sm text-secondary">finance-core による削減候補ランキング</p>
          </div>
          <div class="flex gap-lg">
            <div class="text-center">
              <p class="text-label-md text-secondary uppercase text-[10px]">推定削減額</p>
              <p class="text-xl font-bold text-status-caution">${formatYen(opt.monthlySavingPotential)}/月</p>
            </div>
            <div class="text-center">
              <p class="text-label-md text-secondary uppercase text-[10px]">年間改善額</p>
              <p class="text-xl font-bold text-status-safe">${formatYen(opt.yearlySavingPotential)}</p>
            </div>
          </div>
        </div>
        <div class="bg-surface-container-low rounded-lg p-md">
          <p class="text-label-md text-secondary uppercase text-[10px] mb-2">解約候補</p>
          ${list || "<p class=\"text-sm text-secondary\">候補なし</p>"}
        </div>
      </section>`;
  }

  /** FleetMetric Pro — compact sync card (Dashboard) */
  function renderFleetMetricSyncCompact(data) {
    const fm = data.fleetMetric || FALLBACK_DASHBOARD.fleetMetric;
    if (!fm) return renderFleetMetricBadge(data);
    const statusLabel =
      fm.status === "normal" ? "正常" : fm.status === "stale" ? "要再同期" : "未同期";
    const statusColor = fm.status === "normal" ? "text-status-safe" : "text-status-caution";
    const methodLabel = fm.syncMethod || "CSV";
    return `
      <section class="rounded-xl bg-surface-white border border-border-subtle p-md mb-md card-shadow" data-acc="fleetmetric-sync-compact">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h4 class="text-sm font-bold text-primary flex items-center gap-1">
            <span class="material-symbols-outlined text-base">sync</span>FleetMetric Pro連携
          </h4>
          <span class="text-xs font-bold ${statusColor}">${statusLabel}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div><p class="text-secondary">最終同期</p><p class="font-bold text-primary acc-break-words">${formatDateTimeJa(fm.lastSync)}</p></div>
          <div><p class="text-secondary">同期売上</p><p class="font-bold text-primary">${formatYen(fm.monthlyRevenueSynced || data.kpis.projectedIncome)}</p></div>
          <div><p class="text-secondary">同期方式</p><p class="font-bold text-primary">${methodLabel}</p></div>
          <div><p class="text-secondary">件数</p><p class="font-bold text-primary">${fm.syncCount}件</p></div>
        </div>
      </section>`;
  }

  /** FleetMetric Pro revenue source badge */
  function renderFleetMetricBadge(data) {
    const fm = data.fleetMetric;
    if (!fm) return "";
    const statusLabel =
      fm.status === "normal" ? "正常" : fm.status === "stale" ? "要再同期" : "未同期";
    const statusColor =
      fm.status === "normal" ? "text-status-safe bg-status-safe/10" : "text-status-caution bg-status-caution/10";
    const methodLabel = fm.syncMethod || "CSV";
    return `
      <div class="inline-flex flex-wrap items-center gap-2 text-xs" data-acc="fleetmetric-badge">
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/5 text-primary font-bold">
          <span class="material-symbols-outlined text-sm">sync</span>FleetMetric Pro連携
        </span>
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full ${statusColor} font-bold">${statusLabel}</span>
        <span class="text-secondary acc-break-words">最終同期: ${formatDateTimeJa(fm.lastSync)} · 同期方式: ${methodLabel}</span>
      </div>`;
  }

  /** Import screen — FleetMetric Pro sync status (replaces Premium promo) */
  function renderFleetMetricSyncPanel(data, result) {
    const fm = data.fleetMetric || FALLBACK_DASHBOARD.fleetMetric;
    const statusLabel =
      fm.status === "normal" ? "正常" : fm.status === "stale" ? "要再同期" : "未同期";
    const statusColor = fm.status === "normal" ? "text-status-safe" : "text-status-caution";
    const methodLabel = fm.syncMethod || "CSV";
    return `
      <section class="fin-card rounded-xl p-lg mb-lg border-l-4 border-primary" data-acc="fleetmetric-sync-panel">
        <div class="flex flex-wrap items-start justify-between gap-md mb-md">
          <div>
            <h3 class="font-body-md font-bold text-primary flex items-center gap-2">
              <span class="material-symbols-outlined">hub</span> FleetMetric Pro連携
            </h3>
            <p class="text-body-sm text-secondary mt-1 acc-break-words">売上の正本は FleetMetric Pro。支出・カード明細はこの画面から取り込み</p>
          </div>
          ${renderApiStatus(result)}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md text-sm">
          <div class="bg-surface-container-low rounded-lg p-md">
            <p class="text-[10px] text-secondary uppercase">最終同期</p>
            <p class="font-bold text-primary acc-break-words">${formatDateTimeJa(fm.lastSync)}</p>
          </div>
          <div class="bg-surface-container-low rounded-lg p-md">
            <p class="text-[10px] text-secondary uppercase">同期売上</p>
            <p class="font-bold text-primary">${formatYen(fm.monthlyRevenueSynced || data.kpis.projectedIncome)}</p>
          </div>
          <div class="bg-surface-container-low rounded-lg p-md">
            <p class="text-[10px] text-secondary uppercase">状態</p>
            <p class="font-bold ${statusColor}">${statusLabel}</p>
          </div>
          <div class="bg-surface-container-low rounded-lg p-md">
            <p class="text-[10px] text-secondary uppercase">同期方式</p>
            <p class="font-bold text-primary">${methodLabel}</p>
          </div>
        </div>
        <p class="text-xs text-secondary mt-md acc-break-words">同期売上 ${fm.syncCount}件 · Phase 1: CSV / Phase 2: JSON / Phase 3: Cloudflare Sync</p>
      </section>`;
  }

  /** SAFE — offensive proposals (surplus, invest, tax, AI dev budget) */
  function renderOffensiveProposals(data, compact) {
    const s = data.surplus || {};
    const m = data.metrics;
    if (m.status !== "SAFE") return "";

    if (compact) {
      return `
      <section class="rounded-xl bg-status-safe/5 border border-status-safe/30 p-4 mb-3 card-shadow" data-acc="offensive-proposals">
        <p class="text-xs font-bold text-status-safe mb-1">攻めの提案</p>
        <p class="text-sm text-primary acc-break-words">余剰 ${formatYen(s.amount || 0)} · 税金 ${formatYen(s.taxReserveSuggested || 0)} · AI開発 ${formatYen(s.aiDevBudgetSuggested || 0)}</p>
      </section>`;
    }

    const cards = [
      { icon: "savings", label: "余剰資金", value: formatYen(s.amount || 0), hint: "安全圏を超えた可処分額" },
      { icon: "trending_up", label: "投資候補", value: formatYen(s.investmentCandidate || 0), hint: "低リスク積立・設備更新" },
      { icon: "account_balance", label: "税金積立提案", value: formatYen(s.taxReserveSuggested || 0), hint: "今月収入の10%を納税準備口座へ" },
      { icon: "code", label: "AI開発予算提案", value: formatYen(s.aiDevBudgetSuggested || 0), hint: "余剰からツール・API予算を拡大" },
    ];

    return `
      <section class="rounded-xl bg-status-safe/5 border border-status-safe/30 p-lg mb-md card-shadow" data-acc="offensive-proposals">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-md">
          <div>
            <h3 class="font-headline-md text-primary font-bold flex items-center gap-2">
              <span class="material-symbols-outlined text-status-safe">rocket_launch</span>
              攻めの提案 — 今月は問題ありません
            </h3>
            <p class="text-sm text-secondary acc-break-words">FleetMetric Pro の売上ペースは健全。余剰を次のアクションに回せます。</p>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-md">
          ${cards
            .map(
              (c) => `
            <div class="bg-surface-white rounded-xl p-md border border-border-subtle">
              <span class="material-symbols-outlined text-status-safe text-xl">${c.icon}</span>
              <p class="text-[10px] text-secondary uppercase mt-2">${c.label}</p>
              <p class="text-xl font-bold text-primary">${c.value}</p>
              <p class="text-xs text-secondary mt-1 acc-break-words">${c.hint}</p>
            </div>`,
            )
            .join("")}
        </div>
      </section>`;
  }

  /** CAUTION / DANGER — Gap to Safety priority panel */
  function renderGapPriorityPanel(data) {
    const m = data.metrics;
    const b = data.brief;
    const fm = data.fleetMetric || {};
    if (m.status === "SAFE") return "";

    const s = statusStyle(m.status);
    const nextPay = b.nextBigPayment;
    const workDays = b.gapWorkDays || fm.recommendedWorkDays || 0;

    return `
      <section class="rounded-xl ${s.bg} border-2 ${s.border} p-lg mb-md card-shadow" data-acc="gap-priority">
        <div class="flex items-center gap-2 mb-md">
          <span class="material-symbols-outlined ${s.text} text-2xl">crisis_alert</span>
          <h3 class="font-headline-md font-bold text-primary">Gap to Safety — 最優先</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-md">
          <div class="bg-surface-white rounded-xl p-md border-l-4 ${s.border}">
            <p class="text-[10px] text-secondary uppercase">あといくら必要か</p>
            <p class="text-3xl font-bold ${s.text}">${formatYen(m.gapToSafety)}</p>
            <p class="text-xs text-secondary mt-1 acc-break-words">${b.gapMessage}</p>
          </div>
          <div class="bg-surface-white rounded-xl p-md border-l-4 border-primary">
            <p class="text-[10px] text-secondary uppercase">あと何日稼働が必要か</p>
            <p class="text-3xl font-bold text-primary">${workDays}<span class="text-lg">日</span></p>
            <p class="text-xs text-secondary mt-1 acc-break-words">FleetMetric Pro での追加稼働目安 — ${b.workDaysMessage}</p>
          </div>
          <div class="bg-surface-white rounded-xl p-md border-l-4 border-status-caution">
            <p class="text-[10px] text-secondary uppercase">次の大型支払いまで</p>
            <p class="text-3xl font-bold text-primary">${nextPay ? nextPay.daysUntil + "日" : "—"}</p>
            <p class="text-xs text-secondary mt-1 acc-break-words">${nextPay ? nextPay.name + " " + formatYen(nextPay.amount) : "大型支払いなし"}</p>
          </div>
        </div>
      </section>`;
  }

  /** AI Insights — future simulation with Before/After */
  function renderSimulationMetric(label, before, after, suffix) {
    const delta = after - before;
    const deltaClass = delta >= 0 ? "text-status-safe" : "text-status-caution";
    const deltaSign = delta >= 0 ? "+" : "";
    const fmt = suffix === "yen" ? (v) => formatYen(v) : (v) => v + (suffix || "");
    return `
      <div class="bg-surface-container-low rounded-lg p-3">
        <p class="text-[10px] text-secondary uppercase mb-1">${label}</p>
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="text-secondary line-through text-sm">${fmt(before)}</span>
          <span class="material-symbols-outlined text-secondary text-sm">arrow_forward</span>
          <span class="font-bold text-primary">${fmt(after)}</span>
          <span class="text-xs font-bold ${deltaClass}">${deltaSign}${suffix === "yen" ? formatYen(delta) : delta + (suffix || "")}</span>
        </div>
      </div>`;
  }

  function renderSimulationPanel(data) {
    const sims = data.simulations || FALLBACK_DASHBOARD.simulations;
    const m = data.metrics;

    const cards = sims
      .map((sim) => {
        const b = sim.before || {};
        const a = sim.after || {};
        const hasMetrics = b.safety != null && a.safety != null;
        return `
      <article class="bg-surface-white rounded-xl border border-border-subtle p-lg card-shadow hover:border-primary/30 transition-colors flex flex-col">
        <p class="text-[10px] text-secondary uppercase mb-1">Scenario Summary</p>
        <h3 class="font-bold text-primary mb-2 acc-break-words">${sim.title}</h3>
        <p class="text-sm text-secondary mb-md acc-break-words">${sim.summary || "finance-core による What-if 試算"}</p>
        ${hasMetrics ? `
        <div class="grid grid-cols-1 gap-2 mb-md">
          ${renderSimulationMetric("Safety Score", b.safety, a.safety, "")}
          ${renderSimulationMetric("Runway", b.runway, a.runway, "日")}
          ${renderSimulationMetric("余剰資金", b.surplus || 0, a.surplus || 0, "yen")}
          ${sim.incomeDelta ? `<div class="bg-primary/5 rounded-lg p-3 text-xs acc-break-words"><span class="font-bold text-primary">FleetMetric Pro 追加稼働:</span> 収入改善 ${formatYen(sim.incomeDelta)}</div>` : ""}
        </div>` : `
        <ul class="space-y-2 mb-md">
          ${(sim.impacts || []).map((i) => `<li class="flex items-start gap-2 text-sm"><span class="material-symbols-outlined text-status-safe text-base shrink-0">arrow_forward</span><span class="acc-break-words">${i}</span></li>`).join("")}
        </ul>`}
        <button class="mt-auto text-sm font-bold text-primary flex items-center gap-1 tap-scale">詳細シミュレーション <span class="material-symbols-outlined text-sm">chevron_right</span></button>
      </article>`;
      })
      .join("");

    return `
      <div data-acc="simulation-panel">
        <header class="mb-lg">
          <p class="text-label-md text-secondary uppercase mb-1">What-if Simulation</p>
          <h2 class="font-headline-lg text-headline-lg text-primary font-bold">未来のシミュレーション</h2>
          <p class="text-secondary text-sm mt-2 acc-break-words">Before / After 比較 — 現状 ${m.status} ${m.score}/100 · Runway ${m.runwayDays}日</p>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">${cards}</div>
        <p class="text-[10px] text-secondary mt-lg text-center italic">計算: finance-core (Layer 1) — FleetMetric Pro 稼働シミュレーション含む</p>
      </div>`;
  }

  /** Dashboard content orchestrator */
  function renderDashboardContent(data, compact) {
    const hero = renderSafetyHero(data, compact);
    const statusPanel =
      data.metrics.status === "SAFE" ? renderOffensiveProposals(data, compact) : renderGapPriorityPanel(data);
    const gapOrBanner =
      data.metrics.status === "SAFE" ? "" : renderGapBanner(data);
    const fmPanel = compact
      ? renderFleetMetricSyncCompact(data)
      : renderFleetMetricSyncCompact(data);

    const core = compact
      ? hero + gapOrBanner + statusPanel + renderCommanderBrief(data) + renderSecondaryKpis(data, true)
      : hero + statusPanel + gapOrBanner + renderCommanderBrief(data) + renderSecondaryKpis(data, false);

    return (
      fmPanel +
      core +
      (compact
        ? `<section class="bg-surface-white p-4 rounded-xl shadow-sm mb-4">${renderTopActions(data)}</section>`
        : `<div class="grid grid-cols-1 lg:grid-cols-3 gap-xl mt-md">
            <div class="lg:col-span-2 bg-surface-white rounded-xl card-shadow p-lg">${renderActionCalendar(data, "2026-06-15")}</div>
            <div class="bg-surface-white rounded-xl card-shadow p-lg flex flex-col">${renderTopActions(data)}</div>
          </div>`)
    );
  }

  function initResponsiveShell() {
    const sidebar = document.getElementById("acc-sidebar");
    const toggle = document.getElementById("acc-menu-toggle");
    const backdrop = document.getElementById("acc-sidebar-backdrop");
    if (!sidebar || !toggle) return;

    function close() {
      sidebar.classList.remove("is-open");
      backdrop?.classList.add("hidden");
    }
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("is-open");
      backdrop?.classList.toggle("hidden");
    });
    backdrop?.addEventListener("click", close);
    window.addEventListener("resize", () => {
      if (window.innerWidth > 767) close();
    });
  }

  /** AI Insights — Decision Brief (legacy, prefer renderSimulationPanel) */
  function renderDecisionBrief(data) {
    const b = data.brief;
    const m = data.metrics;
    const s = statusStyle(m.status);
    const primary = b.priorityActions[0];

    return `
      <section class="rounded-xl bg-primary text-white p-lg mb-lg card-shadow" data-acc="decision-brief">
        <div class="flex items-start gap-md">
          <span class="material-symbols-outlined text-3xl text-secondary-fixed">psychology</span>
          <div>
            <p class="text-xs uppercase tracking-widest opacity-70 mb-1">Decision Brief</p>
            <h2 class="text-2xl font-bold mb-2">今月の最優先: ${primary ? primary.title : b.primaryAction.title}</h2>
            <p class="text-sm opacity-90">${data.copy.adviceText}</p>
            <div class="flex gap-4 mt-4 text-sm">
              <span class="${s.bg} ${s.text} px-3 py-1 rounded-full font-bold">${m.status} ${m.score}/100</span>
              <span class="bg-white/10 px-3 py-1 rounded-full">Runway ${m.runwayDays}日</span>
              <span class="bg-white/10 px-3 py-1 rounded-full">${b.gapMessage}</span>
            </div>
          </div>
        </div>
      </section>`;
  }

  /** AIActionPriorityList */
  function renderActionPriorityList(data) {
    const actions = data.brief.priorityActions.slice(0, 3);
    const copyActions = data.copy.priorityActionsText || [];

    const items = actions
      .map((a, i) => {
        const label = copyActions[i] && copyActions[i] !== "—" ? copyActions[i] : a.title;
        return `
        <div class="flex items-start gap-md p-md bg-surface-white rounded-xl border border-border-subtle shadow-sm">
          <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shrink-0">${a.priority}</div>
          <div class="flex-1">
            <p class="text-label-md text-secondary uppercase text-[10px]">優先順位 ${a.priority}</p>
            <p class="font-bold text-primary">${label}</p>
            <p class="text-xs text-secondary mt-1">${a.templateReason}</p>
          </div>
          <span class="font-bold text-primary text-sm">${a.impactYen > 0 ? formatYen(a.impactYen) : ""}</span>
        </div>`;
      })
      .join("");

    return `
      <section class="mt-lg pt-lg border-t-2 border-primary" data-acc="priority-list">
        <h3 class="font-headline-md text-primary font-bold mb-md flex items-center gap-2">
          <span class="material-symbols-outlined text-status-caution">bolt</span>
          AI推奨アクション
        </h3>
        <div class="space-y-md">${items}</div>
        <p class="text-[10px] text-secondary mt-3 text-center italic">計算: finance-core (Layer 1+2) — LLMは文案整形のみ（AI_POLISH_ENABLED=false でも表示可能）</p>
      </section>`;
  }

  /** API status badge for import screen */
  function renderApiStatus(result) {
    if (result.ok) {
      return `<span class="inline-flex items-center gap-1 text-status-safe text-xs font-bold bg-status-safe/10 px-2 py-1 rounded-full">
        <span class="w-2 h-2 rounded-full bg-status-safe animate-pulse"></span>API接続済 (${result.source})
      </span>`;
    }
    return `<span class="inline-flex items-center gap-1 text-status-caution text-xs font-bold bg-status-caution/10 px-2 py-1 rounded-full">
      <span class="w-2 h-2 rounded-full bg-status-caution"></span>オフライン — 埋込データ表示
    </span>`;
  }

  function renderSidebarStatus(data) {
    const m = data.metrics;
    const s = statusStyle(m.status);
    return `<div class="px-2 mb-4" data-acc="sidebar-status">
      <div class="text-label-md text-secondary mb-1 uppercase text-[10px]">Safety Status</div>
      <span class="inline-flex items-center gap-1 ${s.text} font-bold text-sm">${m.status}</span>
      <div class="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
        <div class="${s.bar} h-full rounded-full" style="width:${m.score}%"></div>
      </div>
      <p class="text-[10px] text-secondary mt-1">${m.score}/100 · Runway ${m.runwayDays}日</p>
    </div>`;
  }

  function bindTapScale() {
    document.querySelectorAll(".tap-scale").forEach((el) => {
      el.addEventListener("mousedown", () => { el.style.transform = "scale(0.97)"; });
      el.addEventListener("mouseup", () => { el.style.transform = "scale(1)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
    });
  }

  /** Embedded fallback — mirrors finance-core sample output when API offline */
  const FALLBACK_DASHBOARD = {
    metrics: {
      status: "SAFE",
      score: 100,
      gapToSafety: 0,
      runwayDays: 112,
      safeUntilDate: "2026-10-05",
      projectedBalanceAfterPayments: 1429220,
      monthlyBurnRate: 380000,
    },
    brief: {
      status: "SAFE",
      score: 100,
      gapToSafety: 0,
      gapWorkDays: 0,
      runwayDays: 112,
      safeUntilDate: "2026-10-05",
      gapMessage: "今のペースなら問題ありません",
      workDaysMessage: "追加稼働は不要です",
      primaryAction: {
        priority: 1,
        id: "tax-reserve",
        title: "税金積立 ¥125,000 を開始",
        impactYen: 125000,
        category: "tax",
        templateReason: "今月収入の10%を納税準備口座へ",
      },
      priorityActions: [
        {
          priority: 1,
          id: "tax-reserve",
          title: "税金積立 ¥125,000 を開始",
          impactYen: 125000,
          category: "tax",
          templateReason: "今月収入の10%を納税準備口座へ",
        },
        {
          priority: 2,
          id: "ai-dev-budget",
          title: "AI開発予算 ¥50,000 を確保",
          impactYen: 50000,
          category: "reserve",
          templateReason: "余剰からツール・API予算を拡大",
        },
        {
          priority: 3,
          id: "cancel-sub-dropbox",
          title: "Dropbox Professional を解約（年間 ¥23,760 削減）",
          impactYen: 23760,
          category: "subscription",
          templateReason: "過去90日間の利用実績がありません（最終利用: 120日前）",
        },
      ],
      subscriptionOptimization: {
        monthlySavingPotential: 4480,
        yearlySavingPotential: 48960,
        candidates: [
          { subscriptionId: "sub-dropbox", name: "Dropbox Professional", monthlyCost: 1980, yearlySaving: 23760, reason: "過去90日間の利用実績がありません（最終利用: 120日前）", priority: 1 },
          { subscriptionId: "sub-zoom", name: "Zoom Pro", monthlyCost: 2100, yearlySaving: 25200, reason: "利用頻度が低いです（利用率 24%）。Google Meetで代替可能", priority: 2 },
        ],
        duplicateCategories: ["design"],
        keepRecommendations: [
          { name: "Adobe Creative Cloud", reason: "FleetMetric Pro / AI開発 / 動画制作に使用。利用率高・代替コスト高" },
        ],
      },
      calendarMarkers: [
        { date: "2026-06-17", type: "work_recommended", label: "休息日推奨 — 十分稼働済" },
        { date: "2026-06-20", type: "bill", label: "オフィス家賃 ¥88,000", countdownDays: 5, amount: 88000 },
        { date: "2026-06-25", type: "bill", label: "ビジネスカード引落 ¥125,000", countdownDays: 10, amount: 125000 },
        { date: "2026-06-27", type: "bill", label: "Adobe CC ¥7,780", countdownDays: 12, amount: 7780 },
      ],
      paymentWarnings: [],
      nextBigPayment: { name: "ビジネスカード引落", daysUntil: 10, amount: 125000 },
    },
    kpis: {
      projectedIncome: 1250000,
      confirmedExpenses: 420000,
      projectedBalance: 1429220,
    },
    fleetMetric: {
      lastSync: "2026-06-15T22:34:00",
      syncCount: 12,
      status: "normal",
      syncMethod: "CSV",
      monthlyRevenueSynced: 1250000,
      recommendedWorkDays: 0,
    },
    surplus: {
      amount: 320000,
      investmentCandidate: 150000,
      taxReserveSuggested: 125000,
      aiDevBudgetSuggested: 50000,
    },
    simulations: [
      {
        id: "cancel-dropbox",
        title: "Dropbox Professional を解約した場合",
        summary: "未使用ストレージの解約で経費を圧縮",
        before: { safety: 100, runway: 112, surplus: 320000 },
        after: { safety: 100, runway: 118, surplus: 343760 },
        impacts: ["年間改善: ¥23,760", "Runway: 112日 → 118日"],
      },
      {
        id: "work-2days",
        title: "あと2日稼働した場合（FleetMetric Pro）",
        summary: "FleetMetric Pro で追加稼働した場合の収入改善",
        before: { safety: 100, runway: 112, surplus: 320000 },
        after: { safety: 100, runway: 125, surplus: 332000 },
        incomeDelta: 12000,
        impacts: ["Runway: 112日 → 125日", "余剰資金: +¥12,000"],
      },
      {
        id: "tax-10pct",
        title: "税金積立を月10%に変更した場合",
        summary: "納税準備を強化し年末不足リスクを低減",
        before: { safety: 100, runway: 112, surplus: 320000 },
        after: { safety: 98, runway: 108, surplus: 195000 },
        impacts: ["年末不足リスク: -35%", "Runway: 112日 → 108日"],
      },
    ],
    copy: {
      adviceText: "今月は安全圏です。余剰資金 ¥320,000 のうち ¥125,000 を税金積立、¥50,000 をAI開発予算に回せます。",
      priorityActionsText: [
        "税金積立 ¥125,000 を開始",
        "AI開発予算 ¥50,000 を確保",
        "Dropbox Professional を解約（年間 ¥23,760 削減）",
      ],
      subscriptionComment: "Dropbox Professional 解約で年間 ¥23,760 削減可能。Adobe CC は維持推奨",
      usedFallback: true,
    },
  };

  const CAUTION_FALLBACK = {
    metrics: {
      status: "CAUTION",
      score: 82,
      gapToSafety: 18000,
      runwayDays: 34,
      safeUntilDate: "2026-07-19",
      projectedBalanceAfterPayments: 882000,
      monthlyBurnRate: 380000,
    },
    brief: {
      status: "CAUTION",
      score: 82,
      gapToSafety: 18000,
      gapWorkDays: 3,
      runwayDays: 34,
      safeUntilDate: "2026-07-19",
      gapMessage: "あと ¥18,000 で安全圏です",
      workDaysMessage: "あと 3 日の追加稼働を推奨します",
      primaryAction: {
        priority: 1,
        id: "close-gap",
        title: "追加収入 ¥18,000 を確保",
        impactYen: 18000,
        category: "income",
        templateReason: "FleetMetric Pro であと2日稼働すれば安全圏に到達",
      },
      priorityActions: [
        {
          priority: 1,
          id: "close-gap",
          title: "追加収入 ¥18,000 を確保",
          impactYen: 18000,
          category: "income",
          templateReason: "FleetMetric Pro であと2日稼働すれば安全圏",
        },
        {
          priority: 2,
          id: "cancel-sub-dropbox",
          title: "Dropbox Professional を解約（年間 ¥23,760 削減）",
          impactYen: 23760,
          category: "subscription",
          templateReason: "過去90日間の利用実績なし",
        },
        {
          priority: 3,
          id: "tax-reserve",
          title: "税金積立 ¥125,000 を開始",
          impactYen: 125000,
          category: "tax",
          templateReason: "今月収入の10%を納税準備口座へ",
        },
      ],
      subscriptionOptimization: {
        monthlySavingPotential: 4480,
        yearlySavingPotential: 48960,
        candidates: [
          { subscriptionId: "sub-dropbox", name: "Dropbox Professional", monthlyCost: 1980, yearlySaving: 23760, reason: "過去90日間の利用実績なし", priority: 1 },
          { subscriptionId: "sub-zoom", name: "Zoom Pro", monthlyCost: 2100, yearlySaving: 25200, reason: "Google Meetで代替可能", priority: 2 },
        ],
        duplicateCategories: ["design"],
        keepRecommendations: [{ name: "Adobe Creative Cloud", reason: "FleetMetric Pro / AI開発 / 動画制作に使用" }],
      },
      calendarMarkers: [
        { date: "2026-06-17", type: "work_recommended", label: "FleetMetric: 追加稼働推奨" },
        { date: "2026-06-20", type: "withdrawal_warning", label: "家賃 引落まで3日", countdownDays: 3, amount: 88000 },
        { date: "2026-06-25", type: "bill", label: "カード引落 ¥125,000", countdownDays: 10, amount: 125000 },
      ],
      paymentWarnings: [{ name: "オフィス家賃", dueDate: "2026-06-20", daysUntil: 3, amount: 88000 }],
      nextBigPayment: { name: "ビジネスカード引落", daysUntil: 10, amount: 125000 },
    },
    kpis: { projectedIncome: 1250000, confirmedExpenses: 420000, projectedBalance: 882000 },
    fleetMetric: {
      lastSync: "2026-06-14T09:12:00",
      syncCount: 10,
      status: "stale",
      syncMethod: "CSV",
      monthlyRevenueSynced: 1250000,
      recommendedWorkDays: 2,
    },
    surplus: { amount: 0, investmentCandidate: 0, taxReserveSuggested: 125000, aiDevBudgetSuggested: 0 },
    simulations: [
      {
        id: "cancel-dropbox",
        title: "Dropbox Professional を解約した場合",
        summary: "未使用サブスク解約でキャッシュを確保",
        before: { safety: 82, runway: 34, surplus: 0 },
        after: { safety: 85, runway: 40, surplus: 23760 },
        impacts: ["年間改善: ¥23,760", "Runway: 34日 → 40日"],
      },
      {
        id: "work-2days",
        title: "あと2日稼働した場合（FleetMetric Pro）",
        summary: "FleetMetric Pro で追加稼働した場合",
        before: { safety: 82, runway: 34, surplus: 0 },
        after: { safety: 91, runway: 51, surplus: 48000 },
        incomeDelta: 48000,
        impacts: ["Safety: 82 → 91", "Runway: 34日 → 51日", "余剰資金: +¥48,000"],
      },
      {
        id: "tax-10pct",
        title: "税金積立を月10%に変更した場合",
        summary: "納税準備強化 vs Runway trade-off",
        before: { safety: 82, runway: 34, surplus: 0 },
        after: { safety: 80, runway: 31, surplus: -125000 },
        impacts: ["年末不足リスク: -35%", "Runway: 34日 → 31日"],
      },
    ],
    copy: {
      adviceText: "あと ¥18,000 で安全圏。FleetMetric Pro であと3日稼働を推奨。",
      priorityActionsText: ["追加収入 ¥18,000 を確保", "Dropbox 解約で年間 ¥23,760 削減", "税金積立 ¥125,000 開始"],
      subscriptionComment: "Dropbox 解約で年間 ¥23,760 削減可能",
      usedFallback: true,
    },
  };

  const DANGER_FALLBACK = {
    metrics: {
      status: "DANGER",
      score: 48,
      gapToSafety: 72000,
      runwayDays: 12,
      safeUntilDate: "2026-06-27",
      projectedBalanceAfterPayments: 180000,
      monthlyBurnRate: 380000,
    },
    brief: {
      status: "DANGER",
      score: 48,
      gapToSafety: 72000,
      gapWorkDays: 8,
      runwayDays: 12,
      safeUntilDate: "2026-06-27",
      gapMessage: "あと ¥72,000 で安全圏です",
      workDaysMessage: "FleetMetric Pro であと8日稼働、または支出削減が必要",
      primaryAction: {
        priority: 1,
        id: "urgent-gap",
        title: "25日のカード引落前に ¥72,000 を確保",
        impactYen: 72000,
        category: "income",
        templateReason: "ビジネスカード引落 ¥125,000 の前に追加収入または支出削減が必要",
      },
      priorityActions: [
        {
          priority: 1,
          id: "urgent-gap",
          title: "25日のカード引落前に ¥72,000 を確保",
          impactYen: 72000,
          category: "income",
          templateReason: "追加収入または Dropbox/Zoom 解約で即効",
        },
        {
          priority: 2,
          id: "cancel-sub-dropbox",
          title: "Dropbox Professional を即時解約（年間 ¥23,760 削減）",
          impactYen: 23760,
          category: "subscription",
          templateReason: "過去90日間の利用実績なし",
        },
        {
          priority: 3,
          id: "defer-expense",
          title: "大型支出 ¥125,000 を延期交渉",
          impactYen: 125000,
          category: "collection",
          templateReason: "カード引落まで10日 — 分割または延期を検討",
        },
      ],
      subscriptionOptimization: CAUTION_FALLBACK.brief.subscriptionOptimization,
      calendarMarkers: [
        { date: "2026-06-17", type: "work_recommended", label: "FleetMetric: 緊急稼働推奨" },
        { date: "2026-06-20", type: "withdrawal_warning", label: "家賃 引落まで3日", countdownDays: 3, amount: 88000 },
        { date: "2026-06-25", type: "danger", label: "カード引落 ¥125,000", countdownDays: 10, amount: 125000 },
      ],
      paymentWarnings: [{ name: "ビジネスカード引落", dueDate: "2026-06-25", daysUntil: 10, amount: 125000 }],
      nextBigPayment: { name: "ビジネスカード引落", daysUntil: 10, amount: 125000 },
    },
    kpis: { projectedIncome: 980000, confirmedExpenses: 520000, projectedBalance: 180000 },
    fleetMetric: {
      lastSync: "2026-06-12T08:00:00",
      syncCount: 8,
      status: "stale",
      syncMethod: "CSV",
      monthlyRevenueSynced: 980000,
      recommendedWorkDays: 8,
    },
    surplus: { amount: 0, investmentCandidate: 0, taxReserveSuggested: 98000, aiDevBudgetSuggested: 0 },
    simulations: [
      {
        id: "work-8days",
        title: "あと8日稼働した場合（FleetMetric Pro）",
        summary: "緊急稼働で Gap を解消",
        before: { safety: 48, runway: 12, surplus: 0 },
        after: { safety: 78, runway: 38, surplus: 72000 },
        incomeDelta: 72000,
        impacts: ["Safety: 48 → 78", "Runway: 12日 → 38日", "Gap: ¥72,000 → ¥0"],
      },
      {
        id: "cancel-dropbox",
        title: "Dropbox + Zoom を解約した場合",
        summary: "即効性のある支出削減",
        before: { safety: 48, runway: 12, surplus: 0 },
        after: { safety: 52, runway: 15, surplus: 48960 },
        impacts: ["年間改善: ¥48,960", "Runway: 12日 → 15日"],
      },
      {
        id: "defer-card",
        title: "カード引落を1週間延期した場合",
        summary: "キャッシュタイミングの調整",
        before: { safety: 48, runway: 12, surplus: 0 },
        after: { safety: 55, runway: 19, surplus: 0 },
        impacts: ["Runway: 12日 → 19日", "25日引落リスク: 猶予7日"],
      },
    ],
    copy: {
      adviceText: "25日のカード引落前に ¥72,000 が必要。FleetMetric Pro で追加稼働、または Dropbox/Zoom 解約を即検討。",
      priorityActionsText: ["¥72,000 を10日以内に確保", "Dropbox 即時解約", "カード引落の延期交渉"],
      subscriptionComment: "緊急: Dropbox + Zoom 解約で年間 ¥48,960 削減",
      usedFallback: true,
    },
  };

  global.AccApi = {
    API_BASE,
    fetchDashboard,
    fetchCsvPreview,
    formatYen,
    formatDateJa,
    formatDateTimeJa,
    renderSafetyHero,
    renderGapBanner,
    renderGapPriorityPanel,
    renderOffensiveProposals,
    renderCommanderBrief,
    renderSecondaryKpis,
    renderActionCalendar,
    renderTopActions,
    renderOptimizationPanel,
    renderDecisionBrief,
    renderSimulationPanel,
    renderDashboardContent,
    renderActionPriorityList,
    renderApiStatus,
    renderFleetMetricBadge,
    renderFleetMetricSyncPanel,
    renderFleetMetricSyncCompact,
    renderSidebarStatus,
    statusStyle,
    bindTapScale,
    initResponsiveShell,
    FALLBACK_DASHBOARD,
    CAUTION_FALLBACK,
    DANGER_FALLBACK,
    resolveScenarioData,
    renderCompactCharts,
    renderImportApiPanel,
  };

  function renderCompactCharts() {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg my-lg" data-acc="compact-charts">
        <div class="bg-surface-white rounded-xl shadow-sm p-lg h-48 flex items-end justify-between gap-2">
          <div class="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <div class="bg-primary w-full rounded-t h-[70%] opacity-90"></div>
            <span class="text-[10px] text-secondary">4月</span>
          </div>
          <div class="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <div class="bg-primary w-full rounded-t h-[85%] opacity-90"></div>
            <span class="text-[10px] text-secondary">5月</span>
          </div>
          <div class="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <div class="bg-primary w-full rounded-t h-[60%] opacity-90"></div>
            <span class="text-[10px] text-secondary">6月</span>
          </div>
          <p class="absolute sr-only">売上・経費コンパクトチャート（参考）</p>
        </div>
        <div class="bg-surface-white rounded-xl shadow-sm p-lg h-48 flex items-center justify-center">
          <div class="text-center">
            <p class="text-label-md text-secondary uppercase text-[10px] mb-2">経費内訳（参考）</p>
            <p class="text-2xl font-bold text-primary">SaaS 25%</p>
            <p class="text-xs text-secondary">詳細計算は finance-core</p>
          </div>
        </div>
      </div>`;
  }

  function renderImportApiPanel(data, result, csvResult) {
    const m = data.metrics;
    const k = data.kpis;
    const s = statusStyle(m.status);
    return `
      <section class="fin-card rounded-xl p-lg mb-lg border-l-4 ${s.border}" data-acc="import-api-panel">
        <div class="flex flex-wrap items-start justify-between gap-md mb-md">
          <div>
            <h3 class="font-body-md font-bold text-primary flex items-center gap-2">
              <span class="material-symbols-outlined">hub</span> finance-core 連携ステータス
            </h3>
            <p class="text-body-sm text-secondary mt-1">Layer 1 計算エンジン — LLM不使用（AI_POLISH_ENABLED=false 対応）</p>
          </div>
          ${renderApiStatus(result)}
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-md text-sm">
          <div class="bg-surface-container-low rounded-lg p-md">
            <p class="text-[10px] text-secondary uppercase">Safety Status</p>
            <p class="font-bold ${s.text}">${m.status} ${m.score}/100</p>
          </div>
          <div class="bg-surface-container-low rounded-lg p-md">
            <p class="text-[10px] text-secondary uppercase">Runway</p>
            <p class="font-bold text-primary">${m.runwayDays}日</p>
          </div>
          <div class="bg-surface-container-low rounded-lg p-md">
            <p class="text-[10px] text-secondary uppercase">Gap to Safety</p>
            <p class="font-bold text-primary">${m.gapToSafety > 0 ? formatYen(m.gapToSafety) : "達成済"}</p>
          </div>
          <div class="bg-surface-container-low rounded-lg p-md">
            <p class="text-[10px] text-secondary uppercase">CSV解析</p>
            <p class="font-bold ${csvResult?.ok ? "text-status-safe" : "text-status-caution"}">${csvResult?.ok ? csvResult.data.rowCount + "件" : "API待機中"}</p>
          </div>
        </div>
        <p class="text-xs text-secondary mt-md">取り込み後ダッシュボード反映: 予測収入 ${formatYen(k.projectedIncome)} / 確定支出 ${formatYen(k.confirmedExpenses)}</p>
      </section>`;
  }
})(typeof window !== "undefined" ? window : globalThis);
