#!/bin/bash
set -e

# Configuration
AWS_REGION="us-west-2"
BUCKET_NAME="costfx-terraform-state-$(date +%s)"  # Add timestamp to ensure uniqueness

echo "Setting up Terraform remote state..."
echo "Bucket name: $BUCKET_NAME"

# Create S3 bucket for Terraform state
aws s3 mb s3://$BUCKET_NAME --region $AWS_REGION

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket $BUCKET_NAME \
    --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
    --bucket $BUCKET_NAME \
    --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'

# Block public access
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration \
        BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "✅ Terraform state bucket created: $BUCKET_NAME"
echo ""
echo "Next steps:"
echo "1. Add this bucket name to your GitHub secrets as TERRAFORM_STATE_BUCKET"
echo "2. Update your Terraform backend configuration to use this bucket"
echo ""
echo "GitHub Secret:"
echo "TERRAFORM_STATE_BUCKET = $BUCKET_NAME"
