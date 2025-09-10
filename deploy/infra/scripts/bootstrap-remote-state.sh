#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
ENVIRONMENT="${ENV:-${1:-dev}}"
APP_NAME="costfx"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

BUCKET_NAME="${APP_NAME}-tf-state-${ACCOUNT_ID}" # globally unique per account
LOCK_TABLE="${APP_NAME}-tf-lock"

echo "[state] Ensuring S3 bucket: $BUCKET_NAME (region: $REGION)"
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION"
  echo "[state] Created bucket"
else
  echo "[state] Bucket already exists"
fi

echo "[state] Enabling versioning (required for state rollback)"
aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" --versioning-configuration Status=Enabled

echo "[state] Enabling default encryption"
aws s3api put-bucket-encryption --bucket "$BUCKET_NAME" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo "[state] Ensuring DynamoDB table: $LOCK_TABLE"
if ! aws dynamodb describe-table --table-name "$LOCK_TABLE" >/dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "[state] Waiting for lock table to become ACTIVE..."
  aws dynamodb wait table-exists --table-name "$LOCK_TABLE"
else
  echo "[state] Lock table already exists"
fi

# Write backend file into current working directory (expected to be deploy/infra)
BACKEND_FILE="backend-${ENVIRONMENT}.hcl"
STATE_KEY="env/${ENVIRONMENT}/infra.tfstate"
cat > "$BACKEND_FILE" <<EOF
bucket         = "${BUCKET_NAME}"
key            = "${STATE_KEY}"
region         = "${REGION}"
dynamodb_table = "${LOCK_TABLE}"
encrypt        = true
EOF

echo "[state] Backend config written: $BACKEND_FILE (key=${STATE_KEY})"
echo "[state] Next: terraform init -reconfigure -backend-config=$BACKEND_FILE"
