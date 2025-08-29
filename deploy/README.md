# CostFX AWS ECS Deployment

This directory contains the infrastructure as code and deployment scripts for deploying CostFX to AWS ECS using Terraform.

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
- **Backend Service** - Node.js API server
- **Application Load Balancer** with path-based routing

### Storage & Caching
- **RDS PostgreSQL** in private subnets with automated backups
- **ElastiCache Redis** for session storage and caching

### Security & Configuration
- **SSM Parameter Store** for environment variables and secrets
- **ECR** repositories for container images
- **IAM Roles** with least-privilege policies

## Prerequisites

1. **AWS CLI** installed and configured
   ```bash
   aws configure
   ```

2. **Docker** installed and running

3. **Terraform** >= 1.0 installed

4. **Required AWS Permissions**:
   - EC2, ECS, RDS, ElastiCache
   - IAM, SSM, ECR
   - VPC, ALB management

## Quick Start

### 1. Deploy Infrastructure

```bash
# Set environment variables (optional)
export AWS_REGION=us-west-2
export ENVIRONMENT=dev
export APP_NAME=costfx

# Run the deployment script
./deploy/scripts/deploy.sh
```

### 2. Update Configuration

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

3. **Image Pull Errors**
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

## Support

For issues and questions:
1. Check CloudWatch logs for application errors
2. Verify AWS resource status in the console
3. Review Terraform state for infrastructure issues

## Next Steps

1. Set up CI/CD pipeline with GitHub Actions
2. Configure monitoring and alerting
3. Implement automated backups
4. Set up staging environment
5. Configure custom domain with Route 53
