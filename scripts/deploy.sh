#!/bin/sh
# Deploys the API to Cloud Run and the web app to Firebase Hosting.
#
#   PROJECT=<gcp-project-id> ./scripts/deploy.sh            # both
#   PROJECT=<gcp-project-id> ./scripts/deploy.sh api|web    # one of them
#
# One-time setup (see README "Deploy"): billing on the project, Firebase added to it,
# secrets DATABASE_URL / GEMINI_API_KEY / ADMIN_TOKEN in Secret Manager.
set -eu
cd "$(dirname "$0")/.."

: "${PROJECT:?set PROJECT to the GCP project id}"
REGION="${REGION:-southamerica-east1}"
SERVICE="${SERVICE:-boranois-api}"
WHAT="${1:-all}"

if [ "$WHAT" = "api" ] || [ "$WHAT" = "all" ]; then
  # Builds from the root Dockerfile with Cloud Build and deploys. The site URL is what magic links point at.
  SITE_URL="${SITE_URL:-https://$PROJECT.web.app}"
  ADMIN_EMAILS="${ADMIN_EMAILS:-$(grep -s '^ADMIN_EMAILS=' apps/api/.env | cut -d= -f2- | tr -d '"')}"
  [ -n "$ADMIN_EMAILS" ] || { echo "ADMIN_EMAILS is empty (set it in apps/api/.env). Aborting." >&2; exit 1; }
  # Magic links need Resend. Checked loudly: a silent miss once shipped an API without e-mail.
  if gcloud secrets describe RESEND_API_KEY --project "$PROJECT" >/dev/null && gcloud secrets describe EMAIL_FROM --project "$PROJECT" >/dev/null; then
    EMAIL_SECRETS=",RESEND_API_KEY=RESEND_API_KEY:latest,EMAIL_FROM=EMAIL_FROM:latest"
  else
    echo "RESEND_API_KEY / EMAIL_FROM not readable in Secret Manager. Aborting (sign-in by e-mail would be off)." >&2; exit 1
  fi
  gcloud run deploy "$SERVICE" \
    --project "$PROJECT" --region "$REGION" \
    --source . \
    --allow-unauthenticated \
    --min-instances 0 --max-instances 2 --memory 512Mi --cpu 1 --concurrency 80 \
    --set-env-vars "^|^NODE_ENV=production|WEB_ORIGIN=$SITE_URL|CONTENT_DIR=/app/content|ADMIN_EMAILS=$ADMIN_EMAILS" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,ADMIN_TOKEN=ADMIN_TOKEN:latest$EMAIL_SECRETS"
fi

if [ "$WHAT" = "web" ] || [ "$WHAT" = "all" ]; then
  npm run build -w @boranois/web
  firebase deploy --only hosting --project "$PROJECT"
fi
