// Minimal Gemini REST client for server-side use only.
// The API key is passed in by the caller (read from Edge Function secrets) and is
// never logged or included in any error returned to clients.

import { encodeBase64 } from "jsr:@std/encoding@^1/base64";
import { buildUserPrompt, RESPONSE_JSON_SCHEMA, SYSTEM_PROMPT } from "./nutrition.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;

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
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

export async function analyseFoodWithGemini(opts: {
  apiKey: string;
  model: string;
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

  const url = `${GEMINI_BASE}/${encodeURIComponent(opts.model)}:generateContent`;
  let lastError: GeminiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callOnce(url, opts.apiKey, body, opts.model);
    } catch (err) {
      lastError = err instanceof GeminiError
        ? err
        : new GeminiError("AI_UNAVAILABLE", "Unexpected error calling the AI service", true);
      // Retry only transient server-side failures (not 429/quota, not bad requests).
      const transient = lastError.code === "AI_UNAVAILABLE" || lastError.code === "AI_TIMEOUT";
      if (!transient || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw lastError!;
}

async function callOnce(url: string, apiKey: string, body: string, model: string): Promise<GeminiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new GeminiError("AI_CONFIG_ERROR", "The AI service is not configured correctly", false, res.status);
    }
    if (res.status === 400) {
      throw new GeminiError("AI_INVALID_RESPONSE", "The AI service could not process this image", false, 400);
    }
    throw new GeminiError("AI_UNAVAILABLE", "The AI service is temporarily unavailable", true, res.status);
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
