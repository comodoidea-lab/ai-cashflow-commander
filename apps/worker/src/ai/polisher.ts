import type { LLMPolishInput, LLMPolishOutput } from "@acc/finance-core";
import {
  buildFallbackFromLLMInput,
  buildLLMUserPrompt,
  LLM_SYSTEM_PROMPT,
  parseLLMResponse,
} from "@acc/finance-core";

/** Estimated neurons per polish call (@cf/meta/llama-3.2-1b-instruct, ~400 in + ~180 out) */
export const ESTIMATED_NEURONS_PER_CALL = 4;

export interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  AI_MODEL: string;
  AI_GATEWAY_ENABLED: string;
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_NAME?: string;
  AI_DAILY_NEURON_BUDGET: string;
  AI_POLISH_ENABLED: string;
}

interface AiTextGenerationResult {
  response?: string;
}

/** In-memory daily budget tracker (resets on worker isolate restart; use KV/Durable Object in prod) */
const dailyUsage = { date: "", neurons: 0 };

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function trackUsage(neurons: number, budget: number): boolean {
  const today = todayUtc();
  if (dailyUsage.date !== today) {
    dailyUsage.date = today;
    dailyUsage.neurons = 0;
  }
  if (dailyUsage.neurons + neurons > budget) return false;
  dailyUsage.neurons += neurons;
  return true;
}

function buildWorkersAiUrl(env: Env, model: string): string {
  if (env.AI_GATEWAY_ENABLED !== "true") return model;
  if (!env.AI_GATEWAY_ACCOUNT_ID || !env.AI_GATEWAY_NAME) return model;
  // AI Gateway unified endpoint — cf-aig-metadata headers for logging
  return `@cf/meta/llama-3.2-1b-instruct`; // binding still uses model via gateway config
}

/**
 * Layer 3 — LLM copy polisher only.
 * Never sends CSV, raw transactions, or asks model to calculate.
 */
export async function polishCopy(
  env: Env,
  input: LLMPolishInput,
  cache?: Cache,
): Promise<LLMPolishOutput> {
  if (env.AI_POLISH_ENABLED !== "true") {
    return buildFallbackFromLLMInput(input);
  }

  const cacheKey = await buildCacheKey(input);
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const body = (await cached.json()) as LLMPolishOutput;
      return { ...body, usedFallback: false };
    }
  }

  const budget = Number(env.AI_DAILY_NEURON_BUDGET) || 8000;
  if (!trackUsage(ESTIMATED_NEURONS_PER_CALL, budget)) {
    return buildFallbackFromLLMInput(input);
  }

  try {
    const model = env.AI_MODEL || "@cf/meta/llama-3.2-1b-instruct";
    buildWorkersAiUrl(env, model);

    const result = (await env.AI.run(model as keyof AiModels, {
      messages: [
        { role: "system", content: LLM_SYSTEM_PROMPT },
        { role: "user", content: buildLLMUserPrompt(input) },
      ],
      max_tokens: 256,
      temperature: 0.3,
    })) as AiTextGenerationResult;

    const raw = result.response ?? "";
    const parsed = parseLLMResponse(raw);
    const output = parsed ?? buildFallbackFromLLMInput(input);

    if (cache && parsed) {
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(output), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
          },
        }),
      );
    }

    return output;
  } catch {
    return buildFallbackFromLLMInput(input);
  }
}

async function buildCacheKey(input: LLMPolishInput): Promise<Request> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(input)),
  );
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Request(`https://cache.local/polish/${hex}`);
}

// Cloudflare Workers AI model map placeholder for typing
type AiModels = Record<string, unknown>;
