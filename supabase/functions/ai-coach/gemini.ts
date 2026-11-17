// Gemini JSON helper with model fallback. Server-side only; the key is never logged or returned.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class AiError extends Error {
  constructor(public code: string, message: string, public retryable: boolean, public status = 502) {
    super(message);
  }
}

export async function generateJson(opts: {
  apiKey: string;
  models: string[];
  system: string;
  user: string;
  schema: unknown;
  perModelTimeoutMs: number;
  totalBudgetMs: number;
}): Promise<{ json: unknown; model: string }> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: opts.schema },
  });
  const started = Date.now();
  const attempts: string[] = [];
  let last: AiError | null = null;

  for (const model of opts.models) {
    const remaining = opts.totalBudgetMs - (Date.now() - started);
    if (remaining < 3_000) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(opts.perModelTimeoutMs, remaining));
    try {
      const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        attempts.push(`${model}:${res.status}`);
        if (res.status === 401 || res.status === 403 || (res.status === 400 && /API_KEY|api key/i.test(text))) {
          last = new AiError("AI_CONFIG_ERROR", "The AI service is not configured correctly", false, 500);
          break;
        }
        last = res.status === 429
          ? new AiError("AI_RATE_LIMITED", "The AI service is busy. Please try again shortly.", true, 429)
          : res.status === 400
          ? new AiError("AI_INVALID_RESPONSE", "The AI service could not process this request", false)
          : new AiError("AI_UNAVAILABLE", "The AI service is busy right now. Please try again in a minute.", true);
        if (res.status === 400) break;
        continue;
      }
      // deno-lint-ignore no-explicit-any
      const data: any = await res.json().catch(() => null);
      const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
        .filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === "string")
        .map((p: { text: string }) => p.text)
        .join("");
      if (!text) {
        attempts.push(`${model}:empty`);
        last = new AiError("AI_INVALID_RESPONSE", "The AI service returned an empty response", true);
        continue;
      }
      try {
        return { json: JSON.parse(text), model: data.modelVersion ?? model };
      } catch {
        attempts.push(`${model}:badjson`);
        last = new AiError("AI_INVALID_RESPONSE", "The AI service returned an incomplete response", true);
      }
    } catch (err) {
      const timeout = (err as Error)?.name === "AbortError";
      attempts.push(`${model}:${timeout ? "timeout" : "network"}`);
      last = timeout
        ? new AiError("AI_TIMEOUT", "The AI service took too long to respond", true, 504)
        : new AiError("AI_UNAVAILABLE", "Could not reach the AI service", true);
    } finally {
      clearTimeout(timer);
    }
  }
  console.error(`Gemini attempts failed: ${attempts.join(", ")}`);
  throw last ?? new AiError("AI_UNAVAILABLE", "The AI service is temporarily unavailable", true);
}
