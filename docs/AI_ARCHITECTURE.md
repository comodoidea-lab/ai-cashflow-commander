# AI アーキテクチャ & コスト設計

## 原則

1. **計算は TypeScript** — LLMに数値を出させない
2. **CSVはコードで解析** — カテゴリはキーワードヒューリスティック
3. **LLMは文案のみ** — 要約済み JSON → 120字以内
4. **AI Gateway 必須（本番）** — ログ・キャッシュ・レート制限
5. **小型モデル** — `@cf/meta/llama-3.2-1b-instruct`

## レイヤー詳細

### Layer 1: Deterministic Engine

| モジュール | 関数 |
|-----------|------|
| `engine/safety.ts` | `computeSafetyMetrics`, `computeSafetyScore`, `scoreToStatus` |
| `engine/subscriptions.ts` | `analyzeSubscriptions` |
| `engine/calendar.ts` | `buildCalendarMarkers`, `getPaymentWarnings` |
| `engine/csv.ts` | `parseCsvTransactions`, `categorizeDescription` |

### Layer 2: Rule-based Advisor

| モジュール | 関数 |
|-----------|------|
| `advisor/rules.ts` | `buildAdvisorBrief`, `briefToLLMInput` |
| `advisor/templates.ts` | `buildFallbackCopy`, `parseLLMResponse` |

### Layer 3: LLM Copy Polisher

| モジュール | 関数 |
|-----------|------|
| `apps/worker/src/ai/polisher.ts` | `polishCopy` |

## コスト試算

| シナリオ | 呼び出し/日 | Neurons/日 |
|---------|------------|-----------|
| MVP（polish無効） | 0 | **0** |
| ダッシュボード表示50回 | 50 × 4 | **200** |
| アクティブユーザー100人×5回 | 500 × 4 | **2,000** |
| キャッシュヒット50% | 250 × 4 | **1,000** |

無料枠 10,000 Neurons/日 を大幅に下回る設計。

超過時: 2,000 neurons ≈ **$0.022/日**

## AI Gateway 設定（本番）

```toml
[vars]
AI_GATEWAY_ENABLED = "true"

# wrangler secret put AI_GATEWAY_ACCOUNT_ID
# wrangler secret put AI_GATEWAY_NAME
```

Gateway で以下を設定:

- **Cache**: 同一 `LLMPolishInput` ハッシュ → 1時間
- **Rate limit**: ユーザー/IP あたり 60 req/分
- **Logging**: Workers Analytics

## 安全な LLM 入力スキーマ

```typescript
interface LLMPolishInput {
  status: "SAFE" | "CAUTION" | "DANGER";
  score: number;
  gapYen: number;
  gapWorkDays: number;
  runwayDays: number;
  safeUntilDate: string;
  primaryActionTitle: string;
  primaryActionImpactYen: number;
  priorityActions: Array<{ priority: number; title: string; impactYen: number }>;
  subscriptionCandidates: Array<{ name: string; yearlySaving: number; reason: string }>;
  monthlySavingPotential: number;
}
```

## フェーズ対応

| Phase | AI利用 |
|-------|--------|
| Phase 1 | Layer 1+2 のみ（HTML/UI） |
| Phase 2 | Worker API + オプション Layer 3 |
| Phase 3 | Gateway本番 + 週次Brief（バッチ、1ユーザー1回/日） |
