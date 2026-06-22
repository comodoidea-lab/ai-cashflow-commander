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
    GENTLE: {
      text: "text-secondary",
      bg: "bg-surface-container",
      border: "border-border-subtle",
      bar: "bg-secondary/40",
      icon: "self_improvement",
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
    let summary = "収支・残高ともに安全圏内です。";
    let helper = "収支と残高だけ見ればOKです。";

    if (reserveGap < 0 || flow.projectedBalance < 0) {
      status = "不足";
      tone = STATUS_STYLE.DANGER;
      icon = "error";
      summary = "今月はお金が足りない見込みです。";
      helper = "まずリボと固定費から見直しましょう。";
    } else if (incomeExpenseDelta < 0) {
      status = "注意";
      tone = STATUS_STYLE.CAUTION;
      icon = "warning";
      summary = "支出が収入を上回る見込みです。";
      helper = "サブスクと食費から削れます。";
    }

    return softenBalanceStatus({
      ...flow,
      openingBalance,
      incomeExpenseDelta,
      reserveGap,
      status,
      tone,
      icon,
      summary,
      helper,
    });
  }

  function isGentleTone() {
    return typeof document !== "undefined" && document.body?.classList.contains("acc-gentle");
  }

  function softenBalanceStatus(flow) {
    if (!isGentleTone()) return flow;
    const soft = { ...flow, gentle: true };
    if (flow.reserveGap < 0 || flow.projectedBalance < 0) {
      soft.status = "今月";
      soft.tone = STATUS_STYLE.GENTLE;
      soft.icon = "self_improvement";
      soft.summary = "きつい時期です。無理せず、今日ひとつだけ進めましょう。";
      soft.helper = "数字の詳細は「くわしく見る」から、気になるときだけ開けます。";
    } else if (flow.incomeExpenseDelta < 0) {
      soft.status = "見直し";
      soft.tone = STATUS_STYLE.GENTLE;
      soft.icon = "self_improvement";
      soft.summary = "支出がやや多めの見込みです。";
      soft.helper = "小さな変更から始められます。";
    }
    return soft;
  }

  function gentleDetailsSummary(defaultLabel) {
    return isGentleTone() ? "くわしく見る（気になるときだけ）" : defaultLabel;
  }

  function primaryActionLabel() {
    return isGentleTone() ? "今日の一歩" : "いまやること";
  }

  function getPrimaryNextAction(data) {
    const actions = data.brief?.priorityActions || [];
    return actions[0] || data.brief?.primaryAction || null;
  }

  function shortenActionTitle(title) {
    return (title || "").replace(/（[^）]*）/g, "").trim();
  }

  function isEasyMode() {
    return typeof document !== "undefined" && document.body?.classList.contains("acc-easy");
  }

  function resolveActionCtaKey(action) {
    if (!action) return "primary-action";
    if (action.id === "tax-reserve") return "tax-reserve";
    if (action.id === "ai-dev-budget") return "ai-dev-budget";
    return "primary-action";
  }

  /** かんたん表示 — 状態 + 次の1アクション */
  function renderSafetyHeroEasy(data) {
    const flow = getBalanceStatusContext(data);
    const action = getPrimaryNextAction(data);
    const s = flow.tone;
    const nextLine = action
      ? `次: ${shortenActionTitle(action.title)}`
      : flow.helper;

    return `
      <section class="rounded-xl card-shadow border-2 ${s.border} bg-surface-white overflow-hidden mb-md" data-acc="safety-hero">
        <div class="h-1.5 ${s.bar} w-full"></div>
        <div class="p-lg">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${s.bg} ${s.text} text-lg font-bold mb-sm">
                <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">${flow.icon}</span>
                ${flow.status}
              </span>
              <h3 class="font-headline-md text-headline-md text-primary font-bold acc-break-words">${flow.summary}</h3>
              <p class="text-sm font-semibold text-primary mt-sm acc-break-words">${nextLine}</p>
            </div>
            <div class="shrink-0 sm:text-right" data-acc-harsh="true">
              <p class="text-[10px] text-secondary uppercase">月末残高</p>
              <p class="text-3xl font-bold text-primary">${formatYen(flow.projectedBalance)}</p>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderSecondaryKpisEasy(data) {
    const k = data.kpis;
    const flow = getBalanceStatusContext(data);
    const card = (label, value, tone) => `
      <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
        <p class="text-[10px] text-secondary mb-1">${label}</p>
        <p class="text-lg font-bold ${tone || "text-primary"}">${value}</p>
      </div>`;

    const gentle = isGentleTone();
    const balanceCard = gentle
      ? ""
      : card("残高", formatYen(k.projectedBalance), flow.reserveGap >= 0 ? "text-status-safe" : "text-status-danger");

    return `
      <div class="grid grid-cols-${gentle ? "2" : "3"} gap-sm mb-md" data-acc="kpis-easy">
        ${card("収入", formatYen(k.projectedIncome))}
        ${card("支出", formatYen(k.confirmedExpenses), gentle ? "text-primary" : "text-status-caution")}
        ${balanceCard}
      </div>`;
  }

  function renderPrimaryActionCard(data) {
    const action = getPrimaryNextAction(data);
    if (!action) return "";

    const impact = resolveActionImpactDisplay(action, data);
    const href = actionDetailHref(action);
    const ctaKey = resolveActionCtaKey(action);
    const title = shortenActionTitle(action.title);

    const cta = href
      ? `<a href="${href}" class="inline-flex items-center justify-center gap-sm mt-md bg-white text-primary px-lg py-sm rounded-xl font-bold tap-scale">進む</a>`
      : `<button type="button" data-acc-cta="${ctaKey}" class="inline-flex items-center justify-center gap-sm mt-md bg-white text-primary px-lg py-sm rounded-xl font-bold tap-scale">結果を見る</button>`;

    return `
      <section class="bg-primary-container text-white rounded-xl p-lg mb-md card-shadow" data-acc="primary-action-card">
        <p class="text-[10px] uppercase tracking-wider text-on-primary-container">${primaryActionLabel()}</p>
        <p class="text-xl font-bold mt-1 acc-break-words">${title}</p>
        ${impact.amount > 0 ? `<p class="text-2xl font-bold mt-2" data-acc-harsh="true">${formatMoneyWithPeriod(impact.amount, impact.period)}</p>` : ""}
        ${cta}
      </section>`;
  }

  function renderDashboardDetails(data) {
    const monthRef = (data.asOfMonth || "2026-06") + "-15";
    return `
      <details class="acc-details-panel">
        <summary class="acc-details-summary">${gentleDetailsSummary("くわしく見る（計算・配分・予定）")}</summary>
        <div class="acc-details-body">
          ${renderBalanceBridge(data)}
          ${renderSurplusBrief(data)}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-xl mt-md">
            <div class="lg:col-span-2 bg-surface-white rounded-xl card-shadow p-lg">${renderActionCalendar(data, monthRef)}</div>
            <div class="bg-surface-white rounded-xl card-shadow p-lg">${renderTopActions(data)}</div>
          </div>
        </div>
      </details>`;
  }

  function renderDashboardEasy(data) {
    return (
      renderSafetyHeroEasy(data) +
      renderSecondaryKpisEasy(data) +
      renderPrimaryActionCard(data) +
      renderDashboardDetails(data)
    );
  }

  function remountDashboard(root, data) {
    if (!root) return;
    root.innerHTML = renderDashboardContent(data, false);
    initSurplusBrief(root);
    bindDashboardCtas(data, root);
    bindTapScale();
  }

  function syncPageDetailsPanel(id, easy) {
    const el = document.getElementById(id);
    if (!el) return;
    if (easy) el.removeAttribute("open");
    else el.setAttribute("open", "");
  }

  function renderSubscriptionsEasy(data) {
    const opt = data.brief?.subscriptionOptimization;
    if (!opt) return "";
    const monthlyTotal = opt.monthlySubsTotal || 2870;
    const top = opt.candidates[0];
    const gentle = isGentleTone();
    const count = opt.candidates.length;
    const summary = gentle
      ? count > 0
        ? "見直せそうなサブスクがあります。"
        : "大きな削減候補はありません。"
      : count > 0
        ? `解約候補が ${count}件あります。`
        : "大きな削減候補はありません。";
    const nextLine = top
      ? gentle
        ? `候補: ${shortenActionTitle(top.name)}`
        : `次: ${shortenActionTitle(top.name)} を解約`
      : "このまま維持でOKです。";

    return `
      <section class="rounded-xl card-shadow border-2 border-status-caution bg-surface-white overflow-hidden mb-md" data-acc="subs-easy-hero">
        <div class="h-1.5 ${gentle ? "bg-secondary/40" : "bg-status-caution"} w-full"></div>
        <div class="p-lg">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-caution/10 text-status-caution text-lg font-bold mb-sm">
                <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">subscriptions</span>
                見直し
              </span>
              <h3 class="font-headline-md text-headline-md text-primary font-bold acc-break-words">${summary}</h3>
              <p class="text-sm font-semibold text-primary mt-sm acc-break-words">${nextLine}</p>
            </div>
            <div class="shrink-0 sm:text-right" data-acc-harsh="true">
              <p class="text-[10px] text-secondary uppercase">月額合計</p>
              <p class="text-3xl font-bold text-primary">${formatYen(monthlyTotal)}</p>
            </div>
          </div>
        </div>
      </section>
      ${gentle ? "" : `
      <div class="grid grid-cols-3 gap-sm mb-md" data-acc="subs-kpis-easy">
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">月額</p>
          <p class="text-lg font-bold text-primary">${formatYen(monthlyTotal)}</p>
        </div>
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">削減/月</p>
          <p class="text-lg font-bold text-status-caution">${formatYen(opt.monthlySavingPotential)}</p>
        </div>
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">削減/年</p>
          <p class="text-lg font-bold text-status-safe">${formatYen(opt.yearlySavingPotential)}</p>
        </div>
      </div>`}
      ${top ? `
      <section class="bg-primary-container text-white rounded-xl p-lg mb-md card-shadow" data-acc="subs-primary-action">
        <p class="text-[10px] uppercase tracking-wider text-on-primary-container">${primaryActionLabel()}</p>
        <p class="text-xl font-bold mt-1 acc-break-words">${gentle ? shortenActionTitle(top.name) : `${shortenActionTitle(top.name)} を解約`}</p>
        <p class="text-2xl font-bold mt-2" data-acc-harsh="true">${formatYen(top.yearlySaving)}/年</p>
        <button type="button" data-acc-subs-cta="audit-report" class="inline-flex items-center justify-center gap-sm mt-md bg-white text-primary px-lg py-sm rounded-xl font-bold tap-scale">内容を見る</button>
      </section>` : ""}`;
  }

  function renderCashflowEasy(data) {
    const k = data.kpis || {};
    const pending = 3;
    return `
      <section class="rounded-xl card-shadow border-2 border-status-safe bg-surface-white overflow-hidden mb-md" data-acc="cashflow-easy-hero">
        <div class="h-1.5 bg-status-safe w-full"></div>
        <div class="p-lg">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-safe/10 text-status-safe text-lg font-bold mb-sm">
                <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">pending_actions</span>
                承認待ち ${pending}件
              </span>
              <h3 class="font-headline-md text-headline-md text-primary font-bold acc-break-words">明細を取り込めば自動分類されます。</h3>
              <p class="text-sm font-semibold text-primary mt-sm acc-break-words">次: 銀行明細CSVを取り込む</p>
            </div>
          </div>
        </div>
      </section>
      <div class="grid grid-cols-3 gap-sm mb-md" data-acc="cashflow-kpis-easy">
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">収入</p>
          <p class="text-lg font-bold text-primary">${formatYen(k.projectedIncome || 0)}</p>
        </div>
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">支出</p>
          <p class="text-lg font-bold text-status-caution">${formatYen(k.confirmedExpenses || 0)}</p>
        </div>
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">承認待ち</p>
          <p class="text-lg font-bold text-status-safe">${pending}件</p>
        </div>
      </div>`;
  }

  function updateSubscriptionsPanels(data, result) {
    const opt = data.brief?.subscriptionOptimization;
    if (!opt) return;

    const optPanel = document.getElementById("acc-opt-panel");
    if (optPanel) optPanel.innerHTML = renderOptimizationPanel(data);

    const savings = document.getElementById("acc-footer-savings");
    if (savings) savings.textContent = `${formatYen(opt.yearlySavingPotential)} /yr`;

    const monthlyHeader = document.getElementById("acc-subs-monthly-total");
    if (monthlyHeader) monthlyHeader.textContent = formatYen(opt.monthlySubsTotal || 2870);

    const top = opt.candidates[0];
    const audit = document.getElementById("acc-audit-text");
    if (audit) {
      audit.innerHTML = top
        ? `<strong class="text-white">${opt.candidates.length}件</strong>の解約候補を検出。` +
          `<strong class="text-white">${top.name}</strong>を解約すると年間 <strong class="text-white">${formatYen(top.yearlySaving)}</strong> 削減。`
        : "解約候補はありません。";
    }

    const api = document.getElementById("acc-api-status");
    if (api && result) api.innerHTML = renderApiStatus(result);
  }

  function remountSubscriptions(data, result) {
    const easy = document.getElementById("acc-subs-easy");
    const easyOn = isEasyMode();
    if (easy) {
      easy.innerHTML = easyOn ? renderSubscriptionsEasy(data) : "";
      easy.style.display = easyOn ? "" : "none";
    }
    syncPageDetailsPanel("acc-subs-details", easyOn);
    updateSubscriptionsPanels(data, result);
    bindSubscriptionsCtas(data);
  }

  function remountCashflow(data, dashResult, csvResult) {
    const easy = document.getElementById("acc-cashflow-easy");
    const easyOn = isEasyMode();
    if (easy) {
      easy.innerHTML = easyOn ? renderCashflowEasy(data) : "";
      easy.style.display = easyOn ? "" : "none";
    }
    syncPageDetailsPanel("acc-cashflow-details", easyOn);

    const apiPanel = document.getElementById("acc-import-api-panel");
    if (apiPanel) apiPanel.innerHTML = renderImportApiPanel(data, dashResult, csvResult);

    const fm = document.getElementById("acc-fleetmetric-sync-root");
    if (fm) fm.innerHTML = renderFleetMetricSyncPanel(data, dashResult);

    bindCashflowImportTabs(document);
  }

  function getPrimarySimulation(data) {
    const sims = data.simulations || FALLBACK_DASHBOARD.simulations || [];
    return sims[0] || null;
  }

  function renderInsightsEasy(data) {
    const m = data.metrics || {};
    const sims = data.simulations || FALLBACK_DASHBOARD.simulations || [];
    const sim = getPrimarySimulation(data);
    const impacts = sim?.impacts || [];
    const gentle = isGentleTone();
    const summary = gentle
      ? "先の見通しを、無理のない範囲で確認できます。"
      : m.status === "SAFE"
        ? "今の資金状態は安定です。"
        : "資金状態に注意が必要です。";
    const nextLine = sim
      ? gentle
        ? `例: ${shortenActionTitle(sim.title)}`
        : `次: ${shortenActionTitle(sim.title)}`
      : "試算できるシナリオがありません。";
    const primaryImpact = impacts[0] || "";

    return `
      <section class="rounded-xl card-shadow border-2 ${gentle ? "border-border-subtle" : "border-status-safe"} bg-surface-white overflow-hidden mb-md" data-acc="insights-easy-hero">
        <div class="h-1.5 ${gentle ? "bg-secondary/40" : "bg-status-safe"} w-full"></div>
        <div class="p-lg">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${gentle ? "bg-surface-container text-secondary" : "bg-status-safe/10 text-status-safe"} text-lg font-bold mb-sm">
                <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">psychology</span>
                ${gentle ? "試算" : `${m.status || "SAFE"} ${m.score || 0}`}
              </span>
              <h3 class="font-headline-md text-headline-md text-primary font-bold acc-break-words">${summary}</h3>
              <p class="text-sm font-semibold text-primary mt-sm acc-break-words">${nextLine}</p>
            </div>
            <div class="shrink-0 sm:text-right" data-acc-harsh="true">
              <p class="text-[10px] text-secondary uppercase">Runway</p>
              <p class="text-3xl font-bold text-primary">${m.runwayDays || 0}日</p>
            </div>
          </div>
        </div>
      </section>
      ${gentle ? "" : `
      <div class="grid grid-cols-3 gap-sm mb-md" data-acc="insights-kpis-easy">
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">安全度</p>
          <p class="text-lg font-bold text-primary">${m.score || 0}</p>
        </div>
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">Runway</p>
          <p class="text-lg font-bold text-status-safe">${m.runwayDays || 0}日</p>
        </div>
        <div class="bg-surface-white rounded-xl p-md text-center card-shadow border border-border-subtle">
          <p class="text-[10px] text-secondary mb-1">試算</p>
          <p class="text-lg font-bold text-primary">${sims.length}件</p>
        </div>
      </div>`}
      ${sim ? `
      <section class="bg-primary-container text-white rounded-xl p-lg mb-md card-shadow" data-acc="insights-primary-action">
        <p class="text-[10px] uppercase tracking-wider text-on-primary-container">${gentle ? "試してみる" : "いま試すこと"}</p>
        <p class="text-xl font-bold mt-1 acc-break-words">${shortenActionTitle(sim.title)}</p>
        ${primaryImpact ? `<p class="text-lg font-bold mt-2 text-status-safe">${primaryImpact}</p>` : ""}
        <button type="button" data-acc-insights-cta="preview" data-acc-insights-id="${sim.id || "primary"}" class="inline-flex items-center justify-center gap-sm mt-md bg-white text-primary px-lg py-sm rounded-xl font-bold tap-scale">結果を見る</button>
      </section>` : ""}`;
  }

  function bindInsightsCtas(data, root = document) {
    const scope = root.querySelector ? root : document;
    const sims = data.simulations || FALLBACK_DASHBOARD.simulations || [];
    const openPreview = (sim) => {
      if (!sim) return;
      showAccPreviewModal(
        `${shortenActionTitle(sim.title)}（プレビュー）`,
        sim.impacts || [sim.summary || "finance-core による What-if 試算"],
        "モック段階のシミュレーション結果です。実際の数値変更は未反映です。",
      );
    };

    scope.querySelectorAll("[data-acc-insights-cta]").forEach((btn) => {
      const id = btn.getAttribute("data-acc-insights-id");
      const sim = sims.find((s) => s.id === id) || getPrimarySimulation(data);
      btn.onclick = () => openPreview(sim);
    });
  }

  function remountInsights(data, result) {
    const easy = document.getElementById("acc-insights-easy");
    const root = document.getElementById("acc-insights-root");
    const easyOn = isEasyMode();

    if (easy) {
      easy.innerHTML = easyOn ? renderInsightsEasy(data) : "";
      easy.style.display = easyOn ? "" : "none";
    }
    if (root) root.innerHTML = renderSimulationPanel(data);
    syncPageDetailsPanel("acc-insights-details", easyOn);

    const api = document.getElementById("acc-api-status");
    if (api && result) api.innerHTML = renderApiStatus(result);

    bindInsightsCtas(data);
    bindTapScale();
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
        effect: "年末納税不足リスクを低減",
        cta: "tax-reserve",
        color: "bg-secondary",
        note: "この金額を税金用に確保したあとの手持ちです",
      },
      {
        id: "ai",
        kind: "expense",
        label: "事業投資・AI予算",
        value: aiBudget,
        detail: "余剰内で小さく試す",
        effect: "ツール・API費を計画内に収める",
        cta: "ai-dev-budget",
        color: "bg-primary",
        note: "この金額を事業投資に使ったあとの手持ちです",
      },
      {
        id: "cash",
        kind: "cash",
        label: "手元余力として残す",
        value: keepOnHand,
        detail: "安全ライン超過分の残り",
        effect: "運転資金の余力を確保",
        cta: null,
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
            <button type="button" class="acc-surplus-option text-left rounded-xl border ${selectedClass} p-md transition-all hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30" aria-pressed="${selected ? "true" : "false"}" data-surplus-option data-kind="${item.kind}" data-label="${item.label}" data-value="${item.value}" data-note="${item.note}"${item.cta ? ` data-acc-cta="${item.cta}"` : ""}>
              <div class="flex items-start justify-between gap-md">
                <div>
                  <p class="text-sm font-bold text-primary acc-break-words">${item.label}</p>
                  <p class="text-[11px] text-secondary mt-1 acc-break-words">${item.detail}</p>
                  <p class="text-[11px] text-status-safe mt-1 acc-break-words">期待効果: ${item.effect}</p>
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
          <div class="mt-md flex flex-wrap gap-md">
            <button type="button" class="text-sm font-bold text-primary border border-primary/30 px-md py-sm rounded-xl tap-scale hover:bg-primary/5" data-surplus-preview>この配分の結果をプレビュー</button>
          </div>
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

  function resolveExpectedEffect(action) {
    if (action.expectedEffect) return action.expectedEffect;
    const defaults = {
      "cancel-sub-dropbox": "年間の固定費を削減",
      "subscription-cleanup": "月間キャッシュフローを改善",
      "tax-reserve": "年末納税不足リスクを低減",
      "ai-dev-budget": "ツール・API費を計画内に収める",
      "close-gap": "安全ライン到達までの不足を解消",
      "collect-receivables": "未回収分のキャッシュを回収",
    };
    if (defaults[action.id]) return defaults[action.id];
    if (action.category === "subscription") return "経費を削減して余裕を確保";
    if (action.category === "tax") return "納税資金の不足を防ぐ";
    if (action.category === "income") return "安全ラインまでの不足を埋める";
    return "";
  }

  function actionDetailHref(action) {
    if (action.category === "subscription") return "../_8/code.html";
    if (action.category === "tax" || action.id === "ai-dev-budget") return null;
    return null;
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

  function getActivePersona() {
    const scenario = getScenarioFromUrl();
    return resolveScenarioData(scenario || "default");
  }

  function enrichDashboard(data) {
    const fb = getActivePersona();
    const apiBrief = data.brief || {};
    const fbBrief = fb.brief || {};
    return {
      ...data,
      ...fb,
      asOfMonth: fb.asOfMonth || data.asOfMonth,
      safetyBufferTarget: fb.safetyBufferTarget ?? data.safetyBufferTarget,
      revolvingDebt: fb.revolvingDebt || data.revolvingDebt,
      metrics: { ...(data.metrics || {}), ...fb.metrics },
      brief: {
        ...apiBrief,
        ...fbBrief,
        subscriptionOptimization: {
          ...(apiBrief.subscriptionOptimization || {}),
          ...(fbBrief.subscriptionOptimization || {}),
        },
        priorityActions: fbBrief.priorityActions || apiBrief.priorityActions,
        calendarMarkers: fbBrief.calendarMarkers || apiBrief.calendarMarkers,
      },
      kpis: { ...(data.kpis || {}), ...fb.kpis },
      fleetMetric: { ...(data.fleetMetric || {}), ...fb.fleetMetric },
      surplus: { ...(data.surplus || {}), ...fb.surplus },
      simulations: fb.simulations || data.simulations,
      copy: { ...(data.copy || {}), ...fb.copy },
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
          <p class="text-xs text-secondary mt-2 acc-break-words" data-acc-verbose="true">月末残高は安全ラインを${balanceVsLine}見込みです。</p>
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
              <p class="text-sm text-secondary mt-2 acc-break-words" data-acc-verbose="true">${flow.helper}</p>
            </div>
            <div class="bg-surface-container-low rounded-xl p-md min-w-[260px] border border-border-subtle" data-acc-harsh="true">
              <p class="text-[10px] text-secondary uppercase mb-1">月末残高</p>
              <p class="text-3xl font-bold text-primary">${formatYen(flow.projectedBalance)}</p>
              <p class="text-xs ${s.text} font-semibold mt-2 acc-break-words">${balanceText}</p>
              <p class="text-[10px] text-secondary mt-1 acc-break-words" data-acc-verbose="true">安全ライン: ${formatYen(flow.safetyBufferTarget)}</p>
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
    const primaryCtaKey = isSafe ? "tax-reserve" : "primary-action";
    const secondaryCtaKey = isSafe ? "ai-dev-budget" : "details";
    const safeReasons = isSafe
      ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-sm mb-lg text-sm">
          <p class="text-on-primary-fixed/90 acc-break-words" data-acc-verbose="true"><span class="text-white font-semibold">税金積立:</span> 今月収入の10% → 年末不足リスクを低減</p>
          <p class="text-on-primary-fixed/90 acc-break-words" data-acc-verbose="true"><span class="text-white font-semibold">AI開発予算:</span> 余剰から今月 ¥${(s.aiDevBudgetSuggested || 0).toLocaleString("ja-JP")} → ツール費を計画内に</p>
        </div>`
      : "";

    return `
      <section class="bg-primary-container text-on-primary rounded-xl p-lg mb-md relative overflow-hidden card-shadow" data-acc="commander-brief">
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-md">
            <span class="material-symbols-outlined text-secondary-fixed" style="font-variation-settings:'FILL' 1">${isSafe ? "savings" : "auto_awesome"}</span>
            <h3 class="font-headline-md text-headline-md text-white font-bold">Commander Brief</h3>
            <span class="ml-auto text-[10px] uppercase tracking-wider bg-white/10 px-2 py-1 rounded-full">${copy.usedFallback ? "Rule-based" : "AI polished"}</span>
          </div>
          <p class="text-lg font-bold text-white mb-2 acc-break-words">${title}</p>
          <p class="text-body-md text-on-primary-fixed leading-relaxed max-w-3xl mb-md acc-break-words" data-acc-verbose="true">${body}</p>
          ${safeReasons}
          <div class="flex flex-wrap gap-md">
            <button type="button" data-acc-cta="${primaryCtaKey}" class="bg-on-secondary text-primary px-lg py-sm rounded-xl font-bold tap-scale hover:scale-[1.02] transition-all">${primaryCta}</button>
            <button type="button" data-acc-cta="${secondaryCtaKey}" class="border border-on-primary-container text-white px-lg py-sm rounded-xl font-bold tap-scale hover:bg-primary/50 transition-all">${secondaryCta}</button>
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
        <p class="text-[10px] text-secondary mt-1 acc-break-words" data-acc-verbose="true">FleetMetric Pro 同期</p>
      </div>
      <div class="${card.replace("border-primary", "border-status-caution")}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">確定支出 <span class="normal-case">(${PERIOD_LABEL[expensePeriod]})</span></p>
        <p class="text-lg font-bold text-primary">${formatMoneyWithPeriod(k.confirmedExpenses, expensePeriod)}</p>
      </div>
      <div class="${card.replace("border-primary", flow.incomeExpenseDelta >= 0 ? "border-status-safe" : "border-status-danger")}">
        <p class="text-label-md text-secondary mb-1 uppercase text-[10px]">収支</p>
        <p class="text-lg font-bold ${flow.incomeExpenseDelta >= 0 ? "text-status-safe" : "text-status-danger"}">${formatYen(flow.incomeExpenseDelta)}</p>
        <p class="text-[10px] text-secondary mt-1 acc-break-words" data-acc-verbose="true">収入 − 支出</p>
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
        const effect = resolveExpectedEffect(a);
        const href = actionDetailHref(a);
        const tag = href ? "a" : "div";
        const hrefAttr = href ? ` href="${href}"` : "";
        return `
        <${tag}${hrefAttr} class="group block p-md border border-border-subtle rounded-xl hover:${border} hover:bg-surface-container-low transition-all cursor-pointer border-l-4 ${border}">
          <div class="flex items-start gap-md">
            <div class="w-8 h-8 bg-surface-container rounded-lg flex items-center justify-center shrink-0 font-bold text-xs text-primary">${a.priority}</div>
            <div class="flex-1">
              <p class="text-sm font-bold text-primary">${a.title}</p>
              <p class="text-xs text-secondary mt-1">${a.templateReason}</p>
              ${effect ? `<p class="text-xs text-status-safe mt-1">期待効果: ${effect}</p>` : ""}
              ${impact.amount > 0 ? `<p class="text-xs font-bold text-primary mt-1">${formatMoneyWithPeriod(impact.amount, impact.period)}</p>` : ""}
              ${impact.sub ? `<p class="text-[10px] text-secondary mt-0.5">${impact.sub}</p>` : ""}
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-primary text-sm">chevron_right</span>
          </div>
        </${tag}>`;
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
        <button type="button" data-acc-insights-cta="preview" data-acc-insights-id="${sim.id || ""}" class="mt-auto text-sm font-bold text-primary flex items-center gap-1 tap-scale">詳細シミュレーション <span class="material-symbols-outlined text-sm">chevron_right</span></button>
      </article>`;
      })
      .join("");

    return `
      <div data-acc="simulation-panel">
        <header class="mb-lg">
          <p class="text-label-md text-secondary uppercase mb-1">What-if Simulation</p>
          <h2 class="font-headline-lg text-headline-lg text-primary font-bold">未来のシミュレーション</h2>
          <p class="text-secondary text-sm mt-2 acc-break-words" data-acc-verbose="true">Before / After 比較 — 現状 ${m.status} ${m.score}/100 · Runway ${m.runwayDays}日</p>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">${cards}</div>
        <p class="text-[10px] text-secondary mt-lg text-center italic" data-acc-verbose="true">計算: finance-core (Layer 1) — FleetMetric Pro 稼働シミュレーション含む</p>
      </div>`;
  }

  /** Dashboard content orchestrator */
  function renderDashboardContent(data, compact) {
    if (!compact && isEasyMode()) {
      return renderDashboardEasy(data);
    }
    const hero = renderSafetyHero(data, compact);
    const core = hero + renderSecondaryKpis(data, compact) + renderBalanceBridge(data) + renderSurplusBrief(data);
    if (compact) {
      return core + `<section class="bg-surface-white p-4 rounded-xl shadow-sm mt-4 mb-4">${renderTopActions(data)}</section>`;
    }
    const monthRef = (data.asOfMonth || "2026-06") + "-15";
    return (
      core +
      `<div class="grid grid-cols-1 lg:grid-cols-3 gap-xl mt-md">
        <div class="lg:col-span-2 bg-surface-white rounded-xl card-shadow p-lg">${renderActionCalendar(data, monthRef)}</div>
        <div class="bg-surface-white rounded-xl card-shadow p-lg">${renderTopActions(data)}</div>
      </div>`
    );
  }

  function syncSidebarAccessibility(sidebar, isOpen) {
    if (!sidebar) return;
    const isMobile = window.innerWidth <= 767;
    const trapFocus = isMobile && !isOpen;
    const focusables = sidebar.querySelectorAll("a, button, input, select, textarea, [tabindex]");

    if (trapFocus) {
      sidebar.setAttribute("aria-hidden", "true");
      if ("inert" in HTMLElement.prototype) sidebar.inert = true;
      focusables.forEach((el) => {
        if (!el.dataset.accPrevTabindex) {
          el.dataset.accPrevTabindex = el.getAttribute("tabindex") ?? "";
        }
        el.setAttribute("tabindex", "-1");
      });
    } else {
      sidebar.removeAttribute("aria-hidden");
      if ("inert" in HTMLElement.prototype) sidebar.inert = false;
      focusables.forEach((el) => {
        if (el.dataset.accPrevTabindex !== undefined) {
          const prev = el.dataset.accPrevTabindex;
          if (prev) el.setAttribute("tabindex", prev);
          else el.removeAttribute("tabindex");
          delete el.dataset.accPrevTabindex;
        }
      });
    }
  }

  function setCopyDensity(mode, options = {}) {
    const { silent = false } = options;
    const easy = mode === "easy";
    document.body.classList.toggle("acc-easy", easy);
    try {
      localStorage.setItem("acc-copy-density", easy ? "easy" : "normal");
    } catch (_) {
      // ignore storage errors
    }
    syncDisplayOptionsMenu();
    if (!silent && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("acc-density-change"));
    }
  }

  function setGentleTone(on, options = {}) {
    const { silent = false } = options;
    document.body.classList.toggle("acc-gentle", on);
    try {
      localStorage.setItem("acc-gentle-tone", on ? "on" : "off");
    } catch (_) {
      // ignore storage errors
    }
    syncDisplayOptionsMenu();
    if (!silent && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("acc-gentle-change"));
    }
  }

  function closeDisplayOptionsMenu() {
    const panel = document.getElementById("acc-display-menu-panel");
    const trigger = document.getElementById("acc-display-menu-trigger");
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function syncDisplayOptionsMenu() {
    const menu = document.getElementById("acc-display-menu");
    if (!menu) return;

    const easy = document.body.classList.contains("acc-easy");
    const gentle = document.body.classList.contains("acc-gentle");

    menu.querySelectorAll('[data-acc-display-opt="density"]').forEach((el) => {
      const selected = el.dataset.value === (easy ? "easy" : "normal");
      el.setAttribute("aria-checked", selected ? "true" : "false");
      el.classList.toggle("is-active", selected);
    });

    const gentleEl = menu.querySelector('[data-acc-display-opt="gentle"]');
    if (gentleEl) {
      gentleEl.setAttribute("aria-checked", gentle ? "true" : "false");
      gentleEl.classList.toggle("is-active", gentle);
    }
  }

  function ensureTopbarActions(topbar) {
    let right = topbar.querySelector(".acc-topbar-actions");
    if (!right) {
      const children = Array.from(topbar.children);
      const anchor = children[children.length - 1];
      right = anchor instanceof HTMLElement && anchor.tagName === "DIV" ? anchor : null;
      if (!right) {
        right = document.createElement("div");
        right.className = "flex items-center gap-2 acc-topbar-actions";
        topbar.appendChild(right);
      } else {
        right.classList.add("acc-topbar-actions", "flex", "items-center", "gap-2");
      }
    }
    return right;
  }

  function initDisplayOptionsMenu() {
    const topbar = document.querySelector(".acc-topbar");
    if (!topbar) return;
    if (document.getElementById("acc-display-menu")) {
      syncDisplayOptionsMenu();
      return;
    }

    document.getElementById("acc-density-toggle")?.remove();
    document.getElementById("acc-gentle-toggle")?.remove();

    const right = ensureTopbarActions(topbar);
    const menu = document.createElement("div");
    menu.id = "acc-display-menu";
    menu.className = "acc-display-menu";
    menu.innerHTML = `
      <button
        type="button"
        id="acc-display-menu-trigger"
        class="acc-display-menu-trigger"
        aria-haspopup="menu"
        aria-expanded="false"
        aria-controls="acc-display-menu-panel"
      >
        <span class="material-symbols-outlined acc-display-menu-icon" aria-hidden="true">tune</span>
        <span class="acc-display-menu-label">表示</span>
        <span class="material-symbols-outlined acc-display-menu-chevron" aria-hidden="true">expand_more</span>
      </button>
      <div id="acc-display-menu-panel" class="acc-display-menu-panel" role="menu" hidden>
        <p class="acc-display-menu-heading" role="presentation">レイアウト</p>
        <button type="button" role="menuitemradio" class="acc-display-menu-item" data-acc-display-opt="density" data-value="easy" aria-checked="false">
          <span class="material-symbols-outlined" aria-hidden="true">view_compact</span>
          かんたん表示
        </button>
        <button type="button" role="menuitemradio" class="acc-display-menu-item" data-acc-display-opt="density" data-value="normal" aria-checked="false">
          <span class="material-symbols-outlined" aria-hidden="true">view_agenda</span>
          通常表示
        </button>
        <p class="acc-display-menu-heading acc-display-menu-heading-divider" role="presentation">トーン</p>
        <button type="button" role="menuitemcheckbox" class="acc-display-menu-item" data-acc-display-opt="gentle" aria-checked="false">
          <span class="material-symbols-outlined" aria-hidden="true">self_improvement</span>
          やさしい表示
        </button>
      </div>`;

    right.insertBefore(menu, right.firstChild);

    const trigger = menu.querySelector("#acc-display-menu-trigger");
    const panel = menu.querySelector("#acc-display-menu-panel");

    trigger?.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = panel?.hidden !== false;
      if (open) {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
      } else {
        closeDisplayOptionsMenu();
      }
    });

    menu.querySelectorAll("[data-acc-display-opt]").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const opt = item.dataset.accDisplayOpt;
        if (opt === "density") {
          setCopyDensity(item.dataset.value === "easy" ? "easy" : "normal");
        } else if (opt === "gentle") {
          setGentleTone(!document.body.classList.contains("acc-gentle"));
        }
        closeDisplayOptionsMenu();
      });
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) closeDisplayOptionsMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDisplayOptionsMenu();
    });

    let savedDensity = "easy";
    let savedGentle = "on";
    try {
      savedDensity = localStorage.getItem("acc-copy-density") || "easy";
      savedGentle = localStorage.getItem("acc-gentle-tone") ?? "on";
    } catch (_) {
      savedDensity = "easy";
      savedGentle = "on";
    }
    setGentleTone(savedGentle !== "off", { silent: true });
    setCopyDensity(savedDensity, { silent: true });
    syncDisplayOptionsMenu();
  }

  function initResponsiveShell() {
    const sidebar = document.getElementById("acc-sidebar");
    const toggle = document.getElementById("acc-menu-toggle");
    const backdrop = document.getElementById("acc-sidebar-backdrop");
    if (!sidebar || !toggle) return;

    if (!toggle.getAttribute("aria-label")) {
      toggle.setAttribute("aria-label", "メニュー");
    }
    sidebar.setAttribute("aria-label", "補助メニュー");

    function close() {
      sidebar.classList.remove("is-open");
      backdrop?.classList.add("hidden");
      syncSidebarAccessibility(sidebar, false);
    }

    function open() {
      sidebar.classList.add("is-open");
      backdrop?.classList.remove("hidden");
      syncSidebarAccessibility(sidebar, true);
    }

    toggle.addEventListener("click", () => {
      if (sidebar.classList.contains("is-open")) close();
      else open();
    });
    backdrop?.addEventListener("click", close);
    window.addEventListener("resize", () => {
      if (window.innerWidth > 767) close();
      else syncSidebarAccessibility(sidebar, sidebar.classList.contains("is-open"));
    });
    syncSidebarAccessibility(sidebar, false);
    initDisplayOptionsMenu();
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
    const gentle = isGentleTone();
    return `<div class="px-2 mb-4" data-acc="sidebar-status">
      <div class="text-label-md text-secondary mb-1 uppercase text-[10px]">${gentle ? "今月" : "今月の収支"}</div>
      <span class="inline-flex items-center gap-1 ${s.text} font-bold text-sm">${flow.status}</span>
      <div class="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden" data-acc-harsh="true">
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

  function ensureAccPreviewModal() {
    let modal = document.getElementById("acc-cta-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "acc-cta-modal";
    modal.className = "hidden fixed inset-0 z-50 flex items-center justify-center p-4";
    modal.innerHTML = `
      <div class="absolute inset-0 bg-black/40" data-acc-cta-dismiss></div>
      <div class="relative bg-surface-white rounded-xl shadow-xl max-w-md w-full p-lg card-shadow" role="dialog" aria-modal="true">
        <h4 class="font-bold text-primary text-lg mb-md" data-acc-cta-modal-title></h4>
        <ul class="space-y-2 text-sm text-secondary mb-lg" data-acc-cta-modal-body></ul>
        <p class="text-[10px] text-secondary mb-md" data-acc-cta-modal-note>モック段階の結果プレビューです。実際の振替・予算確保は未実行です。</p>
        <button type="button" class="w-full bg-primary text-white py-sm rounded-xl font-bold tap-scale" data-acc-cta-dismiss>閉じる</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-acc-cta-dismiss]").forEach((el) => {
      el.addEventListener("click", () => modal.classList.add("hidden"));
    });
    return modal;
  }

  function showAccPreviewModal(title, lines, disclaimer) {
    const modal = ensureAccPreviewModal();
    const titleEl = modal.querySelector("[data-acc-cta-modal-title]");
    const bodyEl = modal.querySelector("[data-acc-cta-modal-body]");
    const noteEl = modal.querySelector("[data-acc-cta-modal-note]");
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) {
      bodyEl.innerHTML = (lines || [])
        .filter(Boolean)
        .map((line) => `<li class="acc-break-words">• ${line}</li>`)
        .join("");
    }
    if (noteEl && disclaimer) noteEl.textContent = disclaimer;
    modal.classList.remove("hidden");
  }

  const CASHFLOW_IMPORT_MODES = {
    csv: {
      title: "銀行明細CSVをドロップ",
      description: "口座の取引CSVをアップロードすると、支出・収入を自動分類します",
      formats: "Supports: CSV",
      icon: "cloud_upload",
      cta: "CSVを解析する",
      dropMessage: "CSVは /api/import/csv で解析（LLM不使用）",
      hints: ["csv"],
      status: "銀行明細モード — 複数口座の合算にも対応",
    },
    ss: {
      title: "領収書・明細画像をドロップ",
      description: "カメラで撮影した領収書や、PDFのレシートをアップロードしてください",
      formats: "Supports: JPG, PNG, PDF",
      icon: "photo_camera",
      cta: "画像をスキャンする",
      dropMessage: "OCRで日付・金額・店名を抽出（モック）",
      hints: ["ss"],
      status: "スクリーンショットモード — 金額・日付・店名をOCR抽出",
    },
    ai: {
      title: "AIが明細を自動読取",
      description: "銀行アプリのスクショやメール請求書をAIが解析し、取引候補を生成します",
      formats: "Supports: JPG, PNG, PDF, HEIC",
      icon: "document_scanner",
      cta: "AIスキャンを開始",
      dropMessage: "AIスキャンは候補を生成後、承認待ち一覧に追加（モック）",
      hints: ["ss", "ai"],
      status: "AIスキャンモード — 低信頼度の候補は承認待ちに回します",
    },
  };

  function bindCashflowImportTabs(root = document) {
    const scope = root.querySelector ? root : document;
    const panel = scope.querySelector("[data-acc-import-panel]");
    const tabs = scope.querySelectorAll("[data-acc-import-tab]");
    if (!panel || !tabs.length) return;

    const titleEl = panel.querySelector("[data-import-title]");
    const descEl = panel.querySelector("[data-import-description]");
    const formatsEl = panel.querySelector("[data-import-formats]");
    const iconEl = panel.querySelector("[data-import-icon]");
    const statusEl = scope.querySelector("[data-import-status]");
    const ctaEl = scope.querySelector("[data-import-cta]");
    const dropzone = panel.querySelector("#dropzone") || panel.querySelector("[data-import-dropzone]");
    const hintCards = scope.querySelectorAll("[data-import-hint]");
    let currentMode = "csv";

    function applyMode(modeId) {
      const mode = CASHFLOW_IMPORT_MODES[modeId];
      if (!mode) return;
      currentMode = modeId;

      tabs.forEach((tab) => {
        const active = tab.getAttribute("data-acc-import-tab") === modeId;
        tab.classList.toggle("tab-active", active);
        tab.classList.toggle("text-primary", active);
        tab.classList.toggle("text-secondary", !active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });

      if (titleEl) titleEl.textContent = mode.title;
      if (descEl) descEl.textContent = mode.description;
      if (formatsEl) formatsEl.textContent = mode.formats;
      if (iconEl) iconEl.textContent = mode.icon;
      if (statusEl) statusEl.textContent = mode.status;
      if (ctaEl) {
        const label = ctaEl.querySelector("[data-import-cta-label]");
        if (label) label.textContent = mode.cta;
      }

      hintCards.forEach((card) => {
        const hints = (card.getAttribute("data-import-hint") || "").split(/\s+/);
        const on = mode.hints.some((h) => hints.includes(h));
        card.classList.toggle("ring-2", on);
        card.classList.toggle("ring-primary/30", on);
        card.classList.toggle("bg-surface-container-lowest", on);
      });

      if (dropzone) {
        dropzone.style.opacity = "0";
        setTimeout(() => { dropzone.style.opacity = "1"; }, 100);
      }
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => applyMode(tab.getAttribute("data-acc-import-tab")));
    });

    if (dropzone) {
      const showDropFeedback = (e) => {
        e.preventDefault();
        dropzone.classList.remove("bg-primary-fixed/20");
        showAccPreviewModal(
          `${CASHFLOW_IMPORT_MODES[currentMode].cta}（プレビュー）`,
          [
            CASHFLOW_IMPORT_MODES[currentMode].dropMessage,
            "解析後は下の「承認待ちの取引明細」に候補が追加されます",
            "モック段階のため実際の取込は行われません",
          ],
          "モック段階の取込プレビューです。実際のファイル解析は未実行です。",
        );
      };
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("bg-primary-fixed/20");
      });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("bg-primary-fixed/20"));
      dropzone.addEventListener("drop", showDropFeedback);
      dropzone.addEventListener("click", showDropFeedback);
    }

    if (ctaEl) {
      ctaEl.addEventListener("click", () => {
        const mode = CASHFLOW_IMPORT_MODES[currentMode];
        showAccPreviewModal(
          `${mode.cta}（プレビュー）`,
          [mode.status, mode.dropMessage, "完了後は承認待ち一覧で確認・承認できます"],
          "モック段階の結果プレビューです。",
        );
      });
    }

    applyMode(currentMode);
  }

  function bindSubscriptionsCtas(data, root = document) {
    const scope = root.querySelector ? root : document;
    const opt = data.brief?.subscriptionOptimization;
    if (!opt) return;

    const auditBtn = scope.querySelector("[data-acc-subs-cta='audit-report']");
    const cleanupBtn = scope.querySelector("[data-acc-subs-cta='bulk-cleanup']");
    const candidates = opt.candidates || [];

    if (auditBtn) {
      auditBtn.onclick = () => {
        const lines = [
          `${candidates.length}件の解約候補を検出（推定 ${formatYen(opt.monthlySavingPotential)}/月 · ${formatYen(opt.yearlySavingPotential)}/年）`,
          ...candidates.map(
            (c, i) => `${i + 1}. ${c.name}: ${formatYen(c.yearlySaving)}/年 — ${c.reason}`,
          ),
          ...(opt.keepRecommendations || []).map((k) => `維持推奨: ${k.name} — ${k.reason}`),
        ];
        showAccPreviewModal(
          "サブスク監査レポート（プレビュー）",
          lines,
          "モック段階の監査レポートです。実際の解約・変更は未実行です。",
        );
      };
    }

    if (cleanupBtn) {
      cleanupBtn.onclick = () => {
        showAccPreviewModal(
          "一括クリーンアップ（プレビュー）",
          [
            `対象: ${candidates.map((c) => c.name).join("、") || "解約候補なし"}`,
            `想定削減: ${formatYen(opt.monthlySavingPotential)}/月（${formatYen(opt.yearlySavingPotential)}/年）`,
            "実行前に各サービスの代替手段・データ移行を確認してください",
            "完了後はダッシュボードの固定費とRunwayが更新されます（モック）",
          ],
          "モック段階の一括処理プレビューです。実際の解約は未実行です。",
        );
      };
    }
  }

  function bindDashboardCtas(data, root = document) {
    const scope = root.querySelector ? root : document;
    const buttons = scope.querySelectorAll("[data-acc-cta]");
    if (!buttons.length) return;

    const s = data.surplus || {};
    const b = data.brief || {};
    const primary = b.primaryAction;
    const previews = {
      "tax-reserve": {
        title: "税金積立を開始（プレビュー）",
        lines: [
          `納税準備口座へ ${formatMoneyWithPeriod(s.taxReserveSuggested || 0, "monthly")} を振替予定`,
          "年末納税不足リスク: 中 → 低",
          "実行後も月末残高は安全ラインを上回る見込み",
        ],
      },
      "ai-dev-budget": {
        title: "AI開発予算を確保（プレビュー）",
        lines: [
          `ツール・API予算に ${formatMoneyWithPeriod(s.aiDevBudgetSuggested || 0, "monthly")} を確保`,
          "今月の開発・運用費を計画内に収められます",
          "余剰金からの配分 — いつでも配分を変更可能",
        ],
      },
      "primary-action": {
        title: "推奨アクションを実行（プレビュー）",
        lines: [
          primary ? primary.title : "最優先アクションを実行",
          primary?.templateReason || b.gapMessage || "",
          primary?.impactYen ? `影響額: ${formatYen(primary.impactYen)}` : "",
        ].filter(Boolean),
      },
      details: {
        title: "詳細を見る（プレビュー）",
        lines: [
          b.gapMessage || "安全状態の詳細を確認",
          b.workDaysMessage || "",
          "Cashflow / Subscriptions 画面で内訳を確認できます",
        ].filter(Boolean),
      },
    };

    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (btn.hasAttribute("data-surplus-option")) return;
        const key = btn.getAttribute("data-acc-cta");
        const preview = previews[key];
        if (!preview) return;
        e.preventDefault();
        e.stopPropagation();
        showAccPreviewModal(preview.title, preview.lines);
      });
    });

    const previewBtn = scope.querySelector("[data-surplus-preview]");
    if (previewBtn) {
      previewBtn.addEventListener("click", () => {
        const active = scope.querySelector("[data-surplus-option][aria-pressed='true']");
        const key = active?.getAttribute("data-acc-cta");
        if (!key) return;
        const preview = previews[key];
        if (!preview) return;
        showAccPreviewModal(preview.title, preview.lines);
      });
    }
  }

  /** Embedded fallback — mirrors finance-core sample output when API offline */
  const FALLBACK_DASHBOARD = {
      "asOfMonth": "2026-06",
      "safetyBufferTarget": 50000,
      "revolvingDebt": {
          "balance": 480000,
          "minimumPayment": 28000,
          "aprPercent": 15
      },
      "metrics": {
          "status": "DANGER",
          "score": 24,
          "gapToSafety": 41500,
          "runwayDays": 6,
          "safeUntilDate": "2026-06-28",
          "projectedBalanceAfterPayments": 8500,
          "monthlyBurnRate": 198000
      },
      "brief": {
          "status": "DANGER",
          "score": 24,
          "gapToSafety": 41500,
          "gapWorkDays": 0,
          "runwayDays": 6,
          "safeUntilDate": "2026-06-28",
          "gapMessage": "あと ¥41,500 で最低ラインです",
          "workDaysMessage": "給料日前後は新規の出費を控えてください",
          "primaryAction": {
              "priority": 1,
              "id": "revo-extra-payment",
              "title": "カードリボの返済を月 ¥5,000 増やす",
              "impactYen": 5000,
              "impactPeriod": "monthly",
              "category": "debt",
              "templateReason": "残高 ¥48万・金利15% — 最低返済のままだと減りません"
          },
          "priorityActions": [
              {
                  "priority": 1,
                  "id": "revo-extra-payment",
                  "title": "カードリボの返済を月 ¥5,000 増やす",
                  "impactYen": 5000,
                  "impactPeriod": "monthly",
                  "category": "debt",
                  "templateReason": "残高 ¥48万・金利15% — 最低返済のままだと減りません",
                  "expectedEffect": "利息の増え方を抑え、Runwayを延ばす"
              },
              {
                  "priority": 2,
                  "id": "subscription-cleanup",
                  "title": "Netflix・Spotify を解約（月 ¥2,470 削減）",
                  "impactYen": 2470,
                  "impactPeriod": "monthly",
                  "category": "subscription",
                  "templateReason": "生活必需品ではないサブスクを2件検出",
                  "expectedEffect": "今月の現金不足を少し埋める"
              },
              {
                  "priority": 3,
                  "id": "cut-variable-spend",
                  "title": "来週の食費・外食を ¥3,000 抑える",
                  "impactYen": 3000,
                  "impactPeriod": "monthly",
                  "category": "expense",
                  "templateReason": "給料日まであと3日 — 現金が足りない見込み",
                  "expectedEffect": "口座残高の底割りを防ぐ"
              }
          ],
          "subscriptionOptimization": {
              "monthlySubsTotal": 2870,
              "monthlySavingPotential": 2470,
              "yearlySavingPotential": 29640,
              "candidates": [
                  {
                      "subscriptionId": "sub-netflix",
                      "name": "Netflix",
                      "monthlyCost": 1490,
                      "yearlySaving": 17880,
                      "reason": "今月の視聴は2時間のみ — 解約しても生活に影響小",
                      "priority": 1
                  },
                  {
                      "subscriptionId": "sub-spotify",
                      "name": "Spotify",
                      "monthlyCost": 980,
                      "yearlySaving": 11760,
                      "reason": "無料プランで代替可能",
                      "priority": 2
                  }
              ],
              "keepRecommendations": [
                  {
                      "name": "iCloud+ 200GB",
                      "reason": "写真・書類のバックアップ用 — 月¥400のみ"
                  }
              ]
          },
          "calendarMarkers": [
              {
                  "date": "2026-06-22",
                  "type": "danger",
                  "label": "残高 ¥8,500 — 要注意",
                  "countdownDays": 0,
                  "amount": 8500
              },
              {
                  "date": "2026-06-25",
                  "type": "income",
                  "label": "給与入金 ¥185,000",
                  "countdownDays": 3,
                  "amount": 185000
              },
              {
                  "date": "2026-06-26",
                  "type": "bill",
                  "label": "車ローン ¥15,000",
                  "countdownDays": 4,
                  "amount": 15000
              },
              {
                  "date": "2026-06-28",
                  "type": "danger",
                  "label": "カード引落（リボ）¥28,000",
                  "countdownDays": 6,
                  "amount": 28000
              }
          ],
          "paymentWarnings": [
              {
                  "message": "リボ残高が先月より ¥12,000 増加",
                  "severity": "high"
              }
          ],
          "nextBigPayment": {
              "name": "カード引落（リボ）",
              "daysUntil": 6,
              "amount": 28000
          }
      },
      "kpis": {
          "projectedIncome": 185000,
          "projectedIncomePeriod": "monthly",
          "confirmedExpenses": 198000,
          "confirmedExpensesPeriod": "monthly",
          "projectedBalance": 8500,
          "projectedBalancePeriod": "balance"
      },
      "fleetMetric": {
          "lastSync": "2026-06-15T22:34:00",
          "syncCount": 1,
          "status": "normal",
          "syncMethod": "給与明細",
          "monthlyRevenueSynced": 185000,
          "recommendedWorkDays": 0
      },
      "surplus": {
          "amount": 0,
          "amountPeriod": "balance",
          "investmentCandidate": 0,
          "investmentCandidatePeriod": "monthly",
          "taxReserveSuggested": 0,
          "taxReserveSuggestedPeriod": "monthly",
          "aiDevBudgetSuggested": 0,
          "aiDevBudgetSuggestedPeriod": "monthly"
      },
      "simulations": [
          {
              "id": "revo-extra-5k",
              "title": "リボ返済を月 ¥5,000 増やした場合",
              "summary": "最低返済から少し増やし、利息の膨らみを抑える",
              "before": {
                  "safety": 24,
                  "runway": 6,
                  "surplus": 0
              },
              "after": {
                  "safety": 31,
                  "runway": 11,
                  "surplus": 0
              },
              "impacts": [
                  "利息の増加を抑制",
                  "Runway: 6日 → 11日",
                  "完済までの期間が短縮"
              ]
          },
          {
              "id": "cancel-streaming",
              "title": "Netflix・Spotify を解約した場合",
              "summary": "生活に必須でないサブスクを2件やめる",
              "before": {
                  "safety": 24,
                  "runway": 6,
                  "surplus": 0
              },
              "after": {
                  "safety": 28,
                  "runway": 8,
                  "surplus": 0
              },
              "impacts": [
                  "月 ¥2,470 削減",
                  "Runway: 6日 → 8日",
                  "来月の引落負担が軽くなる"
              ]
          },
          {
              "id": "cut-food-10k",
              "title": "来月の食費・外食を ¥10,000 抑えた場合",
              "summary": "コンビニ・外食を我慢して現金を残す",
              "before": {
                  "safety": 24,
                  "runway": 6,
                  "surplus": 0
              },
              "after": {
                  "safety": 30,
                  "runway": 9,
                  "surplus": 0
              },
              "impacts": [
                  "現金不足を回避",
                  "Runway: 6日 → 9日",
                  "リボへの回しが減る"
              ]
          }
      ],
      "copy": {
          "adviceText": "貯金はほぼありません。リボ残高 ¥48万の利息が毎月の負けです。まず最低返済から少しでも増やすのが近道です。",
          "priorityActionsText": [
              "カードリボの返済を月 ¥5,000 増やす",
              "Netflix・Spotify を解約（月 ¥2,470 削減）",
              "来週の食費・外食を ¥3,000 抑える"
          ],
          "subscriptionComment": "車ローン ¥15,000/月は維持が必要。削れるのはサブスクから",
          "usedFallback": true
      }
  };

  const CAUTION_FALLBACK = {
      "asOfMonth": "2026-06",
      "safetyBufferTarget": 50000,
      "revolvingDebt": {
          "balance": 465000,
          "minimumPayment": 27000,
          "aprPercent": 15
      },
      "metrics": {
          "status": "CAUTION",
          "score": 52,
          "gapToSafety": 22000,
          "runwayDays": 12,
          "safeUntilDate": "2026-07-04",
          "projectedBalanceAfterPayments": 28000,
          "monthlyBurnRate": 193000
      },
      "brief": {
          "status": "CAUTION",
          "score": 52,
          "gapToSafety": 22000,
          "gapWorkDays": 0,
          "runwayDays": 12,
          "safeUntilDate": "2026-07-04",
          "gapMessage": "あと ¥22,000 で最低ラインです",
          "workDaysMessage": "食費とサブスクの見直しを続けてください",
          "primaryAction": {
              "priority": 1,
              "id": "cancel-spotify",
              "title": "Spotify を解約（月 ¥980 削減）",
              "impactYen": 980,
              "impactPeriod": "monthly",
              "category": "subscription",
              "templateReason": "Netflix 解約後も支出が収入を上回っています"
          },
          "priorityActions": [
              {
                  "priority": 1,
                  "id": "cancel-spotify",
                  "title": "Spotify を解約（月 ¥980 削減）",
                  "impactYen": 980,
                  "impactPeriod": "monthly",
                  "category": "subscription",
                  "templateReason": "無料プランで代替可能",
                  "expectedEffect": "来月の黒字化に一歩近づく"
              },
              {
                  "priority": 2,
                  "id": "revo-extra-payment",
                  "title": "リボ返済を月 ¥3,000 増やす",
                  "impactYen": 3000,
                  "impactPeriod": "monthly",
                  "category": "debt",
                  "templateReason": "残高 ¥46.5万 — 利息の膨らみを抑える",
                  "expectedEffect": "完済までの期間を短縮"
              },
              {
                  "priority": 3,
                  "id": "cut-variable-spend",
                  "title": "外食を今週 ¥2,000 抑える",
                  "impactYen": 2000,
                  "impactPeriod": "monthly",
                  "category": "expense",
                  "templateReason": "給料日まであと10日",
                  "expectedEffect": "口座残高の底割りを防ぐ"
              }
          ],
          "subscriptionOptimization": {
              "monthlySubsTotal": 1380,
              "monthlySavingPotential": 980,
              "yearlySavingPotential": 11760,
              "candidates": [
                  {
                      "subscriptionId": "sub-spotify",
                      "name": "Spotify",
                      "monthlyCost": 980,
                      "yearlySaving": 11760,
                      "reason": "無料プランで代替可能",
                      "priority": 2
                  }
              ],
              "keepRecommendations": [
                  {
                      "name": "iCloud+ 200GB",
                      "reason": "写真・書類のバックアップ用 — 月¥400のみ"
                  }
              ]
          },
          "calendarMarkers": [
              {
                  "date": "2026-06-25",
                  "type": "income",
                  "label": "給与入金 ¥185,000",
                  "countdownDays": 3,
                  "amount": 185000
              },
              {
                  "date": "2026-06-26",
                  "type": "bill",
                  "label": "車ローン ¥15,000",
                  "countdownDays": 4,
                  "amount": 15000
              },
              {
                  "date": "2026-07-04",
                  "type": "bill",
                  "label": "カード引落（リボ）¥27,000",
                  "countdownDays": 12,
                  "amount": 27000
              }
          ],
          "paymentWarnings": [
              {
                  "message": "Netflix 解約済み — 次は Spotify",
                  "severity": "medium"
              }
          ],
          "nextBigPayment": {
              "name": "カード引落（リボ）",
              "daysUntil": 12,
              "amount": 27000
          }
      },
      "kpis": {
          "projectedIncome": 185000,
          "projectedIncomePeriod": "monthly",
          "confirmedExpenses": 193000,
          "confirmedExpensesPeriod": "monthly",
          "projectedBalance": 28000,
          "projectedBalancePeriod": "balance"
      },
      "fleetMetric": {
          "lastSync": "2026-06-15T22:34:00",
          "syncCount": 1,
          "status": "normal",
          "syncMethod": "給与明細",
          "monthlyRevenueSynced": 185000,
          "recommendedWorkDays": 0
      },
      "surplus": {
          "amount": 0,
          "amountPeriod": "balance",
          "investmentCandidate": 0,
          "investmentCandidatePeriod": "monthly",
          "taxReserveSuggested": 0,
          "taxReserveSuggestedPeriod": "monthly",
          "aiDevBudgetSuggested": 0,
          "aiDevBudgetSuggestedPeriod": "monthly"
      },
      "simulations": [
          {
              "id": "cancel-spotify",
              "title": "Spotify を解約した場合",
              "summary": "音楽サブスクを無料プランに切り替え",
              "before": {
                  "safety": 52,
                  "runway": 12,
                  "surplus": 0
              },
              "after": {
                  "safety": 58,
                  "runway": 14,
                  "surplus": 0
              },
              "impacts": [
                  "月 ¥980 削減",
                  "Runway: 12日 → 14日",
                  "来月の収支が改善"
              ]
          },
          {
              "id": "revo-extra-3k",
              "title": "リボ返済を月 ¥3,000 増やした場合",
              "summary": "利息の増え方を抑える",
              "before": {
                  "safety": 52,
                  "runway": 12,
                  "surplus": 0
              },
              "after": {
                  "safety": 56,
                  "runway": 15,
                  "surplus": 0
              },
              "impacts": [
                  "利息の増加を抑制",
                  "Runway: 12日 → 15日"
              ]
          },
          {
              "id": "cut-food-5k",
              "title": "食費・外食を ¥5,000 抑えた場合",
              "summary": "コンビニ・外食を我慢",
              "before": {
                  "safety": 52,
                  "runway": 12,
                  "surplus": 0
              },
              "after": {
                  "safety": 61,
                  "runway": 16,
                  "surplus": 0
              },
              "impacts": [
                  "現金不足を回避",
                  "Runway: 12日 → 16日"
              ]
          }
      ],
      "copy": {
          "adviceText": "Netflix は解約済み。まだ支出が収入を上回っています。Spotify と食費から削りましょう。",
          "priorityActionsText": [
              "Spotify を解約（月 ¥980 削減）",
              "リボ返済を月 ¥3,000 増やす",
              "外食を今週 ¥2,000 抑える"
          ],
          "subscriptionComment": "iCloud+ のみ維持。Spotify が次の候補",
          "usedFallback": true
      }
  };

  const DANGER_FALLBACK = {
      "asOfMonth": "2026-06",
      "safetyBufferTarget": 50000,
      "revolvingDebt": {
          "balance": 520000,
          "minimumPayment": 30000,
          "aprPercent": 15
      },
      "metrics": {
          "status": "DANGER",
          "score": 16,
          "gapToSafety": 47200,
          "runwayDays": 3,
          "safeUntilDate": "2026-06-25",
          "projectedBalanceAfterPayments": 2800,
          "monthlyBurnRate": 201000
      },
      "brief": {
          "status": "DANGER",
          "score": 16,
          "gapToSafety": 47200,
          "gapWorkDays": 0,
          "runwayDays": 3,
          "safeUntilDate": "2026-06-25",
          "gapMessage": "あと ¥47,200 — 今週が正念場です",
          "workDaysMessage": "新規の出費は止め、引落前の現金を確保してください",
          "primaryAction": {
              "priority": 1,
              "id": "urgent-revo",
              "title": "今週のカード引落 ¥30,000 前に現金を確保",
              "impactYen": 27200,
              "impactPeriod": "monthly",
              "category": "debt",
              "templateReason": "残高 ¥2,800 — 引落でマイナスになる見込み"
          },
          "priorityActions": [
              {
                  "priority": 1,
                  "id": "urgent-revo",
                  "title": "今週のカード引落 ¥30,000 前に現金を確保",
                  "impactYen": 27200,
                  "impactPeriod": "monthly",
                  "category": "debt",
                  "templateReason": "口座残高 ¥2,800 — 引落で不足",
                  "expectedEffect": "オーバードラフト・追加借入を防ぐ"
              },
              {
                  "priority": 2,
                  "id": "subscription-cleanup",
                  "title": "Netflix・Spotify を今すぐ解約",
                  "impactYen": 2470,
                  "impactPeriod": "monthly",
                  "category": "subscription",
                  "templateReason": "来月の引落までに効く即効策",
                  "expectedEffect": "今月の現金流出を止める"
              },
              {
                  "priority": 3,
                  "id": "defer-car-loan",
                  "title": "車ローンの支払い日を相談（¥15,000）",
                  "impactYen": 15000,
                  "impactPeriod": "monthly",
                  "category": "collection",
                  "templateReason": "給料日と引落が重なる",
                  "expectedEffect": "1週間の猶予を得る"
              }
          ],
          "subscriptionOptimization": {
              "monthlySubsTotal": 2870,
              "monthlySavingPotential": 2470,
              "yearlySavingPotential": 29640,
              "candidates": [
                  {
                      "subscriptionId": "sub-netflix",
                      "name": "Netflix",
                      "monthlyCost": 1490,
                      "yearlySaving": 17880,
                      "reason": "今月の視聴は2時間のみ — 解約しても生活に影響小",
                      "priority": 1
                  },
                  {
                      "subscriptionId": "sub-spotify",
                      "name": "Spotify",
                      "monthlyCost": 980,
                      "yearlySaving": 11760,
                      "reason": "無料プランで代替可能",
                      "priority": 2
                  }
              ],
              "keepRecommendations": [
                  {
                      "name": "iCloud+ 200GB",
                      "reason": "写真・書類のバックアップ用 — 月¥400のみ"
                  }
              ]
          },
          "calendarMarkers": [
              {
                  "date": "2026-06-22",
                  "type": "danger",
                  "label": "残高 ¥2,800 — 危険",
                  "countdownDays": 0,
                  "amount": 2800
              },
              {
                  "date": "2026-06-25",
                  "type": "danger",
                  "label": "カード引落（リボ）¥30,000",
                  "countdownDays": 3,
                  "amount": 30000
              },
              {
                  "date": "2026-06-26",
                  "type": "bill",
                  "label": "車ローン ¥15,000",
                  "countdownDays": 4,
                  "amount": 15000
              },
              {
                  "date": "2026-06-25",
                  "type": "income",
                  "label": "給与入金 ¥185,000",
                  "countdownDays": 3,
                  "amount": 185000
              }
          ],
          "paymentWarnings": [
              {
                  "message": "リボ残高が先月より ¥18,000 増加",
                  "severity": "high"
              },
              {
                  "message": "今週の引落で口座がマイナスになる見込み",
                  "severity": "high"
              }
          ],
          "nextBigPayment": {
              "name": "カード引落（リボ）",
              "daysUntil": 3,
              "amount": 30000
          }
      },
      "kpis": {
          "projectedIncome": 185000,
          "projectedIncomePeriod": "monthly",
          "confirmedExpenses": 201000,
          "confirmedExpensesPeriod": "monthly",
          "projectedBalance": 2800,
          "projectedBalancePeriod": "balance"
      },
      "fleetMetric": {
          "lastSync": "2026-06-15T22:34:00",
          "syncCount": 1,
          "status": "normal",
          "syncMethod": "給与明細",
          "monthlyRevenueSynced": 185000,
          "recommendedWorkDays": 0
      },
      "surplus": {
          "amount": 0,
          "amountPeriod": "balance",
          "investmentCandidate": 0,
          "investmentCandidatePeriod": "monthly",
          "taxReserveSuggested": 0,
          "taxReserveSuggestedPeriod": "monthly",
          "aiDevBudgetSuggested": 0,
          "aiDevBudgetSuggestedPeriod": "monthly"
      },
      "simulations": [
          {
              "id": "cancel-all-subs",
              "title": "Netflix・Spotify を今すぐ解約した場合",
              "summary": "来月の引落までに効く即効策",
              "before": {
                  "safety": 16,
                  "runway": 3,
                  "surplus": 0
              },
              "after": {
                  "safety": 22,
                  "runway": 5,
                  "surplus": 0
              },
              "impacts": [
                  "月 ¥2,470 削減",
                  "Runway: 3日 → 5日",
                  "来月の負担が軽くなる"
              ]
          },
          {
              "id": "revo-extra-10k",
              "title": "リボ返済を月 ¥10,000 増やした場合",
              "summary": "給料日後にまとめて返済",
              "before": {
                  "safety": 16,
                  "runway": 3,
                  "surplus": 0
              },
              "after": {
                  "safety": 28,
                  "runway": 8,
                  "surplus": 0
              },
              "impacts": [
                  "利息の増加を抑制",
                  "Runway: 3日 → 8日"
              ]
          },
          {
              "id": "defer-car",
              "title": "車ローンを1週間延期した場合",
              "summary": "給料入金と引落のタイミング調整",
              "before": {
                  "safety": 16,
                  "runway": 3,
                  "surplus": 0
              },
              "after": {
                  "safety": 24,
                  "runway": 6,
                  "surplus": 0
              },
              "impacts": [
                  "Runway: 3日 → 6日",
                  "今週の現金不足を回避"
              ]
          }
      ],
      "copy": {
          "adviceText": "口座残高 ¥2,800。今週のリボ引落 ¥30,000 でマイナスになります。サブスク解約と支払い日の調整が急務です。",
          "priorityActionsText": [
              "今週の引落前に現金を確保",
              "Netflix・Spotify を今すぐ解約",
              "車ローンの支払い日を相談"
          ],
          "subscriptionComment": "緊急: 削れるのはサブスクだけ。車ローンは維持が必要",
          "usedFallback": true
      }
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
    bindDashboardCtas,
    bindCashflowImportTabs,
    bindSubscriptionsCtas,
    showAccPreviewModal,
    remountDashboard,
    remountSubscriptions,
    remountCashflow,
    remountInsights,
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
