#!/bin/bash
set -e

echo "🚀 CostFX GitHub Actions Setup"
echo "=============================="
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI configured"

# Get AWS account info
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)
echo "📍 AWS Account: $ACCOUNT_ID"
echo "📍 AWS Region: $AWS_REGION"
echo ""

# Step 1: Setup Terraform state bucket
echo "Step 1: Setting up Terraform state bucket..."
if [ -f "deploy/scripts/setup-terraform-state.sh" ]; then
    ./deploy/scripts/setup-terraform-state.sh
else
    echo "❌ Terraform state setup script not found"
    exit 1
fi
echo ""

# Step 2: Setup ECR repositories
echo "Step 2: Setting up ECR repositories..."
if [ -f "deploy/scripts/setup-ecr.sh" ]; then
    ./deploy/scripts/setup-ecr.sh
else
    echo "❌ ECR setup script not found"
    exit 1
fi
echo ""

# Step 3: Generate secrets
echo "Step 3: Generating application secrets..."
JWT_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 16)

echo "🔐 Generated Secrets (add these to GitHub):"
echo "==========================================="
echo "JWT_SECRET = $JWT_SECRET"
echo "DB_PASSWORD = $DB_PASSWORD"
echo ""

# Step 4: Show GitHub setup instructions
echo "Step 4: GitHub Secrets Setup"
echo "============================"
echo "Add these secrets to your GitHub repository:"
echo "(Repository → Settings → Secrets and variables → Actions)"
echo ""
echo "AWS Credentials:"
echo "- AWS_ACCESS_KEY_ID = [Your AWS Access Key]"
echo "- AWS_SECRET_ACCESS_KEY = [Your AWS Secret Key]"
echo "- AWS_REGION = $AWS_REGION"
echo ""
echo "Terraform:"
echo "- TERRAFORM_STATE_BUCKET = [Bucket name from Step 1]"
echo ""
echo "Application:"
echo "- JWT_SECRET = $JWT_SECRET"
echo "- DB_PASSWORD = $DB_PASSWORD"
echo "- OPENAI_API_KEY = [Your OpenAI API Key]"
echo ""

# Step 5: Update Terraform backend
echo "Step 5: Next Steps"
echo "=================="
echo "1. Update deploy/terraform/main.tf with your Terraform state bucket name"
echo "2. Add all secrets to GitHub as shown above"
echo "3. Push to main, develop, or feature/aws-deploy-v1 branch to trigger deployment"
echo ""
echo "🎉 GitHub Actions setup complete!"
echo ""
echo "Deployment will happen automatically when you push to:"
echo "- main (production environment)"
echo "- develop (development environment)"  
echo "- feature/aws-deploy-v1 (current branch)"
