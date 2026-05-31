#!/usr/bin/env bash
# Deploy Nomi Web Audit worker to Google Cloud Run.
#
# Prerequisites (one-time):
#   1. GCP project with billing enabled
#   2. gcloud CLI: https://cloud.google.com/sdk/docs/install
#   3. gcloud auth login && gcloud auth application-default login
#
# Usage:
#   export GCP_PROJECT_ID="your-gcp-project"
#   export WEB_AUDIT_WORKER_SECRET="same-secret-as-supabase"
#   export GOOGLE_CRUX_API_KEY="optional-crux-key"
#   ./scripts/deploy-cloud-run.sh
#
# After deploy, update Supabase:
#   supabase secrets set WEB_AUDIT_WORKER_URL="https://..." --project-ref qjglkywmqwqdoaboakao

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID (e.g. export GCP_PROJECT_ID=my-project)}"
: "${WEB_AUDIT_WORKER_SECRET:?Set WEB_AUDIT_WORKER_SECRET — must match Supabase Edge secret}"

GCP_REGION="${GCP_REGION:-us-east1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-nomi-web-audit}"
AR_REPO="${ARTIFACT_REGISTRY_REPO:-nomi-workers}"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${AR_REPO}/web-audit:latest"
CALLBACK_URL="${WEB_AUDIT_CALLBACK_URL:-https://qjglkywmqwqdoaboakao.supabase.co/functions/v1/website_audit_callback}"
WORKER_ID="${WEB_AUDIT_WORKER_ID:-nomi-web-audit-cloudrun}"
TIMEOUT_MS="${WEB_AUDIT_TIMEOUT_MS:-900000}"

echo "==> Project: ${GCP_PROJECT_ID}  Region: ${GCP_REGION}  Service: ${SERVICE_NAME}"

gcloud config set project "${GCP_PROJECT_ID}"

echo "==> Enabling APIs (idempotent)..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

echo "==> Artifact Registry repo..."
if ! gcloud artifacts repositories describe "${AR_REPO}" --location="${GCP_REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --location="${GCP_REGION}" \
    --repository-format=docker \
    --description="Nomi workers"
fi

gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

echo "==> Building image (Cloud Build)..."
gcloud builds submit --tag "${IMAGE}" .

ENV_VARS="WEB_AUDIT_TIMEOUT_MS=${TIMEOUT_MS},WEB_AUDIT_WORKER_ID=${WORKER_ID},CHROME_PATH=/usr/bin/chromium,WEB_AUDIT_CALLBACK_URL=${CALLBACK_URL},WEB_AUDIT_WORKER_SECRET=${WEB_AUDIT_WORKER_SECRET}"
if [[ -n "${GOOGLE_CRUX_API_KEY:-}" ]]; then
  ENV_VARS="${ENV_VARS},GOOGLE_CRUX_API_KEY=${GOOGLE_CRUX_API_KEY}"
fi

echo "==> Deploying Cloud Run service..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${GCP_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 900 \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 5 \
  --no-cpu-throttling \
  --set-env-vars "${ENV_VARS}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${GCP_REGION}" --format='value(status.url)')"
echo ""
echo "=============================================="
echo "Deployed: ${SERVICE_URL}"
echo "Health:   ${SERVICE_URL}/health"
echo ""
echo "Next — update Supabase Edge secrets:"
echo "  supabase secrets set \\"
echo "    WEB_AUDIT_WORKER_URL='${SERVICE_URL}' \\"
echo "    WEB_AUDIT_WORKER_SECRET='${WEB_AUDIT_WORKER_SECRET}' \\"
echo "    --project-ref qjglkywmqwqdoaboakao"
echo ""
echo "Verify:"
echo "  curl -s '${SERVICE_URL}/health'"
echo "=============================================="
