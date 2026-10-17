# Boranois

Helps people talk, one to one, with friends and relatives who didn't vote, voted blank, or are wavering, before the runoff on 25 October 2026. A host invites five friends; each one lists the people they know, and the app says who to talk to first, how to open the conversation, which fact matters for that person, and what to do after they reply. Every message is sent by the member, from their own WhatsApp, in their own words.

## How it decides (and what it never does)

- **Deterministic core.** A pessoa is described with chips (situation, what she says, what worries her, which groups she belongs to). Rules match her to one of eleven published **personas**, compute a **priority** (where the member's time helps most) and pick the **next step** from the persona's hand-written plan. Same catalogue + same inputs = same answer, with the reasons shown.
- **AI at the edges only.** Gemini rewrites a step in the member's voice (validated: no new numbers, links or claims) and labels a pasted reply. It never decides what is true or what to do next. Without a `GEMINI_API_KEY`, templates go out as written.
- **Only true things.** Every fact in [content/facts.json](content/facts.json) has a source, and unverified facts are never served. A step whose fact isn't verified is skipped.
- **Minimal data about third parties.** Names, phones and notes stay in the member's browser. The server stores an id, chips, the persona, the state and outcome chips. Pasted replies are classified and discarded.
- **No coercion.** The relation picker has no boss/employee option (assédio eleitoral is a crime). The "Quem tem certeza" persona exists to say: don't engage.
- **Published.** `/perfis` shows every persona, its narrative and what we never do with it.

Full catalogue and editing rules: [content/README.md](content/README.md).

```
apps/web/        Vite + React: sign-in, suas pessoas, adicionar pessoa (chips), guia por pessoa, perfis, convites
apps/api/        Express: invites/auth, catalogue loader, engine (match/priority/next step), Gemini phrasing + validator
content/         The catalogue: personas, facts (with sources), contents, defaults, scoring weights
packages/shared/ Taxonomies (chips), request/response types
```

## Run locally

```sh
npm install
npm run dev                          # API on :8080, web on :5173 (proxies /api)
npm run host-code -w @boranois/api   # prints a host sign-up link
npm test -w @boranois/api            # catalogue checks, match/priority scenarios, phrasing validator
```

Without `apps/api/.env`, data goes to `apps/api/.data/dev.json` and no AI is used. Copy `apps/api/.env.example` to `.env` to set `GEMINI_API_KEY` and/or `DATABASE_URL` (then `npm run db:migrate -w @boranois/api`).

## Changing the catalogue

Edit the JSON in `content/`, run `npm test -w @boranois/api`, restart the API. The catalogue version (a hash) is recorded on every contact and interaction, so a change never silently rewrites history. Scoring weights live in `content/scoring.json`; `test/scenarios.json` is the regression suite for them.

## Deploy

- **Web:** `npm run build`, then `firebase deploy --only hosting` (`.firebaserc` needs the project id). `/api/**` is rewritten to the Cloud Run service `boranois-api` in `southamerica-east1`.
- **API:** build the root `Dockerfile` (it bundles `content/`) and deploy to Cloud Run as `boranois-api`. Secrets: `DATABASE_URL` (Neon pooled string), `GEMINI_API_KEY`, `ADMIN_TOKEN`.
- **Host codes in production:** `curl -X POST -H "x-admin-token: $ADMIN_TOKEN" https://<site>/api/admin/host-codes`
