# Development status

_Last updated: 2026-11-17 — end of Phase 1 (foundation)._

## Architecture (short)

| Layer | Choice |
|---|---|
| App | Expo SDK 58, React Native 0.88, React Native Web, Expo Router (`src/app`), TypeScript strict |
| Backend | Supabase project `lyeaepzcyxujwcruuddw` (Postgres + RLS, Auth, Edge Functions) |
| AI | Gemini via Edge Function `analyze-food-image` only (key in Edge Function secrets) |
| Hosting | Vercel (static SPA export, `vercel.json`) |

```
src/app/            routes (Expo Router). (auth)/, (tabs)/, onboarding, targets, reset-password
src/components/ui/  design system: AppText, Button, TextField, Card, ChoiceGroup, ProgressRing, MacroBar, Banner, states
src/theme/          tokens (dark primary, light), ThemeProvider (persisted preference)
src/lib/            supabase client, auth provider, pure business logic (nutrition/, time/), validation
src/services/       data access (profile, dashboard). Screens never build queries inline.
src/types/          database types (regenerate after migrations)
supabase/migrations SQL migrations (file names match applied versions)
supabase/functions  Edge Functions (analyze-food-image)
```

Rules: business logic in `src/lib` is pure and unit-tested (`npm test`); all DB access is RLS-protected; only the publishable key is in the client.

## Phase 1 — Foundation ✅

- Expo universal app scaffold, Expo Router with protected routes (`Stack.Protected`), web target, desktop side-rail / mobile bottom tabs.
- Design system + dark/light/system theme switcher.
- Supabase client (web localStorage, native expo-sqlite storage), session persistence.
- Auth: sign up (email verification), sign in, forgot/reset password, sign out.
- Onboarding (5 steps, only weight + goal required) → calculated targets (Mifflin-St Jeor, safe floors, goal pace) with aggressive-goal warnings and safer-date suggestion.
- Today dashboard from real data: calorie ring, macro bars, today's meals, weight log card.
- Journal: 7/30/60/90/180-day daily totals from `daily_nutrition` view.
- Profile: targets, goal, theme, sign out. Targets editor with recommended values and sanity warnings.
- DB (migrations applied): `profiles`, `user_roles` (+ `app_role` enum), `user_preferences`, `user_goals`, `nutrition_targets` (history), `weight_logs`, `meals` (+ local_date, timezone, meal_kind, photo_path), `meal_items`, `ai_usage_events`, `daily_nutrition` view, `save_meal()` RPC, new-user trigger. RLS on every table; explicit grants; anon has no table access.
- Pre-existing: `analyze-food-image` Edge Function (deployed, JWT required, rate-limited, structured estimates).

Verified: `npm run typecheck` ✅, `npm test` (24 tests) ✅, `npm run build:web` ✅, sign-in screen renders at mobile and desktop widths (headless Chrome). Live gateway checks on the Edge Function (401 without auth/invalid JWT, CORS) ✅.

Not yet verified end-to-end: signed-in flows (onboarding → dashboard) and a real Gemini call — need a real user account (see blockers).

## Blockers / actions needed from you

1. **Supabase Auth URLs** (Dashboard → Authentication → URL Configuration): set Site URL to the Vercel URL once deployed and add redirect URLs `http://localhost:8081/**` and `https://<your-vercel-domain>/**`. Needed for verification and password-reset links.
2. **Email sending**: Supabase's built-in email is heavily rate-limited. Configure custom SMTP (Resend, Postmark, SES…) before inviting real users.
3. **Gemini live test**: sign up in the app, then use the food scanner (Phase 2) — or tell me to create a dedicated test user.
4. **Model choice**: function defaults to `gemini-3.8-flash`; override with Edge Function secret `GEMINI_MODEL` if needed.
5. **Security advisor**: `public.has_role()` is a SECURITY DEFINER function callable by signed-in users (only reveals the caller's own roles). Moving it to a `private` schema was declined; revisit before Phase 6 policies use it.
6. **Vercel**: import the GitHub repo, set env vars `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Next — Phase 2 (food tracking)

- Consent screen for sending photos to AI (`user_preferences.ai_photo_consent_at`).
- Private `meal-photos` storage bucket + RLS; camera/upload (web `<input capture>`, native expo-camera/image-picker), client-side resize.
- Review/edit screen for AI results → `save_meal` with auto category, local date, timezone, meal kind.
- Manual food entry; meal detail, edit (keep original timestamps), delete, duplicate.
- Journal: per-day meal list with photos.

Later phases per the master plan: 3 barcode/Open Food Facts, 4 progress/photos/charts, 5 workouts/water/reminders, 6 AI assistant + trainer/client RLS, 7 PWA, deploy, QA.

## Run locally

```bash
npm install
cp .env.example .env   # already present locally with public values
npm run web            # http://localhost:8081
npm test               # unit tests (Node 24 type stripping)
npm run typecheck
npm run build:web      # static export to dist/
```
