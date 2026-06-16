# AI Cashflow Commander

個人事業主向け **AI CFO** — キャッシュフロー司令塔。

## アーキテクチャ（3層 + コスト設計）

```
Layer 1  Deterministic Engine   TypeScript — 計算・CSV・サブスク検出
Layer 2  Rule-based Advisor     テンプレート — 助言・優先アクション
Layer 3  LLM Copy Polisher      Cloudflare Workers AI — 文案のみ（要約JSON入力）
```

| 処理 | 方式 | Neurons消費 |
|------|------|-------------|
| Safety Score / Runway / Gap | Layer 1 | **0** |
| 優先アクション / 警告文 | Layer 2 | **0** |
| 120字アドバイス整形 | Layer 3 | **~4/回** |
| CSV解析 | Layer 1 | **0** |

### Cloudflare 公式価格（2025–2026 確認済み）

- **無料枠**: 10,000 Neurons / 日（00:00 UTC リセット）
- **超過**: Workers Paid で **$0.011 / 1,000 Neurons**
- **AI Gateway**: コア機能無料（ログ・レート制限・キャッシュ）
- **推奨モデル**: `@cf/meta/llama-3.2-1b-instruct`（最小コスト）

1回の polish ≈ 4 Neurons → 無料枠内 **~2,500回/日**（キャッシュでさらに削減）。

`AI_DAILY_NEURON_BUDGET=8000` でアプリ側ガード（無料枠の80%）。

## プロジェクト構成

```
packages/finance-core/   Layer 1 + 2（Vitestテスト付き）
apps/worker/             Cloudflare Worker API（Layer 3）
ai_cashflow_commander/   Stitch デザインシステム
_7, _8, ai_3 ...         Stitch HTMLモック
```

## セットアップ

```bash
npm install
npm test
npm run dev   # apps/worker — wrangler dev
```

### 環境変数（wrangler.toml / secrets）

| 変数 | 説明 |
|------|------|
| `AI_MODEL` | デフォルト `@cf/meta/llama-3.2-1b-instruct` |
| `AI_POLISH_ENABLED` | `false` で Layer 2 フォールバックのみ |
| `AI_GATEWAY_ENABLED` | `true` + Gateway ID/Name で経由 |
| `AI_DAILY_NEURON_BUDGET` | 日次 Neuron 上限（デフォルト 8000） |

## API

| Method | Path | 説明 |
|--------|------|------|
| GET | `/health` | ヘルスチェック |
| POST | `/api/dashboard` | フルパイプライン（L1+L2+L3） |
| POST | `/api/dashboard/deterministic` | L1+L2 のみ（AIコスト0） |
| POST | `/api/import/csv` | CSV解析（LLM不使用） |
| POST | `/api/ai/polish` | 要約JSON → 文案のみ |
| GET | `/api/ai/cost-estimate` | コスト見積もり |

### 例

```bash
curl -X POST http://localhost:8787/api/dashboard/deterministic
curl -X POST http://localhost:8787/api/dashboard -H 'Content-Type: application/json' -d '{"skipPolish":true}'
```

## LLM に渡さないもの

- CSV 全文
- 生の取引明細一覧
- 計算依頼（スコア・Runway等）

LLM 入力は `LLMPolishInput` JSON（~500 tokens）のみ。

## ライセンス

Private
