#!/bin/bash
set -e

# Setup ECR repositories for CostFX
AWS_REGION="${AWS_REGION:-us-west-2}"

echo "🚀 Setting up ECR repositories for CostFX..."

# Create backend repository
echo "Creating backend ECR repository..."
aws ecr create-repository \
    --repository-name costfx-backend \
    --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true || echo "Repository costfx-backend already exists"

# Create frontend repository  
echo "Creating frontend ECR repository..."
aws ecr create-repository \
    --repository-name costfx-frontend \
    --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true || echo "Repository costfx-frontend already exists"

echo "✅ ECR repositories are ready!"
echo ""
echo "Repository URIs:"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Backend:  $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/costfx-backend"
echo "Frontend: $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/costfx-frontend"
