# Handoff Issue 下書き（手動作成用）

`gh auth refresh -h github.com` 後、以下を実行:

```bash
gh issue create -R comodoidea-lab/HandoffBox \
  --title "Handoff: ai_cashflow_pilot — FleetMetric連携UI仕上げ完了" \
  --body-file /Users/tomoya/GitHub/ai_cashflow_pilot/docs/HANDOFF_ISSUE_BODY.md
```

---

# Handoff: ai_cashflow_pilot (AI Cashflow Commander)

## 止めた場所

AI Cashflow Commander の HTML モック品質改善（6項目）を実装済み。プレビュー `http://127.0.0.1:8080` で SAFE / CAUTION / DANGER 切替とレスポンシブ確認可能。

## 止めた理由

時間切れ。

## 次の1手（15分以内）

1. `cd /Users/tomoya/GitHub/ai_cashflow_pilot && npm run preview`
2. `/_7/code.html?scenario=caution` と `?scenario=danger` で Dashboard 3状態を目視確認
3. 375px で `_3/code.html` の Above the fold を確認

---

## Context
- Repo: ai_cashflow_pilot
- Branch / commit: 未コミット
- Local path: `/Users/tomoya/GitHub/ai_cashflow_pilot`
- Deploy / env: `npm run preview` → `http://127.0.0.1:8080`

## Stopped at

- **完了:** SAFE Commander Brief 矛盾修正、3状態モック、AI Insights Before/After、FleetMetric 表記統一、Adobe 維持推奨、モバイル CSS
- **未着手:** finance-core DANGER 反映、Cloudflare デプロイ、Phase 2 JSON 同期

## Why stopped

セッション時間切れ。

## Next step (≤15 min)
1. `gh auth refresh -h github.com`
2. 変更コミット（ユーザー指示後）
3. finance-core の Adobe 解約候補を UI と整合

## Resume notes

- シナリオ: SAFE デフォルト / `?scenario=caution` / `?scenario=danger`
- 主要: `api-client.js`, `responsive.css`, `_7/_3/_8/_9/ai_3`
- 原則: 売上 SSOT = FleetMetric Pro、AI Insights = シミュレーション専用
