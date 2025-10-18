# CostFX Deployment Guide

This guide explains the two deployment options for CostFX: **EC2** (simplified) and **ECS** (production-grade).

## Deployment Types

### EC2 Deployment (Simplified) - **CURRENT DEFAULT**

The EC2 deployment is a simplified, cost-effective option suitable for development and low-traffic production environments.

**Architecture:**
- Single EC2 instance (t3.medium) in a public subnet
- Docker and Docker Compose running containers directly
- Direct HTTP access via Elastic IP (no load balancer)
- No NAT Gateway required
- Database in private subnet (accessed via security group)

**Costs (approximate monthly):**
- EC2 Instance (t3.medium): ~$30
- RDS (db.t3.micro): ~$13
- EBS Storage: ~$3
- Data Transfer: ~$5
- **Total: ~$51/month**

**Pros:**
- Much lower cost (~$78/month savings vs ECS)
- Simpler architecture
- Faster deployment
- Easy SSH access for debugging

**Cons:**
- No automatic scaling
- No load balancing
- Single point of failure
- HTTP only (HTTPS requires manual setup)
- Manual container updates

**Best for:**
- Development environments
- Low-traffic applications
- Cost-conscious deployments
- POC/MVP stages

### ECS Deployment (Production-Grade)

The ECS deployment uses AWS Fargate for container orchestration with enterprise features.

**Architecture:**
- Application Load Balancer with HTTPS
- ECS Fargate cluster with multiple tasks
- Private subnets with NAT Gateway
- Auto-scaling based on load
- CloudWatch Container Insights

**Costs (approximate monthly):**
- Application Load Balancer: ~$16
- NAT Gateway: ~$32
- ECS Fargate tasks (2x backend, 2x frontend): ~$50
- RDS (db.t3.micro): ~$13
- CloudWatch: ~$5
- Data Transfer: ~$10
- **Total: ~$126/month**

**Pros:**
- Production-grade reliability
- Automatic scaling
- Zero-downtime deployments
- HTTPS with ACM certificates
- Multi-AZ high availability
- Better monitoring and logging

**Cons:**
- Higher cost
- More complex architecture
- Longer deployment times
- Requires more AWS expertise

**Best for:**
- Production environments
- High-traffic applications
- Applications requiring HA
- When auto-scaling is needed

## Switching Between Deployment Types

### Current Default
The repository is currently configured for **EC2 deployment** (`deployment_type = "ec2"`).

### How to Switch

#### 1. Using GitHub Actions (Manual Deploy)

When running the "CostFX Infrastructure Deploy" workflow:

1. Go to Actions → CostFX Infrastructure Deploy
2. Click "Run workflow"
3. Select:
   - **Environment**: `dev` or `prod`
   - **Deployment type**: `ec2` or `ecs`
4. Click "Run workflow"

#### 2. Using Terraform Directly

Update the `deployment_type` variable in your Terraform variables file:

```hcl
# For EC2 deployment
deployment_type = "ec2"

# For ECS deployment
deployment_type = "ecs"
```

Or pass it as a command-line argument:

```bash
terraform apply -var="deployment_type=ec2"
```

#### 3. Permanent Configuration

To change the default, edit `deploy/terraform/variables.tf`:

```hcl
variable "deployment_type" {
  description = "Deployment type (ecs or ec2)"
  type        = string
  default     = "ec2"  # Change to "ecs" for ECS deployment
  validation {
    condition     = contains(["ecs", "ec2"], var.deployment_type)
    error_message = "Deployment type must be either 'ecs' or 'ec2'."
  }
}
```

## Deployment Workflows

### Infrastructure Deployment (Manual)

For complete infrastructure changes including Terraform updates:

```bash
# Trigger via GitHub Actions UI
Actions → CostFX Infrastructure Deploy (Manual) → Run workflow
```

This workflow:
1. Runs tests
2. Builds Docker images
3. Pushes to ECR
4. Applies Terraform changes
5. Updates SSM secrets
6. Performs health checks

### Application Deployment (Automatic)

For code-only changes that don't require infrastructure updates:

**For ECS:**
- Automatic on push to `main` or `develop`
- Updates ECS task definitions
- Performs rolling updates
- Runs database migrations

**For EC2:**
- Use the infrastructure deploy workflow
- Or manually run `deploy/scripts/ec2-deploy.sh`

## Accessing the Application

### EC2 Deployment

After deployment, get the public IP:

```bash
# From Terraform outputs
terraform output ec2_public_ip

# Or from AWS Console
aws ec2 describe-instances --filters "Name=tag:Name,Values=costfx-dev-ec2" --query "Reservations[0].Instances[0].PublicIpAddress" --output text
```

Access:
- **Frontend**: `http://<public-ip>`
- **Backend API**: `http://<public-ip>:3001/api/v1`

### ECS Deployment

After deployment, get the ALB DNS:

```bash
# From Terraform outputs
terraform output load_balancer_url
```

Access:
- **Frontend**: `https://<alb-dns>`
- **Backend API**: `https://<alb-dns>/api/v1`

## Monitoring and Debugging

### EC2 Deployment

**SSH Access** (if key pair configured):
```bash
ssh -i <key-pair>.pem ec2-user@<public-ip>
```

**SSM Session Manager** (recommended):
```bash
aws ssm start-session --target <instance-id>
```

**View application logs:**
```bash
# On the EC2 instance
cd /opt/costfx
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Check service status:**
```bash
docker-compose ps
systemctl status costfx
```

**CloudWatch Logs:**
- Log Group: `/ec2/costfx-dev`
- Streams: `user-data`, `docker-app`

### ECS Deployment

**CloudWatch Logs:**
- Backend: `/ecs/costfx-dev-backend`
- Frontend: `/ecs/costfx-dev-frontend`
- Migrations: `/ecs/costfx-dev-migration`

**ECS Console:**
```bash
# View running tasks
aws ecs list-tasks --cluster costfx-dev

# View service details
aws ecs describe-services --cluster costfx-dev --services costfx-dev-backend
```

## Migration Between Deployment Types

### From ECS to EC2

1. **Backup your data** (database snapshot recommended)
2. Run infrastructure deploy with `deployment_type = "ec2"`
3. Terraform will:
   - Create EC2 instance
   - Destroy ECS resources
   - Destroy ALB and NAT Gateway
   - Keep RDS database intact
4. Update DNS to point to EC2 Elastic IP

**Downtime**: ~10-15 minutes while resources are created/destroyed

### From EC2 to ECS

1. **Backup your data** (database snapshot recommended)
2. Run infrastructure deploy with `deployment_type = "ecs"`
3. Terraform will:
   - Create ALB, NAT Gateway
   - Create ECS cluster and services
   - Destroy EC2 instance
   - Keep RDS database intact
4. Update DNS to point to ALB

**Downtime**: ~15-20 minutes for ALB provisioning and ECS task startup

## Cost Optimization Tips

### For EC2 Deployment
- Use Reserved Instances for 1-3 year commitment (30-60% savings)
- Use Spot Instances for dev/test (up to 90% savings, but can be interrupted)
- Right-size instance based on actual usage
- Enable CloudWatch detailed monitoring only if needed

### For ECS Deployment
- Use Fargate Spot for non-critical tasks (70% savings)
- Enable ECS capacity providers for auto-scaling
- Use Savings Plans for Fargate (up to 50% savings)
- Adjust task CPU/memory to minimum required
- Use single NAT Gateway for dev (already configured)

## Troubleshooting

### EC2 Deployment Issues

**Services won't start:**
```bash
# Check user data logs
sudo cat /var/log/user-data.log

# Check Docker logs
docker-compose logs --tail=100

# Verify ECR login
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-west-2.amazonaws.com
```

**Can't reach application:**
- Check security group allows HTTP (port 80) and backend (port 3001)
- Verify Elastic IP is attached
- Check if containers are running: `docker ps`

**Database connection issues:**
- Verify RDS security group allows traffic from EC2 security group
- Check DATABASE_URL in `/opt/costfx/.env`
- Test connection: `docker-compose exec backend nc -zv <rds-endpoint> 5432`

### ECS Deployment Issues

**Tasks won't start:**
```bash
# Check task events
aws ecs describe-services --cluster costfx-dev --services costfx-dev-backend

# Check CloudWatch logs
aws logs tail /ecs/costfx-dev-backend --follow
```

**Health checks failing:**
- Verify target group health check settings
- Check application is listening on correct port
- Review application logs for errors

**Migration task fails:**
- Check CloudWatch logs: `/ecs/costfx-dev-migration`
- Verify DATABASE_URL in SSM Parameter Store
- Ensure backend security group allows database access

## Security Considerations

### EC2 Deployment
- ✅ EC2 instance uses IMDSv2 (metadata service)
- ✅ Root volume encrypted
- ✅ SSM Session Manager enabled
- ⚠️ HTTP only by default (consider nginx with Let's Encrypt for HTTPS)
- ⚠️ SSH port 22 open (consider restricting to your IP)

### ECS Deployment
- ✅ HTTPS with ACM certificate
- ✅ Tasks in private subnets
- ✅ WAF available (optional)
- ✅ Secrets in SSM Parameter Store
- ✅ VPC Flow Logs enabled

## Next Steps

1. **Review current deployment type**: Check `deployment_type` in variables.tf
2. **Evaluate costs**: Review monthly AWS bill and compare with estimates above
3. **Consider your use case**: Match deployment type to your requirements
4. **Test deployment**: Try deploying with your chosen type
5. **Monitor performance**: Use CloudWatch to track resources
6. **Plan for growth**: Be ready to switch to ECS as traffic grows

## Support

For issues or questions:
- Check CloudWatch Logs
- Review GitHub Actions workflow runs
- Contact the DevOps team

## Related Documentation

- [Infrastructure Setup](../deploy/README.md)
- [GitHub Actions Workflows](../.github/workflows/README.md)
- [Terraform Configuration](../deploy/terraform/README.md)
