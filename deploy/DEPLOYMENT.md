# CostFX AWS ECS Deployment

This directory contains the complete infrastructure and deployment configuration for deploying CostFX to AWS ECS with separate frontend and backend containers.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   CloudFront    │    │  Application     │
│   (Optional)    │────│  Load Balancer   │
└─────────────────┘    └─────────┬────────┘
                                 │
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
- **Load Balancer**: Application Load Balancer with path-based routing
- **Container Registry**: AWS ECR for Docker images
- **Secrets**: AWS Systems Manager Parameter Store

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Docker** installed and running
3. **Terraform** >= 1.0 installed
4. **Sufficient AWS permissions**

### 1. Configure Environment

```bash
# Copy example configuration
cp deploy/terraform/terraform.tfvars.example deploy/terraform/terraform.tfvars

# Edit configuration for your environment
vim deploy/terraform/terraform.tfvars
```

### 2. Deploy Everything

```bash
# One-command deployment
./deploy/scripts/deploy.sh
```

### 3. Update Secrets

```bash
# Set your OpenAI API key
aws ssm put-parameter \
  --name '/costfx/dev/openai_api_key' \
  --value 'your_openai_api_key_here' \
  --type SecureString \
  --overwrite
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

## 🎯 GitHub Actions Ready

This deployment is designed for CI/CD with GitHub Actions:

- ✅ **Configurable ports** for parallel testing
- ✅ **No hardcoded URLs** - everything is environment-driven
- ✅ **Non-interactive mode** when `GITHUB_ACTIONS=true`
- ✅ **Proper cleanup** and error handling
- ✅ **Build args** for frontend API URL configuration

Example GitHub Actions usage:

```yaml
- name: Test containers
  env:
    GITHUB_ACTIONS: true
    BACKEND_EXTERNAL_PORT: 3001
    FRONTEND_EXTERNAL_PORT: 8080
  run: ./deploy/scripts/test-local.sh

- name: Deploy to AWS
  env:
    AWS_REGION: us-west-2
    ENVIRONMENT: prod
  run: ./deploy/scripts/deploy.sh
```

## 🔧 Key Features

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
- **Terraform**: Complete AWS infrastructure
- **Security**: Private subnets, security groups, managed secrets
- **Monitoring**: CloudWatch logs and health checks
- **Cost-optimized**: t3.micro instances for development

Ready for production deployment! 🚀
