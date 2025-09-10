#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-us-west-2}"
ACCOUNT_ID=${AWS_ACCOUNT_ID:?"AWS_ACCOUNT_ID required"}
APP_NAME="costfx"
GIT_SHA=${GIT_SHA:-$(git rev-parse --short HEAD)}

echo "Logging into ECR..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

BACKEND_REPO="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/${APP_NAME}-${ENVIRONMENT}-backend"
FRONTEND_REPO="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/${APP_NAME}-${ENVIRONMENT}-frontend"

ROOT_DIR=$(git rev-parse --show-toplevel)
echo "Ensuring docker buildx builder exists..."
docker buildx inspect costfx-builder >/dev/null 2>&1 || docker buildx create --name costfx-builder --use
docker buildx use costfx-builder

echo "Building backend image (linux/amd64)... (context $ROOT_DIR)"
docker buildx build --platform linux/amd64 -f "$ROOT_DIR/Dockerfile.backend" -t "$BACKEND_REPO:$GIT_SHA" -t "$BACKEND_REPO:${ENVIRONMENT}-latest" --push "$ROOT_DIR"

echo "Building frontend image (linux/amd64)... (context $ROOT_DIR)"
docker buildx build --platform linux/amd64 -f "$ROOT_DIR/Dockerfile.frontend" -t "$FRONTEND_REPO:$GIT_SHA" -t "$FRONTEND_REPO:${ENVIRONMENT}-latest" --push "$ROOT_DIR"

echo "Images pushed via buildx."

echo "Retrieving digests..."
BACKEND_DIGEST=$(aws ecr describe-images --repository-name "${APP_NAME}-${ENVIRONMENT}-backend" --image-ids imageTag=$GIT_SHA --query 'imageDetails[0].imageDigest' --output text --region "$REGION")
FRONTEND_DIGEST=$(aws ecr describe-images --repository-name "${APP_NAME}-${ENVIRONMENT}-frontend" --image-ids imageTag=$GIT_SHA --query 'imageDetails[0].imageDigest' --output text --region "$REGION")

BACKEND_URI_DIGEST="${BACKEND_REPO}@${BACKEND_DIGEST}"
FRONTEND_URI_DIGEST="${FRONTEND_REPO}@${FRONTEND_DIGEST}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_ROOT="$(dirname "$SCRIPT_DIR")" # deploy/infra
ENV_DIR="$INFRA_ROOT/environments/${ENVIRONMENT}"
mkdir -p "$ENV_DIR"
echo -n "$BACKEND_URI_DIGEST" > "$ENV_DIR/.backend_image"
echo -n "$FRONTEND_URI_DIGEST" > "$ENV_DIR/.frontend_image"

cat > "$ENV_DIR/generated-images.auto.tfvars" <<EOF
backend_image = "${BACKEND_URI_DIGEST}"
frontend_image = "${FRONTEND_URI_DIGEST}"
create_ecs = true
EOF

echo "Generated: $ENV_DIR/generated-images.auto.tfvars"
echo "Backend: $BACKEND_URI_DIGEST"
echo "Frontend: $FRONTEND_URI_DIGEST"
