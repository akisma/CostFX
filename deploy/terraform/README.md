# CostFX Terraform Configuration

This directory contains the Terraform infrastructure as code for CostFX.

## Deployment Types

CostFX supports two deployment architectures:

- **`ec2`** (default): Simplified deployment with single EC2 instance
- **`ecs`**: Production-grade deployment with ECS Fargate

See [DEPLOYMENT.md](../../docs/DEPLOYMENT.md) for detailed comparison.

## Quick Start

### Prerequisites

1. AWS credentials configured
2. Terraform >= 1.0 installed
3. S3 bucket for Terraform state (already created)

### Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Select workspace (environment)
terraform workspace select dev  # or: terraform workspace new dev

# Plan deployment with EC2 (default)
terraform plan -var="deployment_type=ec2"

# Apply changes
terraform apply -var="deployment_type=ec2"

# For ECS deployment
terraform apply -var="deployment_type=ecs"
```

### Common Commands

```bash
# Check current workspace
terraform workspace show

# View outputs
terraform output

# Get specific output
terraform output ec2_public_ip
terraform output application_url

# Destroy infrastructure (WARNING: will delete resources)
terraform destroy -var="deployment_type=ec2"
```

## File Structure

```
terraform/
├── main.tf                    # Provider and backend configuration
├── variables.tf               # Variable definitions
├── outputs.tf                 # Output definitions
├── vpc.tf                     # VPC, subnets, IGW
├── security-groups.tf         # Security groups for all resources
├── database.tf                # RDS PostgreSQL
├── ec2.tf                     # EC2 instance deployment (deployment_type=ec2)
├── ecs-complete.tf            # ECS cluster and services (deployment_type=ecs)
├── ecs-migration-task.tf      # ECS migration task (deployment_type=ecs)
├── load-balancer.tf           # Application Load Balancer (deployment_type=ecs)
├── acm.tf                     # SSL/TLS certificates
├── ssm-parameters.tf          # SSM Parameter Store for secrets
├── monitoring-basic.tf        # CloudWatch alarms and dashboards
├── cost-monitoring.tf         # Cost tracking and budgets
├── waf.tf                     # Web Application Firewall (optional)
├── s3-security.tf             # S3 bucket policies
├── user_data_ec2.sh           # EC2 initialization script
└── README.md                  # This file
```

## Variables

### Required Variables

These must be set via `-var` flag, environment variables, or `terraform.tfvars`:

```hcl
# Docker images (set by GitHub Actions during deployment)
backend_image  = "123456789.dkr.ecr.us-west-2.amazonaws.com/costfx-dev-backend:abc123"
frontend_image = "123456789.dkr.ecr.us-west-2.amazonaws.com/costfx-dev-frontend:abc123"
```

### Key Variables

```hcl
# Deployment configuration
deployment_type = "ec2"        # "ec2" or "ecs"
environment     = "dev"        # "dev", "staging", or "prod"
aws_region      = "us-west-2"  # AWS region

# EC2 configuration (for deployment_type=ec2)
ec2_instance_type = "t3.small"   # Default for single user; use t3.medium for more power
ec2_key_name      = ""           # SSH key pair name (optional)

# ECS configuration (for deployment_type=ecs)
backend_cpu            = 512   # CPU units
backend_memory         = 1024  # Memory in MB
backend_desired_count  = 2     # Number of tasks
frontend_cpu           = 256
frontend_memory        = 512
frontend_desired_count = 2

# Database configuration
db_instance_class     = "db.t3.micro"
db_allocated_storage  = 20     # GB

# Networking
vpc_cidr              = "10.0.0.0/16"
availability_zones    = ["us-west-2a", "us-west-2b"]
```

### Creating terraform.tfvars

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

## Outputs

After `terraform apply`, you can view:

```bash
# All outputs
terraform output

# Deployment-specific outputs
terraform output deployment_type
terraform output application_url
terraform output api_url

# EC2-specific outputs (when deployment_type=ec2)
terraform output ec2_instance_id
terraform output ec2_public_ip

# ECS-specific outputs (when deployment_type=ecs)
terraform output load_balancer_dns
terraform output load_balancer_url
```

## Workspaces

Terraform workspaces are used to manage multiple environments:

```bash
# List workspaces
terraform workspace list

# Create new workspace
terraform workspace new staging

# Switch workspace
terraform workspace select prod

# Show current workspace
terraform workspace show
```

Each workspace has its own state file in S3.

## State Management

Terraform state is stored in S3:
- Bucket: `costfx-tf-state-568530517605`
- Key: `env/{environment}/infra.tfstate`
- Region: `us-west-2`

**State is shared between team members** - coordinate deploys!

```bash
# View state
terraform state list

# Show specific resource
terraform state show aws_instance.app[0]

# Pull state (advanced)
terraform state pull
```

## Deployment Examples

### Deploy EC2 (Development)

```bash
terraform workspace select dev
terraform apply \
  -var="deployment_type=ec2" \
  -var="environment=dev" \
  -var="ec2_instance_type=t3.small"
```

### Deploy ECS (Production)

```bash
terraform workspace select prod
terraform apply \
  -var="deployment_type=ecs" \
  -var="environment=prod" \
  -var="backend_desired_count=4" \
  -var="frontend_desired_count=4"
```

### Switch from EC2 to ECS

```bash
# Current state: EC2 deployment
terraform workspace select dev

# Change deployment type
terraform apply -var="deployment_type=ecs"

# Terraform will:
# 1. Create ALB, NAT Gateway, ECS resources
# 2. Destroy EC2 instance
# 3. Keep database intact
```

## Troubleshooting

### Terraform Init Issues

```bash
# Backend configuration error
terraform init -backend-config="bucket=costfx-tf-state-568530517605"

# Upgrade providers
terraform init -upgrade
```

### State Lock Issues

If someone else is running Terraform:
```bash
# Wait for them to finish
# Or force unlock (USE CAREFULLY)
terraform force-unlock <lock-id>
```

### Resource Conflicts

```bash
# Import existing resource
terraform import aws_instance.app[0] i-1234567890abcdef0

# Remove from state (doesn't delete resource)
terraform state rm aws_instance.app[0]
```

### Plan Shows Unexpected Changes

```bash
# Refresh state from AWS
terraform refresh

# Show detailed plan
terraform plan -out=tfplan
terraform show tfplan
```

## Best Practices

1. **Always run `terraform plan` first**
   - Review changes before applying
   - Use `-out` flag to save plan

2. **Use workspaces for environments**
   - dev, staging, prod
   - Never mix environment state

3. **Version control**
   - Commit `.tf` files to git
   - Never commit `.tfvars` with secrets
   - Use `.terraform` in `.gitignore`

4. **Secrets management**
   - Use SSM Parameter Store for secrets
   - Never hardcode credentials in `.tf` files
   - Reference secrets via data sources

5. **Testing changes**
   - Test in dev first
   - Use `terraform plan` liberally
   - Review diffs carefully

6. **Cost awareness**
   - Destroy dev environments when not needed
   - Use `terraform destroy` for cleanup
   - Review costs in AWS Cost Explorer

## GitHub Actions Integration

This Terraform configuration is deployed via GitHub Actions:

- **Manual**: `.github/workflows/infrastructure-deploy.yml`
  - Full infrastructure deployment
  - Choose deployment type via UI
  - Builds Docker images
  - Updates secrets

- **Automatic**: `.github/workflows/app-deploy.yml`
  - Code-only deployments
  - For ECS only
  - No Terraform changes

## Security Notes

- Secrets stored in SSM Parameter Store
- IAM roles follow least privilege
- Security groups restrict access
- VPC Flow Logs enabled
- Encryption at rest (RDS, EBS, S3)
- IMDSv2 required for EC2

## Cost Estimates

### EC2 Deployment (dev)
- EC2 t3.small: ~$15/mo (default for single user)
- RDS db.t3.micro: ~$13/mo
- EBS storage: ~$3/mo
- **Total: ~$31/mo**
- *Note: t3.medium (~$30/mo) available if more power needed*

### ECS Deployment (dev)
- ALB: ~$16/mo
- NAT Gateway: ~$32/mo
- Fargate tasks: ~$50/mo
- RDS db.t3.micro: ~$13/mo
- **Total: ~$111/mo**

*Add ~50% for production with higher capacity*

## Support

For help:
1. Check [DEPLOYMENT.md](../../docs/DEPLOYMENT.md)
2. Review CloudWatch Logs
3. Check GitHub Actions runs
4. Review Terraform plan output

## Related Documentation

- [Main Deployment Guide](../../docs/DEPLOYMENT.md)
- [GitHub Actions Workflows](../../.github/workflows/)
- [Deploy Scripts](../scripts/)
