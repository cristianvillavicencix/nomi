#!/usr/bin/env bash
# Deploy Nomi mail-imap worker to Google Cloud Run (SMTP-capable; Render free tier blocks 465/587).
#
# Usage:
#   export GCP_PROJECT_ID="your-gcp-project"
#   export MAIL_IMAP_WORKER_SECRET="same-secret-as-supabase"
#   export SUPABASE_URL="https://qjglkywmqwqdoaboakao.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="..."
#   ./scripts/deploy-cloud-run.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${MAIL_IMAP_WORKER_SECRET:?Set MAIL_IMAP_WORKER_SECRET — must match Supabase Edge secret}"
: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY}"

GCP_REGION="${GCP_REGION:-us-east1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-nomi-mail-imap}"
AR_REPO="${ARTIFACT_REGISTRY_REPO:-nomi-workers}"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${AR_REPO}/mail-imap:latest"

echo "==> Project: ${GCP_PROJECT_ID}  Region: ${GCP_REGION}  Service: ${SERVICE_NAME}"

gcloud config set project "${GCP_PROJECT_ID}"

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

if ! gcloud artifacts repositories describe "${AR_REPO}" --location="${GCP_REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --location="${GCP_REGION}" \
    --repository-format=docker \
    --description="Nomi workers"
fi

gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

# Regional builds required on this project (global Cloud Build returns 403 for new billing).
gcloud builds submit --region="${GCP_REGION}" --tag "${IMAGE}" .

ENV_VARS="SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},MAIL_IMAP_WORKER_SECRET=${MAIL_IMAP_WORKER_SECRET}"

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${GCP_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 120 \
  --concurrency 10 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "${ENV_VARS}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${GCP_REGION}" --format='value(status.url)')"
echo ""
echo "=============================================="
echo "Deployed: ${SERVICE_URL}"
echo "Health:   ${SERVICE_URL}/health"
echo ""
echo "Update Supabase Edge secrets:"
echo "  supabase secrets set \\"
echo "    MAIL_IMAP_WORKER_URL='${SERVICE_URL}' \\"
echo "    MAIL_IMAP_WORKER_SECRET='${MAIL_IMAP_WORKER_SECRET}' \\"
echo "    --project-ref qjglkywmqwqdoaboakao"
echo ""
echo "Verify SMTP path (optional, needs valid account_id):"
echo "  curl -s '${SERVICE_URL}/health'"
echo "=============================================="
