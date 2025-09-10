#!/usr/bin/env bash
set -euo pipefail

REGION=${AWS_REGION:-us-west-2}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
APP_NAME=${APP_NAME:-costfx}
BUCKET="${APP_NAME}-tf-state-${ACCOUNT_ID}"
TABLE="${APP_NAME}-tf-locks"

echo "Using bucket: $BUCKET" >&2
echo "Using lock table: $TABLE" >&2

if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Creating state bucket..." >&2
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint=$REGION
  aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
else
  echo "Bucket already exists." >&2
fi

if ! aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  echo "Creating DynamoDB lock table..." >&2
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
else
  echo "Lock table already exists." >&2
fi

cat <<EOF
# Backend configuration values (use with terraform init -backend-config):
bucket=$BUCKET
key=infra/dev/terraform.tfstate
region=$REGION
dynamodb_table=$TABLE
encrypt=true
EOF
