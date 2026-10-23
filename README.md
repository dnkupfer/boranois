# Boranois

**Convença alguém que você conhece a ir votar.**

Boranois helps progressive Brazilians talk, one to one, with people they already know (family, friends, neighbours) about voting in the presidential runoff on **25 October 2026**. It focuses on people who skipped the first round, voted blank or null, or are wavering.

You add a person, answer a few quick questions about them, and the app tells you:

- how that person probably thinks, and why,
- how good your chance is,
- what to say first, in your own voice,
- what to do after they reply.

Every message is sent **by you**, from your own WhatsApp, in your own words. The app never sends anything, never posts, never automates.

Live at **https://boranois.web.app**.

---

## Why it works this way

Elections are fought on social media, but a vote is decided close to home. The premise of the whole project:

> **Opinion doesn't come from facts. It comes from the group.**

People believe what the people they trust believe. A fact from outside the group bounces off; a question from inside it gets in. So the person most able to move a vote is not a politician or a video, but someone the voter already knows and trusts. Boranois exists to help that person have a better conversation.

### The method

Six principles, shown in the app at `/como-funciona`:

1. **It's not about facts. It's about belonging.** Ask from inside the group, don't argue from outside it.
2. **Listen first.** Ask, then be quiet. What they say in the first minutes is worth more than any argument.
3. **Ask questions that make people think.** "On a scale of 0 to 10, how sure are you?" "What would make you think differently?"
4. **Tell stories, not theses.** What you lived, or someone in their group lived, persuades more than a number.
5. **Resist the temptation of facts.** Sending a link is the easiest and least effective thing to do. Facts only when asked, one at a time, with a source.
6. **They decide.** No pressure, no guilt, no insisting. The relationship continues after election day.

And the five rules on the home page, readable in three seconds:

> 1. Pergunte. Depois cale. · 2. Não mande link. · 3. Fato só se ela pedir. Um. · 4. Não discuta. Nunca. · 5. Ela decide.

### Influence, not manipulation

> **Manipulating** is getting someone to act against their own interest. **Influencing** is helping them decide in their own interest.
>
> The test: *if they knew exactly what you were doing and why, would they thank you or feel used?*

### Sources

- David McRaney, [*How Minds Change*](https://www.davidmcraney.com/howmindschangehome) (2022): nobody changes their mind defeated; they change when they feel safe enough to doubt.
- Broockman & Kalla, [*Durably reducing transphobia: A field experiment on door-to-door canvassing*](https://doi.org/10.1126/science.aad9713), Science (2016): ten-minute conversations about personal experience changed opinions durably (deep canvassing).
- [Street Epistemology](https://www.streetepistemology.com/): asking how sure someone is and why, instead of arguing against what they believe.
- Nickerson & Rogers (2010), implementation intentions: people who already intend to vote turn out more when they make a concrete plan (time, place, company). This drives the "decided, but no plan" persona.

---

## How it decides

**Deterministic core, AI at the edges, humans own the content.**

The decisions (who this person is, how good the chance is, what to do next) are made by plain rules over a hand-written, published catalogue. Same inputs and same catalogue give the same answer, and the reasons are shown to the user ("por quê?"). AI only helps with wording.

### 1. Personas

A person is described by tappable chips: their situation in the first round, your relationship, how often you talk, what they say, what worries them, which groups they belong to, who they listen to, when they lost trust. Answers come one question at a time, and each question depends on the previous answer. Users can type their own answer when no chip fits.

The chips match the person to one of twelve **personas**. Each persona is named after the obstacle you have to overcome, from the convincing point of view, not after who the person is:

| Persona | Starting chance |
|---|---|
| Quem acha que já está decidido | Boa chance |
| Quem quer votar, mas não consegue ir | Boa chance |
| Quem prefere não votar a votar errado | Boa chance |
| Quem acha que não adianta | Boa chance |
| Quem não quer nenhum dos dois | Boa chance |
| Quem acha que voltar a votar é perdoar | Vale tentar |
| Quem acha que a esquerda é contra Deus | Vale tentar |
| Quem acha que é hora de gente nova | Vale tentar |
| Quem acha que só a dureza protege | Vale tentar |
| Quem quer testar o outro no bolso | Vale tentar |
| Quem acha que vai, mas não tem plano | Difícil (already votes Lula: the gain is a second vote, via them) |
| Quem tem certeza que o PT roubou | Melhor não |

Each persona has, written by people: how they got here, what they feel, where they hear what they hear, who they would believe, what shuts them down, what opens them up, what could turn the key, concrete tactics, what to avoid, and a step-by-step conversation plan. All of it is public at `/perfis` and in [content/personas/](content/personas/). If you recognise yourself in one and think it's unfair, open an issue.

### Two ways in: someone you know, or a stranger on the street

Most people won't add anyone to a list, and don't need to. The home page lists the twelve personas by **the sentence each one says** ("não adianta", "sou de Deus, não de política"); tap one and the full guide opens, with nothing saved. Saving a person is the optional second step, for people who want the follow-up loop (what to send, how long to wait, what to do with the reply).

**Na rua** (`/rua`) is the street version: two minutes with someone you don't know, at a fair, a bus stop, a school gate. The goal shrinks from convincing to leaving a doubt and a plan for Sunday. Each persona carries a street script in the catalogue (`rua`: *abra*, *diga*, *feche*). The page is static: no account, no database, no AI. It also states the legal line: talking to voters is allowed until Saturday 22h; on election day it is *boca de urna*, a crime (Lei 9.504, art. 39 §5), and the page says so by itself on that date.

### 2. Chance (the chip next to each person)

How likely a conversation is to work, so people spend their time where it helps most.

| Level | Chip | Meaning |
|---|---|---|
| `alta` | **Boa chance** | Worth your time first. |
| `media` | **Vale tentar** | Possible, but slower or harder. |
| `baixa` | **Difícil** | Different group, rarely in touch, or very set. |
| `engage: false` | **Melhor não** | Don't try: talking only hardens them. |

Each persona has a starting level. Then, from [content/scoring.json](content/scoring.json):

| Signal | Effect |
|---|---|
| You share a group (family always counts) | +1 |
| You talk daily / rarely | +1 / −1 |
| They say "nunca muda" | −2 |
| After a message: replied well or asked a question | +1 |
| Cut the subject / said they won't vote | −1 |
| Said they'll vote / voted | +3 |

The result is clamped to the three levels. The person's page shows the reasons behind it.

### 3. State (the line under each name)

| State | Shown as |
|---|---|
| `novo` | ainda não conversaram |
| `aguardando` | esperando resposta · há X h |
| `conversando` | respondeu — sua vez |
| `objecao` | discordou — sua vez |
| `cortou` | cortou o assunto |
| `vai_votar` | vai votar ✓ |
| `votou` | votou ✓ |
| `perdido` | não vai votar |
| `pausado` | em pausa |

The list puts people waiting for your move first, then by chance; finished ones last. After a message the app suggests how long to wait before a light reminder, shows when you sent it, and lets you decide.

### 4. Where the AI comes in (Gemini)

- **Phrasing:** rewrites the planned message in the user's voice. Validated: it cannot add numbers, links or claims that weren't in the template.
- **Typed answers:** fits a free-text answer onto the existing question tree, or adds one follow-up question for that person. It can only point at options that exist. The user's own words are kept.
- **Vira-voto coach:** a chat on each person's page. Paste what they replied to understand what's behind it, or ask "what if they send me a video?". It can suggest a next message, which the user edits before sending.

It never decides what is true or what to do next. Without a `GEMINI_API_KEY`, the hand-written templates go out as they are.

### 5. Only true things

Every fact in [content/facts.json](content/facts.json) carries a source (TSE/TRE). Unverified facts are never served, and a step that depends on one is skipped.

---

## Casas de repouso: calling care homes for Sunday

A second tool inside the same app, at `/casas-de-repouso`, for a different audience: volunteers who spend Saturday on the phone. The idea: many residents of care homes (ILPIs) over 70 want to vote and have nobody to go with. Neighbours call the homes on Saturday, ask whether residents want company to the polling place, and on Sunday accompany them **on foot or by public transport** (the law bars anyone but the electoral courts from providing transport, Lei 6.091/74). Strictly non-partisan: no candidate, no material, no talk of votes.

- **Data:** every active establishment in the Receita Federal registry with main activity CNAE 8711-5 (ILPIs, geriatric residences, senior condos), via the Base dos Dados mirror on BigQuery: ~12,500 homes, ~9,500 with a registered phone. The CSV is in `content/lares/`; `npm run lares:import -w @boranois/api -- <csv> --source receita` loads or refreshes it (never touching status or notes).
- **Flow:** enter a CEP to see the nearest homes (same city first, then same state), or filter by state, city, status and name. "Estou ligando" claims the home so nobody else calls it; the claim expires after two hours without an update. The home page has the phone as a tap-to-call link, the script, outcome chips (não atendeu · telefone errado · sem interesse · têm interessados · ajuda combinada), and notes. A dashboard shows counts by status and state; a form lets neighbours offer to accompany residents near a given home.
- **No resident data, ever.** Only counts and what the staff said. Volunteer e-mails stay server-side and are shown to nobody; helpers' contacts are shown only on the home they offered for. All of it is to be deleted after 25 October 2026 (`delete from lares_claims; delete from lares_helpers;`).
- The tool needs Postgres (there is no file-store version); without `DATABASE_URL` its routes are absent.

## Privacy and the law

- **No account needed.** A session is created anonymously on the device. Email (magic link) is optional, only to continue on another device.
- **No phone numbers, ever.** The app doesn't ask for the other person's number; "Abrir no WhatsApp" opens WhatsApp with the text ready and the user picks the contact there.
- **Names, notes and coach conversations never leave the device.** The server knows a person only as an id plus chips, persona, state and outcome chips. Replies pasted into the coach are used for that answer and not stored.
- **Analytics only with consent**, first-party, anonymous: never names, phones or messages. Used to see where people drop off.
- **Gender:** users pick Ela / Ele / Elu, and all guidance is inflected accordingly, including non-binary forms.
- **Brazilian electoral law.** Nothing is boosted, paid for, mass-sent or automated (Lei 9.504/97). The relationship picker has no boss/employee option: pressuring subordinates is *assédio eleitoral*. The terms ask users to talk only with people they know, personally.

Terms of use: `/termos`. Privacy policy: `/privacidade`.

---

## For developers

```
apps/web/         Vite + React. Home, add-a-person flow, per-person guide with coach, method, profiles, legal
apps/api/         Express. Anonymous + magic-link sessions, catalogue loader, engine (match, chance, next step),
                  Gemini phrasing/interpretation/coach with validators, analytics, cost guards
content/          The catalogue: personas, question tree, facts with sources, contents, scoring weights
packages/shared/  Chip taxonomies, request/response schemas (zod)
design/           Static design explorations for the home page
```

### Run locally

```sh
npm install
npm run dev          # API on :8080, web on :5173 (proxies /api)
npm test             # catalogue checks, match/priority scenarios, phrasing validator
```

With no `apps/api/.env`, data goes to `apps/api/.data/dev.json`, no AI is used, and magic links are printed to the API log. Copy `apps/api/.env.example` to `.env` to set `GEMINI_API_KEY`, `DATABASE_URL` (Postgres; then `npm run db:migrate -w @boranois/api`) and `RESEND_API_KEY`.

### Changing the catalogue

Edit the JSON in `content/`, run `npm test`, **restart the API** (it reads the catalogue once at startup). The catalogue version (a hash) is stored with every contact and interaction, so a change never silently rewrites history. `apps/api/test/scenarios.json` is the regression suite for the scoring weights. Editing rules: [content/README.md](content/README.md).

### Deploy

Web on Firebase Hosting, API on Cloud Run (`southamerica-east1`), Postgres on Neon, secrets in Secret Manager.

One-time setup:

1. A GCP project with billing and Firebase added; enable `run`, `cloudbuild`, `artifactregistry` and `secretmanager` APIs.
2. A Neon project (`aws-sa-east-1`); run the migration with its **pooled** connection string.
3. Secrets: `DATABASE_URL`, `GEMINI_API_KEY`, `ADMIN_TOKEN`, optionally `RESEND_API_KEY` and `EMAIL_FROM`; grant the Cloud Run service account `roles/secretmanager.secretAccessor`.
4. `.firebaserc` pointing at the project.

Then `PROJECT=<id> ./scripts/deploy.sh` (or `api` / `web`). `ADMIN_EMAILS` is read from the environment or `apps/api/.env` and set on the service. Firebase's `/api/**` rewrite points at the Cloud Run service.

**Cost guards:** per-session, per-IP and daily caps on AI calls, a write rate limit (see `.env.example`), Cloud Run capped at 2 instances, and a GCP budget alert.

**Analytics:** first-party, stored in the same Postgres, no Google Analytics. List your e-mail in `ADMIN_EMAILS`, sign in with the magic link, and an **Admin** link appears in the menu: totals, a daily chart, the funnel, where people stop, personas, chance, replies, steps and coach use. Totals come from the app's own tables and count everyone; funnel and per-device numbers come from analytics events and only cover people who accepted measurement. For scripts, the same data as text: `GET /api/analytics/summary?days=7&format=md` with header `x-admin-token: $ADMIN_TOKEN`, or `npm run analytics -w @boranois/api`.

---

## Contributing

The most valuable contributions are to the **catalogue**, not the code: better personas, sharper tactics, verified facts with sources, and field reports of what worked or didn't. Open an issue or a pull request.

Questions, suggestions or problems: [boranois@kupfer.co](mailto:boranois@kupfer.co).
