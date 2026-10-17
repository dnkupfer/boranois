# Boranois

Helps small groups of volunteers (a host plus up to 5 friends) decide which Instagram posts are worth sharing with their group, based on a campaign objective the host picks.

```
apps/web/        Vite + React site: invite sign-up, host setup, extension install guide
apps/api/        Express API: invites, member tokens, /check scoring (Gemini), Neon/Postgres
apps/extension/  Chrome extension (MV3): one click on an open Instagram post -> verdict + suggested comment
packages/shared/ Objectives and request/response schemas used by web and api
```

**How the extension behaves:** it only reads the open post when the user clicks its toolbar button (`activeTab`). It has no standing access to Instagram, does nothing in the background, and never likes, comments or shares on its own. Every action on Instagram is taken by a person.

## Run locally

```sh
npm install
npm run dev                          # API on :8080, web on :5173 (proxies /api)
npm run host-code -w @boranois/api   # prints a host sign-up link
```

With no `.env`, the API stores data in `apps/api/.data/dev.json` and uses a keyword scorer for testing. To use Gemini, copy `apps/api/.env.example` to `apps/api/.env` and set `GEMINI_API_KEY`. To use Neon, set `DATABASE_URL` and run `npm run db:migrate -w @boranois/api`.

### Try the extension

1. Open the host link, sign in, and pick an objective.
2. In Chrome, go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `apps/extension`.
3. Reload the site. It should say "Extensão conectada ✓". The site hands its session token to the extension automatically.
4. Open an Instagram post (`instagram.com/p/...` or `/reel/...`) and click the extension's button.

After editing extension files, click the reload icon on its card in `chrome://extensions`.

## Deploy

- **Web:** `npm run build`, then `firebase deploy --only hosting`. Set the project in `.firebaserc`. `/api/**` is rewritten to the Cloud Run service `boranois-api` in `southamerica-east1`.
- **API:** build the root `Dockerfile` and deploy it to Cloud Run as `boranois-api` in `southamerica-east1`. Pass `DATABASE_URL` (Neon **pooled** string, region `aws-sa-east-1`), `GEMINI_API_KEY` and `ADMIN_TOKEN` from Secret Manager.
- **Extension:** add the production origin (e.g. `https://<project>.web.app/*`) to `host_permissions` and `content_scripts.matches` in `apps/extension/manifest.json`, then run `npm run extension:zip`. The site's download button serves that zip.
- **Host codes in production:** `curl -X POST -H "x-admin-token: $ADMIN_TOKEN" https://<site>/api/admin/host-codes`
