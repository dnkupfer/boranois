# Boranois

Helps people talk, one to one, with friends and relatives who didn't vote, voted blank, or are wavering, before the runoff on 25 October 2026. A member signs in with a magic link, lists the people they know, and the app says who to talk to first, how that person thinks, which tactics work with her, how to open the conversation, and what to do after she replies. Every message is sent by the member, from their own WhatsApp, in their own words.

## How it decides (and what it never does)

- **Deterministic core.** A pessoa is described with chips (situation, what she says, when she lost trust, who she follows, what worries her, which groups she belongs to). Rules match her to one of eleven published **personas**, compute a **priority** (where the member's time helps most) and pick the **next step** from the persona's hand-written plan. Same catalogue + same inputs = same answer, with the reasons shown.
- **AI at the edges only.** Gemini rewrites a step in the member's voice (validated: no new numbers, links or claims) and labels a pasted reply. It never decides what is true or what to do next. Without a `GEMINI_API_KEY`, templates go out as written.
- **Only true things.** Every fact in [content/facts.json](content/facts.json) has a source, and unverified facts are never served. A step whose fact isn't verified is skipped.
- **Minimal data about third parties.** Names, phones and notes stay in the member's browser. The server stores an id, chips, the persona, the state and outcome chips. Pasted replies are classified and discarded.
- **No coercion.** The relation picker has no boss/employee option (assédio eleitoral is a crime). The "Quem tem certeza" persona exists to say: don't engage.
- **Published.** `/perfis` shows every persona, its narrative and what we never do with it.

Full catalogue and editing rules: [content/README.md](content/README.md).

```
apps/web/        Vite + React: magic-link sign-in, suas pessoas, adicionar pessoa (3 steps of chips), guia por pessoa, como funciona
apps/api/        Express: invites/auth, catalogue loader, engine (match/priority/next step), Gemini phrasing + validator
content/         The catalogue: personas, facts (with sources), contents, defaults, scoring weights
packages/shared/ Taxonomies (chips), request/response types
```

## Run locally

```sh
npm install
npm run dev                          # API on :8080, web on :5173 (proxies /api)
npm test -w @boranois/api            # catalogue checks, match/priority scenarios, phrasing validator
```

Without `apps/api/.env`, data goes to `apps/api/.data/dev.json`, no AI is used, and magic links are printed to the API log and shown on screen (no email provider yet). Copy `apps/api/.env.example` to `.env` to set `GEMINI_API_KEY` and/or `DATABASE_URL` (then `npm run db:migrate -w @boranois/api`).

## Changing the catalogue

Edit the JSON in `content/`, run `npm test -w @boranois/api`, restart the API. The catalogue version (a hash) is recorded on every contact and interaction, so a change never silently rewrites history. Scoring weights live in `content/scoring.json`; `test/scenarios.json` is the regression suite for them.

## Deploy

- **Web:** `npm run build`, then `firebase deploy --only hosting` (`.firebaserc` needs the project id). `/api/**` is rewritten to the Cloud Run service `boranois-api` in `southamerica-east1`.
- **API:** build the root `Dockerfile` (it bundles `content/`) and deploy to Cloud Run as `boranois-api`. Secrets: `DATABASE_URL` (Neon pooled string), `GEMINI_API_KEY`. Set `WEB_ORIGIN` to the site URL.
- **Email:** pass a `sendEmail` function to `createApp` (e.g. Resend) before going live; without it magic links are only logged.
