// Minimal Gemini REST client for server-side use only.
// The API key is passed in by the caller (read from Edge Function secrets) and is
// never logged or included in any error returned to clients.

import { encodeBase64 } from "jsr:@std/encoding@^1/base64";
import { buildUserPrompt, RESPONSE_JSON_SCHEMA, SYSTEM_PROMPT } from "./nutrition.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PER_MODEL_TIMEOUT_MS = 25_000;
/** Stay well under the Edge Function wall-clock limit. */
const TOTAL_BUDGET_MS = 100_000;

export type GeminiErrorCode =
  | "AI_RATE_LIMITED"
  | "AI_BLOCKED"
  | "AI_TIMEOUT"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_RESPONSE"
  | "AI_CONFIG_ERROR";

export class GeminiError extends Error {
  constructor(
    public code: GeminiErrorCode,
    message: string,
    public retryable: boolean,
    public upstreamStatus?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export interface GeminiResult {
  json: unknown;
  model: string;
  attempts: string[];
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

/**
 * Try each model in order. Move on when a model is overloaded/unavailable (503/500),
 * rate-limited (429), times out, or doesn't exist for this key (404). Stop immediately
 * on configuration errors (bad key) or when the image itself is rejected.
 */
export async function analyseFoodWithGemini(opts: {
  apiKey: string;
  models: string[];
  image: Uint8Array;
  mimeType: string;
  hint?: string | null;
}): Promise<GeminiResult> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: opts.mimeType, data: encodeBase64(opts.image) } },
        { text: buildUserPrompt(opts.hint) },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
    },
  });

  const started = Date.now();
  const attempts: string[] = [];
  let lastError: GeminiError | null = null;

  for (const model of opts.models) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 5_000) break;
    const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;
    try {
      const result = await callOnce(url, opts.apiKey, body, model, Math.min(PER_MODEL_TIMEOUT_MS, remaining));
      attempts.push(`${model}:ok`);
      return { ...result, attempts };
    } catch (err) {
      lastError = err instanceof GeminiError
        ? err
        : new GeminiError("AI_UNAVAILABLE", "Unexpected error calling the AI service", true);
      attempts.push(`${model}:${lastError.upstreamStatus ?? lastError.code}`);
      const tryNext = lastError.code === "AI_UNAVAILABLE" || lastError.code === "AI_TIMEOUT" ||
        lastError.code === "AI_RATE_LIMITED" || lastError.upstreamStatus === 404;
      if (!tryNext) break;
    }
  }
  console.error(`All Gemini attempts failed: ${attempts.join(", ")}`);
  if (lastError?.upstreamStatus === 404) {
    throw new GeminiError("AI_CONFIG_ERROR", "The AI model is not available for this API key", false, 404);
  }
  throw lastError ?? new GeminiError("AI_UNAVAILABLE", "The AI service is temporarily unavailable", true);
}

async function callOnce(
  url: string,
  apiKey: string,
  body: string,
  model: string,
  timeoutMs: number,
): Promise<Omit<GeminiResult, "attempts">> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new GeminiError("AI_TIMEOUT", "The AI service took too long to respond", true);
    }
    console.error("Gemini network error:", (err as Error)?.name);
    throw new GeminiError("AI_UNAVAILABLE", "Could not reach the AI service", true);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Log a short, key-free summary for debugging. Never echo upstream details to clients.
    const text = await res.text().catch(() => "");
    let status = "";
    try {
      status = JSON.parse(text)?.error?.status ?? "";
    } catch { /* ignore */ }
    console.error(`Gemini HTTP ${res.status} ${status} (model=${model})`);

    if (res.status === 429) {
      throw new GeminiError("AI_RATE_LIMITED", "The AI service is busy. Please try again shortly.", true, 429);
    }
    if (res.status === 400 && /API_KEY|api key/i.test(text)) {
      throw new GeminiError("AI_CONFIG_ERROR", "The AI service is not configured correctly", false, 400);
    }
    if (res.status === 404) {
      throw new GeminiError("AI_UNAVAILABLE", `Model ${model} is not available`, true, 404);
    }
    if (res.status === 401 || res.status === 403) {
      throw new GeminiError("AI_CONFIG_ERROR", "The AI service is not configured correctly", false, res.status);
    }
    if (res.status === 400) {
      throw new GeminiError("AI_INVALID_RESPONSE", "The AI service could not process this image", false, 400);
    }
    throw new GeminiError("AI_UNAVAILABLE", "The AI service is busy right now. Please try again in a minute.", true, res.status);
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await res.json().catch(() => null);
  if (!data) throw new GeminiError("AI_INVALID_RESPONSE", "The AI service returned an unreadable response", true);

  if (data.promptFeedback?.blockReason) {
    console.warn("Gemini blocked prompt:", data.promptFeedback.blockReason);
    throw new GeminiError("AI_BLOCKED", "This image could not be analysed. Please try a different photo.", false);
  }

  const candidate = data.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish && !["STOP", "MAX_TOKENS"].includes(finish)) {
    console.warn("Gemini finishReason:", finish);
    throw new GeminiError("AI_BLOCKED", "This image could not be analysed. Please try a different photo.", false);
  }

  const text: string = (candidate?.content?.parts ?? [])
    .filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === "string")
    .map((p: { text: string }) => p.text)
    .join("");

  if (!text) throw new GeminiError("AI_INVALID_RESPONSE", "The AI service returned an empty response", true);

  try {
    return { json: JSON.parse(text), model: data.modelVersion ?? model, usage: data.usageMetadata };
  } catch {
    console.error(`Gemini returned non-JSON output (finishReason=${finish}, length=${text.length})`);
    throw new GeminiError("AI_INVALID_RESPONSE", "The AI service returned an incomplete response", true);
  }
}
