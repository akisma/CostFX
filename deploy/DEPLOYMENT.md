# CostFX AWS ECS Deployment

This directory contains the complete infrastructure and deployment configuration for deploying CostFX to AWS ECS with separate frontend and backend containers.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   CloudFront    │    │  Application     │
│   (Optional)    │────│  Load Balancer   │
└─────────────────┘    └─────────┬────────┘
                                 │ HTTPS
                       ┌─────────▼────────┐
                       │   ECS Cluster    │
                       │ ┌─────┐ ┌─────┐  │
                       │ │Front│ │Back │  │
                       │ │ end │ │ end │  │
                       │ └─────┘ └─────┘  │
                       └─────────┬────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  │              │              │
            ┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐
            │   RDS    │  │   Redis  │  │   ECR    │
            │PostgreSQL│  │ElastiCache│  │Container │
            └──────────┘  └──────────┘  └─Registry─┘
```

### Components

- **Frontend**: React app served by Nginx in a container
- **Backend**: Node.js API server in a container
- **Database**: AWS RDS PostgreSQL (managed)
- **Cache**: AWS ElastiCache Redis (managed)
- **Load Balancer**: Application Load Balancer with HTTPS/TLS termination
- **Container Registry**: AWS ECR for Docker images with vulnerability scanning
- **Secrets**: AWS Systems Manager Parameter Store (encrypted)
- **Security**: SSL/TLS encryption, auto HTTP→HTTPS redirect

## 🔐 Security Features

### Encryption & TLS
- **HTTPS enforced**: All traffic redirected to HTTPS with modern TLS 1.3 policy
- **SSL certificate**: AWS Certificate Manager integration
- **Secrets management**: All sensitive data encrypted in SSM Parameter Store
- **Container security**: ECR vulnerability scanning enabled

### Network Security
- **VPC isolation**: Private subnets for database and cache
- **Security groups**: Restrictive ingress/egress rules
- **Database SSL**: Enforced SSL connections in production
- **No hardcoded secrets**: All secrets generated or managed via SSM

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Docker** installed and running
3. **Terraform** >= 1.0 installed
4. **SSL Certificate** created in AWS Certificate Manager
5. **Sufficient AWS permissions**

### 1. Setup SSL Certificate

```bash
# Request SSL certificate via AWS Certificate Manager
aws acm request-certificate \
  --domain-name your-domain.com \
  --validation-method DNS \
  --region us-west-2

# Note the certificate ARN from the output
```

### 2. Configure Environment

```bash
# Copy example configuration
cp deploy/terraform/terraform.tfvars.example deploy/terraform/terraform.tfvars

# Edit configuration for your environment
vim deploy/terraform/terraform.tfvars
```

### 3. Deploy Infrastructure

```bash
# Deploy via GitHub Actions (recommended)
git push origin main

# OR deploy manually via Terraform
cd deploy/terraform
terraform init
terraform plan
terraform apply
```

### 4. Set Required Secrets

After infrastructure deployment, set these required parameters in AWS SSM:

```bash
# Set OpenAI API key (required)
aws ssm put-parameter \
  --name '/costfx/dev/openai_api_key' \
  --value 'sk-your-openai-api-key-here' \
  --type SecureString \
  --overwrite

# Set SSL certificate ARN (required for HTTPS)
aws ssm put-parameter \
  --name '/costfx/dev/ssl_certificate_arn' \
  --value 'arn:aws:acm:us-west-2:123456789012:certificate/your-cert-id' \
  --type SecureString \
  --overwrite
```

### 5. Verify Deployment

```bash
# Check deployment status
aws ecs describe-services \
  --cluster costfx-dev-cluster \
  --services costfx-dev-backend costfx-dev-frontend

# Get load balancer URL
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[?LoadBalancerName==`costfx-dev-alb`].DNSName' \
  --output text
```

## 🧪 Local Testing

Test the containerized setup locally before deploying:

```bash
# Test with default ports (3001 backend, 8080 frontend)
./deploy/scripts/test-local.sh

# Test with custom ports
BACKEND_EXTERNAL_PORT=3002 FRONTEND_EXTERNAL_PORT=8081 ./deploy/scripts/test-local.sh

# GitHub Actions compatible (no user input)
GITHUB_ACTIONS=true ./deploy/scripts/test-local.sh
```

## ⚙️ Configuration

### Environment Variables

The deployment script supports these environment variables:

- `AWS_REGION` - AWS region (default: us-west-2)
- `ENVIRONMENT` - Environment name (default: dev)
- `APP_NAME` - Application name (default: costfx)

### Port Configuration

For testing flexibility:

- `BACKEND_PORT` - Internal backend port (default: 3001)
- `FRONTEND_PORT` - Internal frontend port (default: 80)
- `BACKEND_EXTERNAL_PORT` - External backend port (default: 3001)
- `FRONTEND_EXTERNAL_PORT` - External frontend port (default: 8080)

## 🎯 GitHub Actions Deployment

This deployment is designed for secure CI/CD with GitHub Actions:

### Required GitHub Secrets

Set these secrets in your GitHub repository settings (`Settings → Secrets and variables → Actions`):

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Terraform State Management
TERRAFORM_STATE_BUCKET=your-terraform-state-bucket-name
```

### GitHub Actions Features

- ✅ **Configurable ports** for parallel testing
- ✅ **No hardcoded URLs** - everything is environment-driven
- ✅ **Non-interactive mode** when `GITHUB_ACTIONS=true`
- ✅ **Proper cleanup** and error handling
- ✅ **Build args** for frontend API URL configuration
- ✅ **Terraform plan/apply** with proper state management
- ✅ **Multi-environment support** (dev/staging/prod)

### Deployment Workflow

```yaml
# Triggered on:
# - Push to main branch (production)
# - Push to develop branch (development)
# - Manual workflow dispatch

name: Deploy to AWS
on:
  push:
    branches: [main, develop]
  workflow_dispatch:

# Automatic process:
# 1. Run tests
# 2. Build Docker images
# 3. Push to ECR
# 4. Deploy via Terraform
# 5. Health checks
```

### Security Best Practices

- 🔐 **No secrets in code**: All sensitive data in SSM Parameter Store
- 🔒 **HTTPS enforced**: Automatic HTTP→HTTPS redirect
- 🛡️ **Container scanning**: ECR vulnerability scanning enabled
- 🔑 **Least privilege**: IAM roles with minimal required permissions
- 📊 **Audit trail**: CloudWatch logs for all deployments

## 🔧 Key Features

### Security & Compliance
- **HTTPS enforced**: All traffic encrypted with TLS 1.3
- **Secrets management**: Zero secrets in code or environment variables
- **Database encryption**: SSL enforced for all database connections
- **Container security**: Vulnerability scanning on all images
- **Network isolation**: Private subnets and security groups

### Flexible Port Management
- **Production**: Uses standard ports (3001 backend, 80 frontend)
- **Testing**: Configurable external ports to avoid conflicts
- **GitHub Actions**: Can run multiple test environments in parallel

### Container Separation
- **Frontend**: Static React build served by Nginx
- **Backend**: Node.js API with health checks
- **Independent scaling**: Each service can scale separately
- **Build-time configuration**: API URLs configured during Docker build

### Infrastructure as Code
- **Terraform**: Complete AWS infrastructure with state management
- **Security**: Private subnets, security groups, encrypted secrets
- **Monitoring**: CloudWatch logs and health checks
- **Cost-optimized**: t3.micro instances for development
- **Multi-environment**: Support for dev/staging/prod

### Secrets Management via SSM Parameter Store

All sensitive configuration is stored securely in AWS SSM Parameter Store:

| Parameter | Type | Auto-Generated | Description |
|-----------|------|----------------|-------------|
| `/costfx/{env}/database_url` | SecureString | ✅ Yes | PostgreSQL connection string |
| `/costfx/{env}/redis_url` | SecureString | ✅ Yes | Redis connection string |
| `/costfx/{env}/jwt_secret` | SecureString | ✅ Yes | JWT signing secret (64 chars) |
| `/costfx/{env}/openai_api_key` | SecureString | ❌ Manual | OpenAI API key |
| `/costfx/{env}/ssl_certificate_arn` | SecureString | ❌ Manual | SSL certificate ARN |

**Auto-generated secrets** are created during Terraform deployment and never need manual intervention.
**Manual secrets** must be set after initial deployment as shown in the Quick Start guide.

Ready for production deployment with enterprise-grade security! 🚀
