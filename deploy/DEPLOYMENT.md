# CostFX Deployment Guide

This document outlines the deployment process for the CostFX application.

## Recent Updates (September 2025)

- ✅ Added ECS-based database migration system
- ✅ Updated GitHub Actions with proper IAM permissions for EC2 networking
- ✅ Implemented Dave's inventory variance system with 8 database migrations

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
4. **Sufficient AWS permissions** for ECS, RDS, ECR, ALB, VPC
5. **OpenAI API Key** for the AI agents functionality

### Step 1: Initial Setup

```bash
# Clone and navigate to the project
cd /path/to/costfx

# Setup Terraform state bucket (one-time setup)
./deploy/scripts/setup-terraform-state.sh

# Setup ECR repositories
./deploy/scripts/setup-ecr.sh
```

### Step 2: Configure Environment Variables

```bash
# Copy example configuration
cp deploy/terraform/terraform.tfvars.example deploy/terraform/terraform.tfvars

# Edit with your specific values
vim deploy/terraform/terraform.tfvars
```

Required variables:
- `ssl_certificate_arn` - Your SSL certificate ARN from ACM
- `environment` - Environment name (dev, staging, prod)
- `app_name` - Application name (default: costfx)

### Step 3: Deploy Infrastructure

```bash
# Use the deployment script for automated deployment
./deploy/scripts/deploy.sh

# This will:
# 1. Initialize Terraform
# 2. Deploy AWS infrastructure
# 3. Build and push Docker images
# 4. Deploy ECS services
# 5. Create required SSM parameters
```

### Step 4: Set Required Secrets

After infrastructure deployment, set your OpenAI API key:

```bash
# Set OpenAI API key (required for AI agents)
aws ssm put-parameter \
  --name '/costfx/dev/openai_api_key' \
  --value 'sk-your-openai-api-key-here' \
  --type SecureString \
  --overwrite \
  --region us-west-2
```

### Step 5: Verify Deployment

```bash
# Check service status
aws ecs describe-services \
  --cluster costfx-dev-cluster \
  --services costfx-dev-backend costfx-dev-frontend \
  --region us-west-2

# Get application URL
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[?LoadBalancerName==`costfx-dev-alb`].DNSName' \
  --output text \
  --region us-west-2

# Test the API
curl http://your-alb-url/api/v1/health
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

## 🛠️ Troubleshooting

### Common Issues

#### Backend ECS Tasks Failing

**Problem**: Backend tasks fail to start with database connection errors
```
ERROR: no pg_hba.conf entry for host "xxx", user "xxx", database "xxx", no encryption
```

**Solution**: Ensure SSL configuration is correct
```bash
# Check current environment variables in ECS task definition
aws ecs describe-task-definition \
  --task-definition costfx-dev-backend \
  --query 'taskDefinition.containerDefinitions[0].environment'

# Should include:
# - PGSSLMODE=no-verify
# - PORT=3001
```

**Fix**: Update task definition with correct SSL settings
```bash
# Re-deploy with SSL environment variables
./deploy/scripts/deploy.sh --update-ssm-only
```

#### 502 Bad Gateway Errors

**Problem**: Load balancer returns 502 errors

**Diagnostic Steps**:
```bash
# Check ECS service status
aws ecs describe-services \
  --cluster costfx-dev-cluster \
  --services costfx-dev-backend costfx-dev-frontend

# Check task health
aws ecs list-tasks --cluster costfx-dev-cluster
aws ecs describe-tasks --cluster costfx-dev-cluster --tasks <task-arn>

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --query 'TargetGroups[?TargetGroupName==`costfx-dev-backend-tg`].TargetGroupArn' \
    --output text)
```

**Common Fixes**:
1. **Port mismatch**: Ensure backend runs on port 3001
2. **Health check failure**: Check `/api/v1/health` endpoint
3. **Security group**: Ensure ALB can reach ECS tasks on port 3001

#### Database Connection Issues

**Problem**: Cannot connect to RDS database

**Diagnostic**:
```bash
# Check RDS instance status
aws rds describe-db-instances \
  --db-instance-identifier costfx-dev-db

# Check security groups
aws ec2 describe-security-groups \
  --group-ids $(aws rds describe-db-instances \
    --db-instance-identifier costfx-dev-db \
    --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
    --output text)
```

**Solutions**:
1. **SSL Required**: RDS requires SSL in production
2. **Security Groups**: Ensure ECS security group can access RDS port 5432
3. **Subnet Groups**: Ensure RDS is in correct VPC subnets

#### Docker Build Failures

**Problem**: Docker builds fail during deployment

**Check**:
```bash
# Test local Docker builds
docker build -f Dockerfile.backend -t costfx-backend .
docker build -f Dockerfile.frontend -t costfx-frontend .

# Check for common issues:
# - Node.js version compatibility
# - Package.json dependencies
# - Build context size
```

#### ECR Push Failures

**Problem**: Cannot push images to ECR

**Solution**:
```bash
# Re-authenticate with ECR
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin \
  568530517605.dkr.ecr.us-west-2.amazonaws.com

# Check repository exists
aws ecr describe-repositories --region us-west-2
```

### Performance Monitoring

Monitor your deployment:

```bash
# ECS Service Metrics
aws ecs describe-services \
  --cluster costfx-dev-cluster \
  --services costfx-dev-backend costfx-dev-frontend \
  --query 'services[*].{Name:serviceName,Running:runningCount,Desired:desiredCount,Status:status}'

# Load Balancer Health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --query 'TargetGroups[?contains(TargetGroupName,`costfx-dev`)].TargetGroupArn' \
    --output text)

# CloudWatch Logs
aws logs describe-log-groups --log-group-name-prefix "/ecs/costfx-dev"
aws logs tail "/ecs/costfx-dev-backend" --follow
```

### Rollback Procedures

If deployment fails:

```bash
# Revert to previous task definition
aws ecs update-service \
  --cluster costfx-dev-cluster \
  --service costfx-dev-backend \
  --task-definition costfx-dev-backend:PREVIOUS_REVISION

# Scale down for maintenance
./deploy/scripts/scale-down-dev.sh

# Scale back up after fixes
./deploy/scripts/scale-up-dev.sh
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
| `/costfx/{env}/database_url` | SecureString | ✅ Yes | PostgreSQL connection string with SSL |
| `/costfx/{env}/redis_url` | SecureString | ✅ Yes | ElastiCache Redis connection string |
| `/costfx/{env}/jwt_secret` | SecureString | ✅ Yes | JWT signing secret (64 random chars) |
| `/costfx/{env}/openai_api_key` | SecureString | ❌ Manual | OpenAI API key for AI agents |

**Auto-generated secrets** are created during Terraform deployment with secure random values.
**Manual secrets** must be set after initial deployment using the AWS CLI.

### Current Working Configuration

The deployment includes these tested environment variables for ECS tasks:

**Backend Environment Variables**:
- `NODE_ENV=production`
- `PORT=3001` (critical for ALB health checks)
- `PGSSLMODE=no-verify` (required for RDS SSL connections)
- Database and Redis URLs loaded from SSM Parameter Store
- JWT secret loaded from SSM Parameter Store

**Frontend Environment Variables**:
- `NODE_ENV=production`
- `VITE_API_URL` configured during Docker build

### SSL/TLS Configuration

**Database SSL**: 
- RDS requires SSL connections in production
- Backend automatically detects RDS hostnames and enables SSL
- `PGSSLMODE=no-verify` handles certificate validation

**Load Balancer SSL**:
- HTTPS termination at ALB level
- HTTP automatically redirects to HTTPS
- Modern TLS 1.3 security policy

Ready for production deployment with enterprise-grade security! 🚀
