# CostFX AWS ECS Deployment

This directory contains the infrastructure as code and deployment scripts for deploying CostFX to AWS ECS using Terraform.

## Quick Start

Deploy the complete application with a single command:

```bash
./deploy.sh
```

**Complete deployment time**: ~15-20 minutes

**Live Application**: Once deployed, access your application at:
- **Frontend**: `http://{alb-dns-name}/`
- **Backend API**: `http://{alb-dns-name}/api/v1/`

## Deployment Options

The unified deployment script provides several options:

```bash
# Full deployment (default)
./deploy.sh

# Deploy infrastructure only
./deploy.sh --setup-infra

# Rebuild frontend only (useful after infrastructure changes)
./deploy.sh --frontend-only

# Update SSM parameters only
./deploy.sh --update-ssm-only

# Show help
./deploy.sh --help
```

## Environment Variables

Configure deployment using environment variables:

```bash
export AWS_REGION=us-west-2     # AWS region (default: us-west-2)
export ENVIRONMENT=dev          # Environment name (default: dev)
export APP_NAME=costfx          # Application name (default: costfx)
```

## Directory Structure

```
deploy/
├── deploy.sh              # Main deployment script (single entry point)
├── terraform/             # All Terraform infrastructure code
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── ...
├── docker/                # Docker configurations
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
└── scripts/               # Support utilities
    ├── utils.sh           # Common functions
    ├── setup-ecr.sh       # One-time ECR setup
    └── setup-terraform-state.sh
```

---

---

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CloudFront    │────│  Load Balancer   │────│   ECS Cluster   │
│   (Optional)    │    │    (ALB)         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              │                          ├─ Frontend Service
                              │                          │  (Nginx + React)
                              │                          │
                              └─ /api/* ──────────────── ├─ Backend Service
                                                         │  (Node.js API)
                                                         │
┌─────────────────┐    ┌──────────────────┐            │
│   RDS Postgres  │────│     Private      │────────────┘
│                 │    │    Subnets       │
└─────────────────┘    └──────────────────┘
                              │
┌─────────────────┐            │
│ ElastiCache     │────────────┘
│    Redis        │
└─────────────────┘
```

## Infrastructure Components

### Networking
- **VPC** with public and private subnets across 2 AZs
- **Internet Gateway** for public subnet internet access  
- **NAT Gateways** for private subnet outbound access
- **Security Groups** with least-privilege access

### Compute
- **ECS Fargate Cluster** for container orchestration
- **Frontend Service** - Nginx serving React build artifacts
- **Backend Service** - Node.js API server with SSL database connectivity
- **Application Load Balancer** with path-based routing (`/` → frontend, `/api/*` → backend)

### Storage & Caching
- **RDS PostgreSQL** in private subnets with SSL encryption and automated backups
- **ElastiCache Redis** for session storage and caching

### Security & Configuration
- **SSM Parameter Store** for environment variables and secrets
- **ECR** repositories for container images with vulnerability scanning
- **IAM Roles** with least-privilege policies

## Prerequisites

1. **AWS CLI** installed and configured with appropriate credentials
   ```bash
   aws configure
   # Verify access
   aws sts get-caller-identity
   ```

2. **Docker** installed and running
   ```bash
   docker --version
   docker info
   ```

3. **Terraform** >= 1.0 installed
   ```bash
   terraform version
   ```

4. **Required AWS Permissions**:
   - EC2, ECS, RDS, ElastiCache (full access)
   - IAM, SSM, ECR (full access) 
   - VPC, ALB management
   - S3 (for Terraform state)

5. **Account Setup**:
   - Terraform state bucket must exist: `costfx-tf-state-{account-id}`
   - ECR repositories will be created automatically

---

## Complete Deployment Guide

### Step 1: Initial Setup and Infrastructure

1. **Clone and navigate to the project**:
   ```bash
   git clone <repository-url>
   cd CostFX
   ```

2. **Configure Terraform backend** (if needed):
   ```bash
   # Create S3 bucket for state (replace with your account ID)
   aws s3 mb s3://costfx-tf-state-$(aws sts get-caller-identity --query Account --output text)
   ```

3. **Initialize and deploy infrastructure**:
   ```bash
   cd deploy/infra
   
   # Initialize Terraform
   terraform init
   
   # Plan the deployment (review changes)
   terraform plan \
     -var="backend_image=568530517605.dkr.ecr.us-west-2.amazonaws.com/costfx-dev-backend:latest" \
     -var="frontend_image=568530517605.dkr.ecr.us-west-2.amazonaws.com/costfx-dev-frontend:latest"
   
   # Apply the changes
   terraform apply \
     -var="backend_image=568530517605.dkr.ecr.us-west-2.amazonaws.com/costfx-dev-backend:latest" \
     -var="frontend_image=568530517605.dkr.ecr.us-west-2.amazonaws.com/costfx-dev-frontend:latest"
   ```

### Step 2: Build and Deploy Container Images

1. **Login to ECR**:
   ```bash
   cd ../../  # Back to project root
   aws ecr get-login-password --region us-west-2 | \
     docker login --username AWS --password-stdin \
     $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com
   ```

2. **Build backend image**:
   ```bash
   docker build --platform linux/amd64 \
     -f deploy/docker/Dockerfile.backend \
     -t $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com/costfx-dev-backend:latest .
   ```

3. **Build frontend image**:
   ```bash
   docker build --platform linux/amd64 \
     -f deploy/docker/Dockerfile.frontend \
     -t $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com/costfx-dev-frontend:latest .
   ```

4. **Push images to ECR**:
   ```bash
   docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com/costfx-dev-backend:latest
   docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com/costfx-dev-frontend:latest
   ```

### Step 3: Deploy ECS Services

1. **Update ECS services to use new images**:
   ```bash
   # Update backend service
   aws ecs update-service \
     --cluster costfx-dev-cluster \
     --service costfx-dev-backend \
     --force-new-deployment \
     --region us-west-2
   
   # Update frontend service  
   aws ecs update-service \
     --cluster costfx-dev-cluster \
     --service costfx-dev-frontend \
     --force-new-deployment \
     --region us-west-2
   ```

2. **Monitor deployment progress**:
   ```bash
   # Check service status
   aws ecs describe-services \
     --cluster costfx-dev-cluster \
     --services costfx-dev-backend costfx-dev-frontend \
     --region us-west-2 \
     --query 'services[].{Name:serviceName,Running:runningCount,Desired:desiredCount}'
   
   # Check target group health
   ALB_TG_ARN=$(aws elbv2 describe-target-groups \
     --names costfx-dev-b-tg \
     --region us-west-2 \
     --query 'TargetGroups[0].TargetGroupArn' --output text)
   
   aws elbv2 describe-target-health \
     --target-group-arn $ALB_TG_ARN \
     --region us-west-2
   ```

### Step 4: Verify Deployment

1. **Get application URL**:
   ```bash
   cd deploy/infra
   ALB_DNS=$(terraform output -raw alb_dns)
   echo "Frontend: http://$ALB_DNS/"
   echo "Backend API: http://$ALB_DNS/api/v1/"
   ```

2. **Test endpoints**:
   ```bash
   # Test frontend
   curl -s "http://$ALB_DNS/" | grep -o '<title>.*</title>'
   
   # Test backend API
   curl -s "http://$ALB_DNS/api/v1/" | head -20
   ```

### Step 5: Post-Deployment Configuration

1. **Update OpenAI API Key** (required for AI agents):
   ```bash
   aws ssm put-parameter \
     --name '/costfx/dev/openai_api_key' \
     --value 'your_actual_openai_api_key_here' \
     --type SecureString \
     --overwrite \
     --region us-west-2
   ```

2. **Run database migrations** (if needed):
   ```bash
   # Get running backend task ID
   TASK_ARN=$(aws ecs list-tasks \
     --cluster costfx-dev-cluster \
     --service-name costfx-dev-backend \
     --region us-west-2 \
     --query 'taskArns[0]' --output text)
   
   # Execute migration command
   aws ecs execute-command \
     --cluster costfx-dev-cluster \
     --task $TASK_ARN \
     --container backend \
     --command "npm run migrate" \
     --interactive \
     --region us-west-2
   ```

---

## Alternative: Automated Deployment Script

For a simpler deployment, use the provided script:

```bash
# Set environment variables (optional)
export AWS_REGION=us-west-2
export ENVIRONMENT=dev
export APP_NAME=costfx

# Run the automated deployment
./deploy/scripts/deploy.sh
```

**Deployment Commands Available:**

```bash
# Full deployment (default) - includes frontend API URL fix
./deploy/scripts/deploy.sh deploy

# Rebuild only the frontend with correct API URL
./deploy/scripts/deploy.sh rebuild-frontend
# OR use the dedicated script:
./deploy/scripts/rebuild-frontend.sh

# Update only SSM parameters
./deploy/scripts/deploy.sh update-ssm-only
```

**What the deployment script does:**
1. Deploy AWS infrastructure with Terraform
2. Build and push Docker images to ECR
3. **Automatically detect the load balancer URL and rebuild frontend with correct API URL**
4. Deploy ECS services with new images
5. Wait for deployment completion and show application URL

After deployment, update the OpenAI API key:

```bash
aws ssm put-parameter \
  --name '/costfx/dev/openai_api_key' \
  --value 'your_actual_openai_api_key' \
  --type SecureString \
  --overwrite
```

### 3. Access Your Application

The deployment script will output the application URL:
```
Application is available at: http://your-alb-dns-name.amazonaws.com
Backend API is available at: http://your-alb-dns-name.amazonaws.com/api/v1/
```

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Deploy Infrastructure

```bash
cd deploy/terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var="environment=dev"

# Apply changes
terraform apply -var="environment=dev"
```

### 2. Build and Push Images

```bash
# Get ECR login token
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-west-2.amazonaws.com

# Build and push backend
docker build -f deploy/docker/Dockerfile.backend -t $(terraform output -raw backend_ecr_repository_url):latest .
docker push $(terraform output -raw backend_ecr_repository_url):latest

# Build and push frontend
docker build -f deploy/docker/Dockerfile.frontend -t $(terraform output -raw frontend_ecr_repository_url):latest .
docker push $(terraform output -raw frontend_ecr_repository_url):latest
```

### 3. Update ECS Services

```bash
# Update backend service
aws ecs update-service \
  --cluster costfx-dev-cluster \
  --service costfx-dev-backend \
  --force-new-deployment

# Update frontend service
aws ecs update-service \
  --cluster costfx-dev-cluster \
  --service costfx-dev-frontend \
  --force-new-deployment
```

## Configuration

### Environment Variables

The following environment variables can be set to customize the deployment:

- `AWS_REGION`: AWS region (default: us-west-2)
- `ENVIRONMENT`: Environment name (default: dev)
- `APP_NAME`: Application name (default: costfx)

### Terraform Variables

Key variables in `deploy/terraform/variables.tf`:

- `environment`: Environment name
- `aws_region`: AWS region
- `vpc_cidr`: VPC CIDR block
- `backend_cpu/memory`: Backend task resources
- `frontend_cpu/memory`: Frontend task resources
- `db_instance_class`: RDS instance type

### Secrets Management

Secrets are stored in AWS SSM Parameter Store:

- `/costfx/dev/database_url`: PostgreSQL connection string
- `/costfx/dev/redis_url`: Redis connection string
- `/costfx/dev/jwt_secret`: JWT signing secret
- `/costfx/dev/openai_api_key`: OpenAI API key

## Monitoring & Logs

### CloudWatch Logs

Application logs are available in CloudWatch:
- Log Group: `/ecs/costfx-dev`
- Streams: `backend/[task-id]` and `frontend/[task-id]`

### Health Checks

- **Frontend**: `GET /health`
- **Backend**: `GET /api/v1/`
- **Load Balancer**: Automatic health checks configured

### Scaling

Auto-scaling can be configured by modifying:
- `backend_desired_count`: Number of backend tasks
- `frontend_desired_count`: Number of frontend tasks

## Cost Optimization

### Development Environment
- Uses `t3.micro` instances where possible
- Minimal RDS and ElastiCache instances
- No NAT Gateways in cost-optimized setup

### Production Considerations
- Consider using Spot instances for ECS tasks
- Enable RDS Multi-AZ for high availability
- Implement CloudFront for global content delivery
- Set up auto-scaling policies

## Troubleshooting

### Common Issues

1. **ECS Tasks Failing to Start**
   ```bash
   # Check task logs
   aws logs tail /ecs/costfx-dev --follow
   ```

2. **Database Connection Issues**
   ```bash
   # Verify database connectivity from ECS task
   aws ecs execute-command --cluster costfx-dev-cluster --task [task-id] --interactive --command "/bin/sh"
   ```

3. **Frontend API URL Issues (Network Error)**
   
   **Problem**: Analysis/forecast page shows "Network Error"
   
   **Cause**: Frontend was built before load balancer was ready, so it's using localhost:3001
   
   **Solution**:
   ```bash
   # Quick fix - rebuild frontend with correct API URL
   ./deploy/scripts/rebuild-frontend.sh
   
   # OR using the main deployment script
   ./deploy/scripts/deploy.sh rebuild-frontend
   ```
   
   **Prevention**: This is now automatically handled in the deployment script

4. **Image Pull Errors**
   ```bash
   # Verify ECR permissions and image existence
   aws ecr describe-images --repository-name costfx-dev-backend
   ```

### Cleanup

To destroy all resources:

```bash
cd deploy/terraform
terraform destroy -var="environment=dev"
```

**⚠️ Warning**: This will permanently delete all data including the database.

## Security Considerations

### Production Hardening

1. **Enable HTTPS**:
   - Add SSL certificate to load balancer
   - Uncomment HTTPS listener in `load-balancer.tf`

2. **Restrict Access**:
   - Update `allowed_cidr_blocks` in variables
   - Configure WAF rules if needed

3. **Database Security**:
   - Enable encryption at rest
   - Configure backup encryption
   - Set up VPC Flow Logs

4. **Secrets Rotation**:
   - Set up automatic rotation for database passwords
   - Rotate JWT secrets regularly

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Backend Tasks Failing with Database Connection Errors

**Symptoms**: ECS tasks crash immediately, logs show "no pg_hba.conf entry" or SSL connection errors.

**Solution**:
```bash
# Check if SSL environment variables are set correctly
aws ecs describe-task-definition \
  --task-definition costfx-dev-backend \
  --query 'taskDefinition.containerDefinitions[0].environment'

# Should include:
# - PGSSLMODE=no-verify
# - PORT=3001
# - NODE_ENV=dev

# If missing, update the ECS module and redeploy
cd deploy/infra
terraform apply -target='module.ecs[0].aws_ecs_task_definition.backend'
```

#### 2. Load Balancer Returns 502 Bad Gateway

**Symptoms**: Frontend/backend URLs return 502 errors.

**Troubleshooting**:
```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --names costfx-dev-b-tg \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

# Check ECS service status
aws ecs describe-services \
  --cluster costfx-dev-cluster \
  --services costfx-dev-backend costfx-dev-frontend \
  --query 'services[].{Name:serviceName,Running:runningCount,Desired:desiredCount}'

# Check container logs
aws logs describe-log-streams \
  --log-group-name /ecs/costfx-dev \
  --order-by LastEventTime --descending --limit 2
```

#### 3. Docker Build Failures

**Symptoms**: Platform mismatch errors, "CannotPullContainerError".

**Solution**:
```bash
# Always build for linux/amd64 platform
docker build --platform linux/amd64 \
  -f deploy/docker/Dockerfile.backend \
  -t your-ecr-url:latest .

# Verify image architecture
docker inspect your-ecr-url:latest | grep -i arch
```

#### 4. Terraform State Issues

**Symptoms**: Resources exist in AWS but Terraform wants to create them.

**Solution**:
```bash
# Check if you're in the correct directory
cd deploy/infra  # NOT deploy/terraform

# Verify state bucket configuration
terraform init -reconfigure

# Import existing resources if needed
terraform import module.ecs[0].aws_ecs_cluster.this costfx-dev-cluster
```

#### 5. Health Check Failures

**Symptoms**: ECS tasks running but load balancer targets unhealthy.

**Check**:
```bash
# Verify health check endpoint responds
TASK_IP=$(aws ecs describe-tasks \
  --cluster costfx-dev-cluster \
  --tasks $(aws ecs list-tasks --cluster costfx-dev-cluster --service-name costfx-dev-backend --query 'taskArns[0]' --output text) \
  --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' --output text)

curl http://$TASK_IP:3001/api/v1/
```

### Log Analysis

```bash
# View recent backend logs
aws logs tail /ecs/costfx-dev --since 10m --filter-pattern "backend"

# View specific error patterns
aws logs filter-log-events \
  --log-group-name /ecs/costfx-dev \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Performance Monitoring

```bash
# Check ECS service metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=costfx-dev-backend Name=ClusterName,Value=costfx-dev-cluster \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## Support

For issues and questions:
1. **Check CloudWatch logs** for application errors:
   ```bash
   aws logs tail /ecs/costfx-dev --follow
   ```
2. **Verify AWS resource status** in the console
3. **Review Terraform state** for infrastructure issues:
   ```bash
   terraform show
   ```
4. **Check this troubleshooting guide** for common solutions

## Next Steps

1. **Set up CI/CD pipeline** with GitHub Actions
2. **Configure monitoring and alerting** with CloudWatch
3. **Implement automated backups** for RDS and Redis
4. **Set up staging environment** with separate Terraform workspace
5. **Configure custom domain** with Route 53 and ACM certificate
6. **Enable HTTPS** by updating ALB listener configuration
