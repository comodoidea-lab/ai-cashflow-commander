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

  const PERIOD_SUFFIX = { monthly: "/月", yearly: "/年", balance: "" };
  const PERIOD_LABEL = { monthly: "今月", yearly: "年間", balance: "月末見込" };

  function formatMoneyWithPeriod(amount, period) {
    const p = period || "monthly";
    if (p === "balance") {
      return `${formatYen(amount)} <span class="text-xs font-normal text-secondary ml-1">月末見込</span>`;
    }
    return `${formatYen(amount)}${PERIOD_SUFFIX[p] || ""}`;
  }

  function formatAsOfMonth(data) {
    const m = data.asOfMonth || (data.brief?.safeUntilDate || "2026-06-15").slice(0, 7);
    const [y, mo] = m.split("-");
    return `${y}年${Number(mo)}月の見込み`;
  }

  function getSurplusFlowContext(data) {
    const k = data.kpis || {};
    const s = data.surplus || {};
    const m = data.metrics || {};
    const projectedIncome = k.projectedIncome || 0;
    const confirmedExpenses = k.confirmedExpenses || 0;
    const projectedBalance = k.projectedBalance || m.projectedBalanceAfterPayments || 0;
    const surplus = s.amount || 0;
    const safetyBufferTarget =
      data.safetyBufferTarget != null ? data.safetyBufferTarget : Math.max(0, projectedBalance - surplus);
    const monthlyNet = projectedIncome - confirmedExpenses;
    const taxReserveSuggested = s.taxReserveSuggested || 0;
    const taxPct = projectedIncome > 0 ? Math.round((taxReserveSuggested / projectedIncome) * 100) : 0;

    return {
      projectedIncome,
      confirmedExpenses,
      projectedBalance,
      surplus,
      safetyBufferTarget,
      monthlyNet,
      taxPct,
      taxReserveSuggested,
      investmentCandidate: s.investmentCandidate || 0,
      aiDevBudgetSuggested: s.aiDevBudgetSuggested || 0,
      allocTotal: (s.investmentCandidate || 0) + taxReserveSuggested + (s.aiDevBudgetSuggested || 0),
      isSafe: m.status === "SAFE" && surplus > 0,
      asOfLabel: formatAsOfMonth(data),
    };
  }

  function getBalanceStatusContext(data) {
    const flow = getSurplusFlowContext(data);
    const reserveGap = flow.projectedBalance - flow.safetyBufferTarget;
    const incomeExpenseDelta = flow.projectedIncome - flow.confirmedExpenses;
    const openingBalance = flow.projectedBalance - incomeExpenseDelta;

    let status = "安定";
    let tone = STATUS_STYLE.SAFE;
    let icon = "check_circle";
    let summary = "収入が支出を上回り、月末残高も安全ラインを上回る見込みです。";
    let helper = "まずはこの収支と残高の関係だけ確認すれば十分です。";

    if (reserveGap < 0 || flow.projectedBalance < 0) {
      status = "不足";
      tone = STATUS_STYLE.DANGER;
      icon = "error";
      summary = "月末残高が安全ラインを下回る見込みです。";
      helper = "追加収入または支出調整が必要です。";
    } else if (incomeExpenseDelta < 0) {
      status = "注意";
      tone = STATUS_STYLE.CAUTION;
      icon = "warning";
      summary = "月末残高は残りますが、今月の支出が収入を上回る見込みです。";
      helper = "まずは支出超過が一時的なものかを確認してください。";
    }

    return {
      ...flow,
      openingBalance,
      incomeExpenseDelta,
      reserveGap,
      status,
      tone,
      icon,
      summary,
      helper,
    };
  }

  function renderBalanceBridge(data) {
    const flow = getBalanceStatusContext(data);
    const availableSurplus = Math.max(0, flow.reserveGap);
    const defaultCashReserve = Math.max(
      availableSurplus - (flow.taxReserveSuggested || 0) - (flow.aiDevBudgetSuggested || 0),
      0,
    );
    const maxValue = Math.max(
      Math.abs(flow.openingBalance),
      Math.abs(flow.projectedIncome),
      Math.abs(flow.confirmedExpenses),
      Math.abs(flow.projectedBalance),
      Math.abs(flow.safetyBufferTarget),
      1,
    );
    const widthFor = (value) => Math.max(12, Math.round((Math.abs(value) / maxValue) * 100));
    const reserveTone = flow.reserveGap >= 0 ? "text-status-safe" : "text-status-danger";
    const defaultAdjustedBalance = flow.safetyBufferTarget + defaultCashReserve;
    const defaultAdjustedExpenses = flow.confirmedExpenses + (availableSurplus - defaultCashReserve);
    const rows = [
      {
        id: "opening",
        label: "月初残高",
        value: flow.openingBalance,
        bar: "bg-secondary",
        note: "今月の出発点",
      },
      {
        id: "income",
        label: "予測収入",
        value: flow.projectedIncome,
        bar: "bg-status-safe",
        note: "FleetMetric Pro同期",
      },
      {
        id: "expense",
        label: "確定支出",
        value: -defaultAdjustedExpenses,
        bar: "bg-status-caution",
        note: "選択中の配分を反映",
      },
      {
        id: "balance",
        label: "月末残高",
        value: defaultAdjustedBalance,
        bar: flow.reserveGap >= 0 ? "bg-status-safe" : "bg-status-danger",
        note: "選択後の見込み",
      },
    ];

    return `
      <section class="bg-surface-white rounded-xl card-shadow border border-border-subtle p-lg mt-md scroll-mt-20 md:scroll-mt-4" data-acc="balance-bridge">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-md mb-lg">
          <div>
            <p class="text-label-md text-secondary uppercase mb-1">残高内訳</p>
            <h3 class="font-headline-md text-headline-md text-primary font-bold">残高がどう動くか</h3>
            <p class="text-sm text-secondary mt-1 acc-break-words">月初残高に今月の収入と支出を反映して、月末残高と安全ラインとの差を確認します。</p>
          </div>
          <div class="bg-surface-container-low rounded-xl px-md py-sm border border-border-subtle shrink-0">
            <p class="text-[10px] text-secondary uppercase">安全ラインとの差</p>
            <p class="text-xl font-bold ${reserveTone}" data-balance-reserve-gap>${formatYen(defaultCashReserve)}</p>
          </div>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-lg items-stretch" data-balance-bridge-model data-opening="${flow.openingBalance}" data-income="${flow.projectedIncome}" data-expense="${flow.confirmedExpenses}" data-projected="${flow.projectedBalance}" data-safety="${flow.safetyBufferTarget}" data-surplus="${availableSurplus}">
          <div class="h-full flex flex-col gap-md">
            ${rows
              .map(
                (row) => `
              <div class="grid grid-cols-[1fr_auto] md:grid-cols-[112px_1fr_128px] gap-x-md gap-y-xs md:items-center" data-balance-row="${row.id}">
                <div>
                  <p class="text-sm font-bold text-primary">${row.label}</p>
                  <p class="text-[10px] text-secondary" data-balance-note>${row.note}</p>
                </div>
                <p class="text-right font-bold md:col-start-3 md:row-start-1 ${row.value < 0 ? "text-status-caution" : "text-primary"}" data-balance-value>${row.value < 0 ? "-" : ""}${formatYen(Math.abs(row.value))}</p>
                <div class="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1 h-8 rounded-lg bg-surface-container-low overflow-hidden border border-border-subtle">
                  <div class="h-full ${row.bar} transition-all duration-500 ease-out" data-balance-bar style="width:${widthFor(row.value)}%"></div>
                </div>
              </div>`,
              )
              .join("")}
            ${availableSurplus > 0 ? `
              <div class="grid grid-cols-[1fr_auto] md:grid-cols-[112px_1fr_128px] gap-x-md gap-y-xs md:items-center rounded-xl bg-status-safe/5 outline outline-1 outline-status-safe/20 px-0 py-sm transition-colors duration-300" data-allocation-effect data-surplus-total="${availableSurplus}">
                <div>
                  <p class="text-sm font-bold text-primary" data-allocation-effect-label>手元余力として残す</p>
                  <p class="text-[10px] text-secondary" data-allocation-effect-note>選択した現金枠</p>
                </div>
                <p class="text-right font-bold md:col-start-3 md:row-start-1 text-status-safe" data-allocation-effect-value>+${formatYen(defaultCashReserve)}</p>
                <div class="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1 h-8 rounded-lg bg-surface-container-low overflow-hidden border border-border-subtle">
                  <div class="h-full bg-status-safe transition-all duration-500 ease-out" data-allocation-effect-bar style="width:${Math.max(12, Math.round((defaultCashReserve / availableSurplus) * 100))}%"></div>
                </div>
              </div>` : ""}
          </div>
          <div class="rounded-xl bg-surface-container-low border border-border-subtle p-md h-full flex flex-col justify-center">
            <p class="text-sm font-bold text-primary mb-md">判定の式</p>
            <div class="space-y-sm text-sm">
              <div class="flex justify-between gap-md"><span class="text-secondary">月初残高</span><span class="font-bold text-primary">${formatYen(flow.openingBalance)}</span></div>
              <div class="flex justify-between gap-md"><span class="text-secondary">+ 収入</span><span class="font-bold text-status-safe">${formatYen(flow.projectedIncome)}</span></div>
              <div class="flex justify-between gap-md"><span class="text-secondary">− 支出</span><span class="font-bold text-status-caution" data-formula-expense>${formatYen(defaultAdjustedExpenses)}</span></div>
              <div class="border-t border-border-subtle pt-sm flex justify-between gap-md"><span class="text-secondary">= 月末残高</span><span class="font-bold text-primary" data-formula-balance>${formatYen(defaultAdjustedBalance)}</span></div>
              <div class="flex justify-between gap-md"><span class="text-secondary">安全ライン</span><span class="font-bold text-primary">${formatYen(flow.safetyBufferTarget)}</span></div>
              <div class="flex justify-between gap-md"><span class="text-secondary">差額</span><span class="font-bold text-status-safe" data-formula-gap>${formatYen(defaultCashReserve)}</span></div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderSurplusBrief(data) {
    const flow = getBalanceStatusContext(data);
    const availableSurplus = Math.max(0, flow.reserveGap);
    if (availableSurplus <= 0) return "";

    const taxReserve = Math.min(availableSurplus, flow.taxReserveSuggested || 0);
    const aiBudget = Math.min(Math.max(availableSurplus - taxReserve, 0), flow.aiDevBudgetSuggested || 0);
    const keepOnHand = Math.max(availableSurplus - taxReserve - aiBudget, 0);
    const allocations = [
      {
        id: "tax",
        kind: "expense",
        label: "税金積立",
        value: taxReserve,
        detail: `今月収入の${flow.taxPct || 10}%を先に確保`,
        color: "bg-secondary",
        note: "この金額を税金用に確保したあとの手持ちです",
      },
      {
        id: "ai",
        kind: "expense",
        label: "事業投資・AI予算",
        value: aiBudget,
        detail: "余剰内で小さく試す",
        color: "bg-primary",
        note: "この金額を事業投資に使ったあとの手持ちです",
      },
      {
        id: "cash",
        kind: "cash",
        label: "手元余力として残す",
        value: keepOnHand,
        detail: "安全ライン超過分の残り",
        color: "bg-status-safe",
        note: "この金額を確保したうえで、残りを別用途に回せます",
      },
    ].filter((item) => item.value > 0);

    const defaultAllocation = allocations.find((item) => item.id === "cash") || allocations[0];
    const cashOnHandFor = (item) =>
      item.kind === "cash" ? item.value : Math.max(availableSurplus - item.value, 0);
    const formulaFor = (item) =>
      item.kind === "cash"
        ? `余剰金 ${formatYen(availableSurplus)} のうち ${item.label} +${formatYen(item.value)} = 今使える現金 ${formatYen(cashOnHandFor(item))}`
        : `余剰金 ${formatYen(availableSurplus)} − ${item.label} ${formatYen(item.value)} = 今使える現金 ${formatYen(cashOnHandFor(item))}`;
    const selectedTextFor = (item) =>
      item.kind === "cash"
        ? `${item.label} +${formatYen(item.value)} を選択中`
        : `${item.label} ${formatYen(item.value)} を選択中`;
    const defaultCashOnHand = cashOnHandFor(defaultAllocation);
    const segmentStyle = (value) => `width:${Math.max(8, Math.round((value / availableSurplus) * 100))}%`;

    return `
      <section class="bg-surface-white rounded-xl card-shadow border border-border-subtle p-lg mt-md" data-acc="surplus-brief">
        <div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-lg xl:items-start">
          <div>
            <p class="text-label-md text-secondary uppercase mb-1">Commander Brief</p>
            <h3 class="font-headline-md text-headline-md text-primary font-bold">余剰金をどう使うか</h3>
            <p class="text-sm text-secondary mt-1 max-w-3xl acc-break-words">安全ラインを上回った ${formatYen(availableSurplus)} を、まず税金、次に事業投資、残りは手元余力として扱います。</p>
          </div>
          <div class="rounded-xl bg-surface-container-low border border-border-subtle p-md">
            <p class="text-[10px] text-secondary uppercase mb-1">配分対象</p>
            <p class="text-2xl font-bold text-status-safe">${formatYen(availableSurplus)}</p>
            <div class="flex h-3 rounded-full overflow-hidden bg-surface-white border border-border-subtle mt-md" aria-label="余剰金の配分">
              ${allocations.map((item) => `<span class="${item.color}" style="${segmentStyle(item.value)}"></span>`).join("")}
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-md mt-lg">
          ${allocations
            .map(
              (item) => {
                const selected = item.id === defaultAllocation.id;
                const selectedClass = selected ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border-subtle bg-surface-container-low";
                return `
            <button type="button" class="acc-surplus-option text-left rounded-xl border ${selectedClass} p-md transition-all hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30" aria-pressed="${selected ? "true" : "false"}" data-surplus-option data-kind="${item.kind}" data-label="${item.label}" data-value="${item.value}" data-note="${item.note}">
              <div class="flex items-start justify-between gap-md">
                <div>
                  <p class="text-sm font-bold text-primary acc-break-words">${item.label}</p>
                  <p class="text-[11px] text-secondary mt-1 acc-break-words">${item.detail}</p>
                </div>
                <span class="w-3 h-3 rounded-full ${item.color} shrink-0 mt-1"></span>
              </div>
              <p class="text-xl font-bold text-primary mt-md">${formatYen(item.value)}</p>
            </button>`;
              },
            )
            .join("")}
        </div>
        <div class="mt-md rounded-xl border border-primary/20 bg-status-safe/5 p-md" data-surplus-result data-surplus-total="${availableSurplus}">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-md">
            <div>
              <p class="text-label-md text-secondary uppercase mb-1">選択後の手持ち現金</p>
              <p class="text-sm text-secondary acc-break-words">月末残高から安全ラインを確保したあとの余剰金ベース</p>
              <p class="text-xs text-secondary mt-2 acc-break-words" data-surplus-note>${defaultAllocation.note}</p>
            </div>
            <div class="md:text-right">
              <p class="text-3xl font-bold text-status-safe" data-surplus-cash>${formatYen(defaultCashOnHand)}</p>
              <p class="text-xs text-secondary mt-1 acc-break-words" data-surplus-selected>${selectedTextFor(defaultAllocation)}</p>
            </div>
          </div>
          <p class="mt-md pt-md border-t border-border-subtle text-sm text-secondary acc-break-words" data-surplus-formula>
            ${formulaFor(defaultAllocation)}
          </p>
        </div>
      </section>`;
  }

  function resolveActionImpactDisplay(action, data) {
    const opt = data.brief?.subscriptionOptimization;
    if (action.id === "subscription-cleanup" && opt) {
      return {
        amount: opt.monthlySavingPotential,
        period: "monthly",
        sub: `年間 ${formatYen(opt.yearlySavingPotential)} 相当`,
      };
    }
    const period = action.impactPeriod || inferPeriodFromAction(action);
    return { amount: action.impactYen, period, sub: null };
  }

  function inferPeriodFromAction(action) {
    if (action.impactPeriod) return action.impactPeriod;
    if (/年間/.test(action.title || "")) return "yearly";
    if (/月/.test(action.title || "")) return "monthly";
    if (action.category === "subscription") return "yearly";
    return "monthly";
  }

  /** 収支→残高のつながり */
  function renderSurplusFlowLine(data) {
    const flow = getBalanceStatusContext(data);
    return `
      <p class="text-xs text-secondary mb-md acc-break-words" data-acc="surplus-flow-line">
        <span class="font-semibold text-primary">${flow.asOfLabel}</span>
        — 収入 ${formatMoneyWithPeriod(flow.projectedIncome, "monthly")} − 支出 ${formatMoneyWithPeriod(flow.confirmedExpenses, "monthly")}
        = 収支 ${formatYen(flow.incomeExpenseDelta)}
        → 月末残高 ${formatMoneyWithPeriod(flow.projectedBalance, "balance")}
      </p>`;
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
      asOfMonth: data.asOfMonth || FALLBACK_DASHBOARD.asOfMonth,
      safetyBufferTarget: data.safetyBufferTarget ?? FALLBACK_DASHBOARD.safetyBufferTarget,
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
    const flow = getBalanceStatusContext(data);
    const s = flow.tone;
    const balanceVsLine = flow.reserveGap >= 0 ? "上回る" : "下回る";
    const balanceText = flow.reserveGap >= 0 ? `安全ラインを ${formatYen(flow.reserveGap)} 上回ります` : `安全ラインに ${formatYen(Math.abs(flow.reserveGap))} 足りません`;

    if (compact) {
      return `
        <section class="rounded-xl card-shadow border-2 ${s.border} ${s.bg} p-5 mb-4" data-acc="safety-hero">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined ${s.text}">${flow.icon}</span>
            <span class="${s.text} font-bold">${flow.status}</span>
          </div>
          <p class="text-lg font-bold text-primary acc-break-words">${flow.summary}</p>
          <p class="text-xs text-secondary mt-2 acc-break-words">月末残高は安全ラインを${balanceVsLine}見込みです。</p>
        </section>`;
    }

    return `
      <section class="rounded-xl card-shadow border-2 ${s.border} bg-surface-white overflow-hidden mb-md" data-acc="safety-hero">
        <div class="h-1.5 ${s.bar} w-full"></div>
        <div class="p-lg">
          <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-lg">
            <div class="max-w-3xl">
              <p class="text-label-md font-label-md text-secondary uppercase mb-2">${flow.asOfLabel}</p>
              <div class="flex items-center gap-3 mb-md">
                <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full ${s.bg} ${s.text} text-xl font-bold">
                  <span class="material-symbols-outlined text-2xl" style="font-variation-settings:'FILL' 1">${flow.icon}</span>
                  ${flow.status}
                </span>
                <span class="text-sm text-secondary">収支と残高で判定</span>
              </div>
              <h3 class="font-headline-md text-headline-md text-primary font-bold acc-break-words">${flow.summary}</h3>
              <p class="text-sm text-secondary mt-2 acc-break-words">${flow.helper}</p>
            </div>
            <div class="bg-surface-container-low rounded-xl p-md min-w-[260px] border border-border-subtle">
              <p class="text-[10px] text-secondary uppercase mb-1">月末残高</p>
              <p class="text-3xl font-bold text-primary">${formatYen(flow.projectedBalance)}</p>
              <p class="text-xs ${s.text} font-semibold mt-2 acc-break-words">${balanceText}</p>
              <p class="text-[10px] text-secondary mt-1 acc-break-words">安全ライン: ${formatYen(flow.safetyBufferTarget)}</p>
            </div>
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
    const flow = getBalanceStatusContext(data);
    const card = compact
      ? "min-w-[140px] shrink-0 bg-surface-white p-4 rounded-xl shadow-sm border-t-2 border-primary"
      : "bg-surface-white p-md rounded-xl card-shadow border-t-2 border-primary";

    const incomePeriod = k.projectedIncomePeriod || "monthly";
    const expensePeriod = k.confirmedExpensesPeriod || "monthly";
    const balancePeriod = k.projectedBalancePeriod || "balance";

    const wrap = compact
      ? `<div class="flex gap-3 overflow-x-auto pb-2 mb-4 snap-x" data-acc="kpis">`
      : `<div data-acc="kpis-block">
          ${renderSurplusFlowLine(data)}
          <div class="grid grid-cols-1 md:grid-cols-4 gap-md mb-md" data-acc="kpis">`;

    const close = compact ? `</div>` : `</div></div>`;

    return (
      wrap +
      `
      <div class="${card}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">予測収入 <span class="normal-case">(${PERIOD_LABEL[incomePeriod]})</span></p>
        <p class="text-lg font-bold text-primary">${formatMoneyWithPeriod(k.projectedIncome, incomePeriod)}</p>
        <p class="text-[10px] text-secondary mt-1 acc-break-words">FleetMetric Pro 同期</p>
      </div>
      <div class="${card.replace("border-primary", "border-status-caution")}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">確定支出 <span class="normal-case">(${PERIOD_LABEL[expensePeriod]})</span></p>
        <p class="text-lg font-bold text-primary">${formatMoneyWithPeriod(k.confirmedExpenses, expensePeriod)}</p>
      </div>
      <div class="${card.replace("border-primary", flow.incomeExpenseDelta >= 0 ? "border-status-safe" : "border-status-danger")}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">収支</p>
        <p class="text-lg font-bold ${flow.incomeExpenseDelta >= 0 ? "text-status-safe" : "text-status-danger"}">${formatYen(flow.incomeExpenseDelta)}</p>
        <p class="text-[10px] text-secondary mt-1 acc-break-words">収入 − 支出</p>
      </div>
      <div class="${card.replace("border-primary", flow.reserveGap >= 0 ? "border-status-safe" : "border-status-danger")}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">予想残高 <span class="normal-case">(${PERIOD_LABEL[balancePeriod]})</span></p>
        <p class="text-lg font-bold text-primary">${formatMoneyWithPeriod(k.projectedBalance, balancePeriod)}</p>
        <p class="text-[10px] ${flow.reserveGap >= 0 ? "text-status-safe" : "text-status-danger"} font-semibold mt-1 acc-break-words">安全ラインとの差 ${formatYen(flow.reserveGap)}</p>
      </div>
    ${close}`
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
    const colors = ["border-status-caution", "border-primary", "border-status-safe"];

    const items = actions
      .map((a, i) => {
        const border = colors[i] || "border-border-subtle";
        const impact = resolveActionImpactDisplay(a, data);
        return `
        <div class="group p-md border border-border-subtle rounded-xl hover:${border} hover:bg-surface-container-low transition-all cursor-pointer border-l-4 ${border}">
          <div class="flex items-start gap-md">
            <div class="w-8 h-8 bg-surface-container rounded-lg flex items-center justify-center shrink-0 font-bold text-xs text-primary">${a.priority}</div>
            <div class="flex-1">
              <p class="text-sm font-bold text-primary">${a.title}</p>
              <p class="text-xs text-secondary mt-1">${a.templateReason}</p>
              ${impact.amount > 0 ? `<p class="text-xs font-bold text-primary mt-1">${formatMoneyWithPeriod(impact.amount, impact.period)}</p>` : ""}
              ${impact.sub ? `<p class="text-[10px] text-secondary mt-0.5">${impact.sub}</p>` : ""}
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
        <p class="text-sm text-primary acc-break-words">余剰 ${formatMoneyWithPeriod(s.amount || 0, s.amountPeriod || "balance")} · 税金 ${formatMoneyWithPeriod(s.taxReserveSuggested || 0, "monthly")} · AI ${formatMoneyWithPeriod(s.aiDevBudgetSuggested || 0, "monthly")}</p>
      </section>`;
    }

    const flow = getSurplusFlowContext(data);
    const cards = [
      {
        icon: "savings",
        label: "余剰資金",
        amount: s.amount || 0,
        period: s.amountPeriod || "balance",
        hint: "予想残高 − 安全に必要な残高",
      },
      {
        icon: "trending_up",
        label: "投資候補",
        amount: s.investmentCandidate || 0,
        period: s.investmentCandidatePeriod || "monthly",
        hint: "余剰から今月回す額",
      },
      {
        icon: "account_balance",
        label: "税金積立提案",
        amount: s.taxReserveSuggested || 0,
        period: s.taxReserveSuggestedPeriod || "monthly",
        hint: `今月収入の ${flow.taxPct}%`,
      },
      {
        icon: "code",
        label: "AI開発予算提案",
        amount: s.aiDevBudgetSuggested || 0,
        period: s.aiDevBudgetSuggestedPeriod || "monthly",
        hint: "余剰から今月の予算枠",
      },
    ];

    return `
      <section class="rounded-xl bg-status-safe/5 border border-status-safe/30 p-lg mb-md card-shadow" data-acc="offensive-proposals">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-md">
          <div>
            <h3 class="font-headline-md text-primary font-bold flex items-center gap-2">
              <span class="material-symbols-outlined text-status-safe">rocket_launch</span>
              攻めの提案 — 今月は問題ありません
            </h3>
            <p class="text-sm text-secondary acc-break-words">余剰 ${formatMoneyWithPeriod(flow.surplus, "balance")} の配分案。根拠は下の収支カード。</p>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-md">
          ${cards
            .map(
              (c) => `
            <div class="bg-surface-white rounded-xl p-md border border-border-subtle">
              <span class="material-symbols-outlined text-status-safe text-xl">${c.icon}</span>
              <p class="text-[10px] text-secondary uppercase mt-2">${c.label}</p>
              <p class="text-xl font-bold text-primary">${formatMoneyWithPeriod(c.amount, c.period)}</p>
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
    return hero + renderSecondaryKpis(data, compact) + renderBalanceBridge(data) + renderSurplusBrief(data);
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

  function initSurplusBrief(root = document) {
    const brief = root.querySelector("[data-acc='surplus-brief']");
    if (!brief) return;

    const options = Array.from(brief.querySelectorAll("[data-surplus-option]"));
    const result = brief.querySelector("[data-surplus-result]");
    if (!options.length || !result) return;

    const cashEl = result.querySelector("[data-surplus-cash]");
    const selectedEl = result.querySelector("[data-surplus-selected]");
    const formulaEl = result.querySelector("[data-surplus-formula]");
    const noteEl = result.querySelector("[data-surplus-note]");
    const effect = root.querySelector("[data-allocation-effect]");
    const effectLabel = effect?.querySelector("[data-allocation-effect-label]");
    const effectNote = effect?.querySelector("[data-allocation-effect-note]");
    const effectValue = effect?.querySelector("[data-allocation-effect-value]");
    const effectBar = effect?.querySelector("[data-allocation-effect-bar]");
    const balanceModel = root.querySelector("[data-balance-bridge-model]");
    const reserveGapEl = root.querySelector("[data-balance-reserve-gap]");
    const formulaExpenseEl = root.querySelector("[data-formula-expense]");
    const formulaBalanceEl = root.querySelector("[data-formula-balance]");
    const formulaGapEl = root.querySelector("[data-formula-gap]");
    const balanceRows = {
      expense: root.querySelector("[data-balance-row='expense']"),
      balance: root.querySelector("[data-balance-row='balance']"),
    };
    const total = Number(result.dataset.surplusTotal || 0);
    const format = (value) => formatYen(Number(value || 0));
    const baseExpense = Number(balanceModel?.dataset.expense || 0);
    const safetyLine = Number(balanceModel?.dataset.safety || 0);
    const maxValue = Math.max(
      Number(balanceModel?.dataset.opening || 0),
      Number(balanceModel?.dataset.income || 0),
      Number(balanceModel?.dataset.projected || 0),
      baseExpense + total,
      safetyLine + total,
      1,
    );
    const widthFor = (value) => `${Math.max(12, Math.round((Math.abs(value) / maxValue) * 100))}%`;
    const setRow = (row, value, note, tone = "text-primary") => {
      if (!row) return;
      const valueEl = row.querySelector("[data-balance-value]");
      const noteEl = row.querySelector("[data-balance-note]");
      const barEl = row.querySelector("[data-balance-bar]");
      if (valueEl) {
        valueEl.textContent = `${value < 0 ? "-" : ""}${format(Math.abs(value))}`;
        valueEl.classList.toggle("text-status-caution", tone === "text-status-caution");
        valueEl.classList.toggle("text-status-safe", tone === "text-status-safe");
        valueEl.classList.toggle("text-primary", tone === "text-primary");
      }
      if (noteEl) noteEl.textContent = note;
      if (barEl) barEl.style.width = widthFor(value);
    };

    function setSelected(option) {
      const value = Number(option.dataset.value || 0);
      const kind = option.dataset.kind || "expense";
      const label = option.dataset.label || "";
      const note = option.dataset.note || "";
      const cashOnHand = kind === "cash" ? value : Math.max(total - value, 0);
      const allocationSpend = kind === "cash" ? total - value : value;
      const adjustedExpense = baseExpense + allocationSpend;
      const adjustedBalance = safetyLine + cashOnHand;
      const selectedText =
        kind === "cash" ? `${label} +${format(value)} を選択中` : `${label} ${format(value)} を選択中`;
      const formula =
        kind === "cash"
          ? `余剰金 ${format(total)} のうち ${label} +${format(value)} = 今使える現金 ${format(cashOnHand)}`
          : `余剰金 ${format(total)} − ${label} ${format(value)} = 今使える現金 ${format(cashOnHand)}`;
      const effectSign = kind === "cash" ? "+" : "−";
      const effectTone = kind === "cash" ? "text-status-safe" : "text-status-caution";
      const effectBarClass = kind === "cash" ? "bg-status-safe" : "bg-status-caution";

      options.forEach((item) => {
        const active = item === option;
        item.setAttribute("aria-pressed", active ? "true" : "false");
        item.classList.toggle("border-primary", active);
        item.classList.toggle("bg-primary/5", active);
        item.classList.toggle("ring-2", active);
        item.classList.toggle("ring-primary/10", active);
        item.classList.toggle("border-border-subtle", !active);
        item.classList.toggle("bg-surface-container-low", !active);
      });

      if (cashEl) cashEl.textContent = format(cashOnHand);
      if (selectedEl) selectedEl.textContent = selectedText;
      if (formulaEl) formulaEl.textContent = formula;
      if (noteEl) noteEl.textContent = note;
      if (reserveGapEl) reserveGapEl.textContent = format(cashOnHand);
      if (formulaExpenseEl) formulaExpenseEl.textContent = format(adjustedExpense);
      if (formulaBalanceEl) formulaBalanceEl.textContent = format(adjustedBalance);
      if (formulaGapEl) formulaGapEl.textContent = format(cashOnHand);
      setRow(balanceRows.expense, -adjustedExpense, "選択中の配分を反映", "text-status-caution");
      setRow(balanceRows.balance, adjustedBalance, "選択後の見込み", "text-primary");
      if (effectLabel) effectLabel.textContent = label;
      if (effectNote) effectNote.textContent = kind === "cash" ? "選択した現金枠" : "余剰金から使う額";
      if (effectValue) {
        effectValue.textContent = `${effectSign}${format(value)}`;
        effectValue.classList.toggle("text-status-safe", kind === "cash");
        effectValue.classList.toggle("text-status-caution", kind !== "cash");
      }
      if (effectBar) {
        effectBar.style.width = `${Math.max(12, Math.round((value / total) * 100))}%`;
        effectBar.classList.toggle("bg-status-safe", kind === "cash");
        effectBar.classList.toggle("bg-status-caution", kind !== "cash");
      }
      if (effect) {
        effect.classList.toggle("bg-status-safe/5", kind === "cash");
        effect.classList.toggle("outline-status-safe/20", kind === "cash");
        effect.classList.toggle("bg-status-caution/5", kind !== "cash");
        effect.classList.toggle("outline-status-caution/20", kind !== "cash");
      }
      if (window.innerWidth < 768) {
        const bridge = root.querySelector("[data-acc='balance-bridge']");
        window.setTimeout(() => bridge?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
    }

    options.forEach((option) => {
      option.addEventListener("click", () => setSelected(option));
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
    const flow = getBalanceStatusContext(data);
    const s = flow.tone;
    return `<div class="px-2 mb-4" data-acc="sidebar-status">
      <div class="text-label-md text-secondary mb-1 uppercase text-[10px]">今月の収支</div>
      <span class="inline-flex items-center gap-1 ${s.text} font-bold text-sm">${flow.status}</span>
      <div class="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
        <div class="${s.bar} h-full rounded-full" style="width:${flow.reserveGap >= 0 ? 100 : 35}%"></div>
      </div>
      <p class="text-[10px] text-secondary mt-1">収支 ${formatYen(flow.incomeExpenseDelta)} · 残高 ${formatYen(flow.projectedBalance)}</p>
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
    asOfMonth: "2026-06",
    safetyBufferTarget: 1109220,
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
        id: "cancel-sub-dropbox",
        title: "Dropbox Professional を解約（年間 ¥23,760 削減）",
        impactYen: 23760,
        impactPeriod: "yearly",
        category: "subscription",
        templateReason: "過去90日間の利用実績がありません（最終利用: 120日前）",
      },
      priorityActions: [
        {
          priority: 1,
          id: "cancel-sub-dropbox",
          title: "Dropbox Professional を解約（年間 ¥23,760 削減）",
          impactYen: 23760,
          impactPeriod: "yearly",
          category: "subscription",
          templateReason: "過去90日間の利用実績がありません（最終利用: 120日前）",
        },
        {
          priority: 2,
          id: "subscription-cleanup",
          title: "サブスク整理（月 ¥12,860 改善）",
          impactYen: 12860,
          impactPeriod: "monthly",
          category: "subscription",
          templateReason: "3 件の解約候補を検出",
        },
        {
          priority: 3,
          id: "tax-reserve",
          title: "税金積立 ¥125,000 を開始",
          impactYen: 125000,
          impactPeriod: "monthly",
          category: "tax",
          templateReason: "今月収入の10%を納税準備口座へ",
        },
      ],
      subscriptionOptimization: {
        monthlySavingPotential: 12860,
        yearlySavingPotential: 154320,
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
      projectedIncomePeriod: "monthly",
      confirmedExpenses: 420000,
      confirmedExpensesPeriod: "monthly",
      projectedBalance: 1429220,
      projectedBalancePeriod: "balance",
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
      amountPeriod: "balance",
      investmentCandidate: 150000,
      investmentCandidatePeriod: "monthly",
      taxReserveSuggested: 125000,
      taxReserveSuggestedPeriod: "monthly",
      aiDevBudgetSuggested: 50000,
      aiDevBudgetSuggestedPeriod: "monthly",
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
    initSurplusBrief,
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
