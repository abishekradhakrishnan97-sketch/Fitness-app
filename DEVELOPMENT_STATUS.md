# Development status

_Last updated: 2026-11-17 — Phase 2 (food logging) implemented on branch `phase-2-food-logging`; database E2E passed._

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
6. **Vercel env vars missing** (production bundle shows "Setup required"): add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview, then redeploy.

## Phase 2 — Food logging ✅

Audit finding: food logging "didn't work" because Phase 1 had no add-food UI at all (0 meals in DB); there was no broken save path.

- **Add food tab**: photo (camera), upload photo, manual entry, packaged food (barcode/search), search of your own food history, frequent & recent foods (one tap), saved meals.
- **Manual entry**: name, amount + unit (g, ml, piece, katori, cup…), optional grams, calories, protein, carbs, fat, fibre, sugar, sodium; multiple items per meal; auto meal category from local time (overridable); meal kind (regular/treat/cheat/social); notes. Changing amount scales nutrition.
- **AI photo**: explicit consent screen (stored in `user_preferences.ai_photo_consent_at`, also enforced server-side → `CONSENT_REQUIRED`), camera/gallery, client-side resize + EXIF strip, Gemini via Edge Function, editable review with confidence badges, alternatives, "AI estimate" labels; photo stored only on save in private bucket.
- **Packaged food**: barcode scan (expo-camera, web + native), manual barcode entry, product search, serving-size picker, label-data notice, not-found → manual fallback. Open Food Facts called directly (public, no key, CORS-enabled).
- **Meal detail**: view (photo via signed URL), edit (atomic `update_meal`, original timestamps kept), delete (confirm, also removes photo), log again (duplicate), save as reusable meal.
- **Journal**: Today/7/30/60/90/180/custom ranges, days → meals in category order, per-meal and per-day totals, tap to edit/delete.
- **Dashboard**: Add food CTA, meals grouped by category with totals, refreshes when you return to it.
- **Profile**: withdraw/allow AI photo consent.
- DB (migration `20261117100000_phase2_food_logging.sql`, applied by owner in SQL editor): `meal_items` serving qty/unit/source/barcode; totals trigger; `update_meal()`; `save_meal()` v3 (non-AI meals no longer default to estimate); `saved_meals` (RLS); `my_foods()`; private `meal-photos` bucket with own-folder policies.
- Edge Function `analyze-food-image` v2: adds server-side consent check.

Verified: typecheck ✅, 37 unit tests ✅ (drafts/scaling/validation, Open Food Facts parsing, targets, categorisation, AI output normalisation), web build ✅, migration objects verified in DB ✅, Open Food Facts endpoints verified live ✅.

Database E2E ✅ (`supabase/tests/phase2_food_logging_e2e.sql`, run by owner, rolled back): as the real signed-in user — create, daily totals, edit with timestamp preserved, totals trigger, history search, saved meals, cross-user isolation (read/edit/delete blocked), delete cascade, anonymous access blocked.

Still to verify in a browser (needs Vercel env vars): UI flow Add food → save → Journal → Today → edit → delete → refresh; live Gemini photo analysis; barcode camera over HTTPS.

## UI/UX audit (2026-11-17) ✅

- Contrast: every text token now ≥ 4.5:1 on every surface in dark and light themes (measured); input/chip outlines ≥ 3:1 via new `inputBorder` token; smallest text 12 px.
- Touch: small buttons, chips, icon buttons and the forgot-password link reach ≥ 44 px.
- Screen readers: decorative icons hidden (`Icon` component); the photo marker icon labelled.
- Safe areas: bottom CTA bars and scroll content clear the iPhone home indicator.
- Feedback: app-wide toast (announced, reduced-motion aware) after save, edit, delete, log-again, save-template and weight log.
- Speed: Add food CTA directly under the calorie ring; food name auto-focuses on manual entry; meal-type, unit and journal-range chips are single swipeable rows instead of 2–3 wrapped lines.
- Code health: ESLint (eslint-config-expo) set up and clean; `useAsync` rewritten so loading is derived and stale responses can't overwrite newer data.

## Next — Phase 3/4

- Weight history chart, body measurements, private progress photos; water tracking.

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
