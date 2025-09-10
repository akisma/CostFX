#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-us-west-2}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
APP_NAME="costfx"
ROOT_DIR="$(git rev-parse --show-toplevel)"
INFRA_DIR="$ROOT_DIR/deploy/infra"
BACKEND_FILE="$INFRA_DIR/backend-${ENVIRONMENT}.hcl"

echo "[deploy] Starting end-to-end deploy for env=$ENVIRONMENT region=$REGION account=$ACCOUNT_ID"

if [ ! -f "$BACKEND_FILE" ]; then
  echo "[deploy] Bootstrapping remote state..."
  AWS_REGION=$REGION ENV=$ENVIRONMENT "$INFRA_DIR/scripts/bootstrap-remote-state.sh" "$ENVIRONMENT"
fi

pushd "$INFRA_DIR" >/dev/null

echo "[deploy] Terraform init (per-env key, no workspaces)"
terraform init -reconfigure -backend-config="$BACKEND_FILE" -input=false
if terraform workspace show 2>/dev/null | grep -vq '^default$'; then
  echo "[deploy] Switching to default workspace (workspaces deprecated in this layout)"
  terraform workspace select default || true
fi

echo "[deploy] Phase 1 apply (core infra, no ECS)"
terraform apply -auto-approve \
  -var-file="environments/${ENVIRONMENT}/terraform.tfvars" \
  -var create_ecs=false \
  -var backend_image=placeholder \
  -var frontend_image=placeholder

echo "[deploy] Building & pushing images"
chmod +x scripts/build-push-images.sh
AWS_ACCOUNT_ID=$ACCOUNT_ID GIT_SHA=$(git rev-parse --short HEAD) AWS_REGION=$REGION \
  scripts/build-push-images.sh "$ENVIRONMENT"

BACKEND_IMG=$(cat "environments/${ENVIRONMENT}/.backend_image")
FRONTEND_IMG=$(cat "environments/${ENVIRONMENT}/.frontend_image")

echo "[deploy] Phase 2 apply (ECS services)"
terraform apply -auto-approve \
  -var-file="environments/${ENVIRONMENT}/terraform.tfvars" \
  -var backend_image="$BACKEND_IMG" \
  -var frontend_image="$FRONTEND_IMG" \
  -var create_ecs=true

ALB_DNS=$(terraform output -raw alb_dns 2>/dev/null || true)
echo "[deploy] ALB DNS: $ALB_DNS"

echo "[verify] Waiting 60s for tasks to stabilize..."
sleep 60

set +e
echo "[verify] Backend health:"
curl -fsS "http://${ALB_DNS}/health" || echo "(backend /health failed)"
echo
echo "[verify] Backend API root:"
curl -fsS "http://${ALB_DNS}/api/v1/" || echo "(backend /api/v1 failed)"
echo
echo "[verify] Frontend root:"
curl -I -s "http://${ALB_DNS}/" | head -n 1
set -e

echo "[logs] To tail logs (example):"
echo "aws logs tail --since 10m /ecs/${APP_NAME}-${ENVIRONMENT} --follow"

popd >/dev/null
echo "[deploy] Complete"
