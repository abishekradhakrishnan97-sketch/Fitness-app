// analyze-food-image
//
// POST multipart/form-data, signed-in users only:
//   image : File   (required; JPEG, PNG, WebP or HEIC/HEIF, max 7 MB)
//   hint  : string (optional; e.g. "home-made, Chettinad style", max 300 chars)
//
// Returns { ok: true, data: FoodAnalysis } with all nutrition marked as estimates,
// or { ok: false, error: { code, message, retryable } }.
//
// This function only analyses. Nothing is saved: the client shows the result for
// the user to review/edit, then saves via the `save_meal` database function.
//
// Secrets (Edge Function secrets, never sent to clients):
//   GEMINI_API_KEY             required
//   GEMINI_MODEL               optional, default below
//   FOOD_SCAN_HOURLY_LIMIT     optional, default 30 analyses per user per hour

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { analyseFoodWithGemini, GeminiError } from "./gemini.ts";
import { detectImageType, InvalidModelOutputError, normaliseAnalysis, SUPPORTED_IMAGE_TYPES } from "./nutrition.ts";

const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const FEATURE = "food_image_analysis";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, code: string, message: string, retryable = false): Response {
  return json(status, { ok: false, error: { code, message, retryable } });
}

function publicApiKey(): string {
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (anon) return anon;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    return keys.default ?? Object.values(keys)[0] ?? "";
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Use POST");

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("GEMINI_API_KEY secret is not set");
    return fail(500, "AI_CONFIG_ERROR", "Food analysis is not configured yet");
  }
  const model = Deno.env.get("GEMINI_MODEL")?.trim() || DEFAULT_MODEL;
  if (!/^[a-z0-9][a-z0-9.\-]{2,80}$/i.test(model)) {
    console.error("GEMINI_MODEL secret has an invalid format");
    return fail(500, "AI_CONFIG_ERROR", "Food analysis is not configured correctly");
  }
  const hourlyLimit = Number(Deno.env.get("FOOD_SCAN_HOURLY_LIMIT") ?? 30) || 30;

  // --- Auth: require a real signed-in user (verify_jwt also runs at the gateway) ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "UNAUTHORIZED", "Please sign in to analyse food photos");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicApiKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return fail(401, "UNAUTHORIZED", "Please sign in to analyse food photos");
  const userId = userData.user.id;

  // --- Explicit consent before any photo is sent to an external AI service ---
  const { data: prefs, error: prefsError } = await supabase
    .from("user_preferences")
    .select("ai_photo_consent_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (prefsError) {
    console.error("user_preferences read failed:", prefsError.code);
    return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.", true);
  }
  if (!prefs?.ai_photo_consent_at) {
    return fail(403, "CONSENT_REQUIRED", "Please allow AI photo analysis before sending photos.");
  }

  // --- Parse and validate the upload ---
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return fail(400, "INVALID_REQUEST", "Send the photo as multipart/form-data in a field named 'image'");
  }
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return fail(413, "IMAGE_TOO_LARGE", "Photo is too large. Please use an image under 7 MB.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "INVALID_REQUEST", "Could not read the uploaded form data");
  }
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return fail(400, "INVALID_REQUEST", "No photo found. Attach it in a field named 'image'.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail(413, "IMAGE_TOO_LARGE", "Photo is too large. Please use an image under 7 MB.");
  }
  const hintRaw = form.get("hint");
  const hint = typeof hintRaw === "string" ? hintRaw.slice(0, 300) : null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectImageType(bytes);
  if (!mimeType || !SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
    return fail(415, "UNSUPPORTED_IMAGE", "Unsupported image. Please upload a JPEG, PNG, WebP or HEIC photo.");
  }

  // --- Per-user rate limit (record first, then count, so parallel requests can't slip through) ---
  const { error: usageError } = await supabase.from("ai_usage_events").insert({ user_id: userId, feature: FEATURE });
  if (usageError) {
    console.error("ai_usage_events insert failed:", usageError.code);
    return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.", true);
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", FEATURE)
    .gte("created_at", since);
  if (countError) {
    console.error("ai_usage_events count failed:", countError.code);
    return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.", true);
  }
  if ((count ?? 0) > hourlyLimit) {
    return fail(429, "RATE_LIMITED", "You've analysed a lot of photos recently. Please try again in a while.", true);
  }

  // --- Analyse ---
  const started = Date.now();
  try {
    const result = await analyseFoodWithGemini({ apiKey, model, image: bytes, mimeType, hint });
    const analysis = normaliseAnalysis(result.json);
    console.log(JSON.stringify({
      event: "food_analysis_ok",
      model: result.model,
      ms: Date.now() - started,
      items: analysis.items.length,
      needs_review: analysis.needs_review,
      tokens: result.usage?.totalTokenCount,
    }));
    return json(200, { ok: true, data: { ...analysis, model: result.model } });
  } catch (err) {
    if (err instanceof GeminiError) {
      const status = err.code === "AI_RATE_LIMITED"
        ? 429
        : err.code === "AI_BLOCKED"
        ? 422
        : err.code === "AI_TIMEOUT"
        ? 504
        : err.code === "AI_CONFIG_ERROR"
        ? 500
        : 502;
      return fail(status, err.code, err.message, err.retryable);
    }
    if (err instanceof InvalidModelOutputError) {
      console.error("Invalid model output:", err.message);
      return fail(502, "AI_INVALID_RESPONSE", "The AI returned an unexpected result. Please try again.", true);
    }
    console.error("Unexpected error:", (err as Error)?.name, (err as Error)?.message);
    return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.", true);
  }
});
