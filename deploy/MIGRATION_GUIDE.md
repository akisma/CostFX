# Migration Guide: Switching Between EC2 and ECS Deployments

This guide provides detailed instructions for migrating between deployment types.

## Overview

CostFX supports two deployment architectures that can be switched between with minimal downtime:

- **EC2**: Simplified deployment (default)
- **ECS**: Production-grade deployment

## Pre-Migration Checklist

Before migrating, ensure:

- [ ] Database backup created
- [ ] Current application is stable
- [ ] DNS TTL reduced (if using custom domain)
- [ ] Team notified of maintenance window
- [ ] Rollback plan prepared

## Migration Scenarios

### Scenario 1: Migrating from ECS to EC2 (Cost Reduction)

**Use Case**: Reducing costs for development or low-traffic environments

**Expected Downtime**: 10-15 minutes

**Cost Impact**: Save ~$78/month (~60% reduction)

#### Steps:

1. **Create Database Snapshot** (Recommended)
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier costfx-dev-postgres \
     --db-snapshot-identifier costfx-dev-backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Run GitHub Actions Workflow**
   - Go to: Actions → "CostFX Infrastructure Deploy (Manual)"
   - Click "Run workflow"
   - Select:
     - Environment: `dev` (or your current environment)
     - Deployment type: `ec2`
     - Force deploy: `false`
   - Click "Run workflow"

3. **Monitor Deployment**
   - Watch GitHub Actions output
   - Terraform will:
     - ✅ Create EC2 instance
     - ✅ Set up Docker containers
     - ❌ Destroy ALB
     - ❌ Destroy NAT Gateway
     - ❌ Destroy ECS cluster
     - ✅ Keep RDS database intact

4. **Update DNS** (if using custom domain)
   ```bash
   # Get new EC2 IP
   EC2_IP=$(terraform output -raw ec2_public_ip)
   
   # Update your DNS A record to point to $EC2_IP
   # Example with AWS Route53:
   aws route53 change-resource-record-sets \
     --hosted-zone-id <zone-id> \
     --change-batch file://dns-change.json
   ```

5. **Verify Application**
   ```bash
   # Test frontend
   curl -I http://<ec2-ip>
   
   # Test backend
   curl http://<ec2-ip>:3001/api/v1/
   ```

6. **Restore DNS TTL** (if changed)

#### What Gets Deleted:
- Application Load Balancer (~$16/month)
- NAT Gateway (~$32/month)
- ECS Cluster and Fargate tasks (~$50/month)
- ECS task definitions and services
- ALB target groups
- ALB S3 logs bucket

#### What Stays:
- RDS Database (all data preserved)
- VPC and subnets
- Security groups (adjusted for EC2)
- SSM parameters (secrets)
- CloudWatch log groups
- ECR repositories

### Scenario 2: Migrating from EC2 to ECS (Scaling Up)

**Use Case**: Preparing for production traffic or need for high availability

**Expected Downtime**: 15-20 minutes

**Cost Impact**: Additional ~$78/month

#### Steps:

1. **Create Database Snapshot** (Recommended)
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier costfx-dev-postgres \
     --db-snapshot-identifier costfx-dev-backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Request SSL Certificate** (if not already done)
   ```bash
   # Via AWS Console → Certificate Manager
   # Request certificate for your domain
   # Validate via DNS or email
   ```

3. **Run GitHub Actions Workflow**
   - Go to: Actions → "CostFX Infrastructure Deploy (Manual)"
   - Click "Run workflow"
   - Select:
     - Environment: `dev` (or your current environment)
     - Deployment type: `ecs`
     - Force deploy: `false`
   - Click "Run workflow"

4. **Monitor Deployment**
   - Watch GitHub Actions output
   - Terraform will:
     - ✅ Create Application Load Balancer
     - ✅ Create NAT Gateway
     - ✅ Create ECS cluster
     - ✅ Deploy Fargate tasks
     - ❌ Destroy EC2 instance
     - ✅ Keep RDS database intact

5. **Update DNS** (if using custom domain)
   ```bash
   # Get ALB DNS name
   ALB_DNS=$(terraform output -raw load_balancer_dns)
   
   # Create/update CNAME record to point to ALB
   # Example with AWS Route53:
   aws route53 change-resource-record-sets \
     --hosted-zone-id <zone-id> \
     --change-batch file://dns-change-alb.json
   ```

6. **Verify Application**
   ```bash
   # Test via ALB
   curl -I https://<alb-dns>
   
   # Test backend
   curl https://<alb-dns>/api/v1/
   ```

7. **Configure Auto-Scaling** (optional)
   ```bash
   # Adjust in terraform/variables.tf
   backend_desired_count  = 2  # Increase for more capacity
   frontend_desired_count = 2
   ```

#### What Gets Created:
- Application Load Balancer (~$16/month)
- NAT Gateway (~$32/month)
- ECS Cluster with Fargate tasks (~$50/month)
- ALB target groups
- ECS services and task definitions
- ALB S3 logs bucket
- Enhanced CloudWatch metrics

#### What Stays:
- RDS Database (all data preserved)
- VPC and subnets
- Security groups (adjusted for ECS)
- SSM parameters (secrets)
- ECR repositories
- Route53 hosted zone (if exists)

## DNS Configuration

### For EC2 Deployment

Create an A record:
```
Type: A
Name: www.yourdomain.com
Value: <ec2-elastic-ip>
TTL: 300
```

### For ECS Deployment

Create a CNAME record:
```
Type: CNAME
Name: www.yourdomain.com
Value: <alb-dns-name>
TTL: 300
```

Or use Route53 Alias:
```
Type: A (Alias)
Name: www.yourdomain.com
Alias Target: <alb>
```

## Rollback Procedures

### If Migration Fails

#### Option 1: Quick Rollback (Recommended)
```bash
# Via GitHub Actions
# Run workflow with previous deployment_type
```

#### Option 2: Terraform Rollback
```bash
cd deploy/terraform
terraform workspace select dev

# Revert to previous type
terraform apply -var="deployment_type=<previous-type>"
```

#### Option 3: Database Restore (if needed)
```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier costfx-dev-postgres \
  --db-snapshot-identifier <snapshot-id>

# Wait for restore
aws rds wait db-instance-available \
  --db-instance-identifier costfx-dev-postgres

# Update SSM parameter with new endpoint
NEW_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier costfx-dev-postgres \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

aws ssm put-parameter \
  --name '/costfx/dev/database_url' \
  --value "postgresql://postgres:<password>@${NEW_ENDPOINT}:5432/restaurant_ai" \
  --overwrite
```

## Post-Migration Tasks

### After Switching to EC2:

1. **Set Up HTTPS** (optional, but recommended)
   ```bash
   # SSH to EC2
   ssh ec2-user@<ec2-ip>
   
   # Install Certbot
   sudo dnf install -y certbot python3-certbot-nginx
   
   # Get certificate
   sudo certbot --nginx -d yourdomain.com
   ```

2. **Configure CloudWatch Alarms**
   ```bash
   # EC2-specific alarms already created by Terraform
   # Review in CloudWatch Console
   ```

3. **Set Up Automated Backups**
   ```bash
   # EC2 AMI backups
   aws dlm create-lifecycle-policy \
     --description "Daily EC2 backups" \
     --state ENABLED \
     --execution-role-arn <role-arn> \
     --policy-details file://backup-policy.json
   ```

### After Switching to ECS:

1. **Verify Auto-Scaling**
   ```bash
   # Check ECS service auto-scaling
   aws ecs describe-services \
     --cluster costfx-dev \
     --services costfx-dev-backend
   ```

2. **Configure Scaling Policies**
   ```bash
   # Add to terraform/ecs-complete.tf
   # Or configure via AWS Console → ECS → Service → Auto Scaling
   ```

3. **Set Up Enhanced Monitoring**
   ```bash
   # Container Insights already enabled
   # Review in CloudWatch Console
   ```

## Troubleshooting

### Migration Stuck

**Symptom**: Terraform apply hanging

**Solution**:
1. Check AWS Console for resource creation status
2. Review CloudWatch logs for errors
3. If stuck >30 minutes, consider canceling and retrying

### Application Not Accessible After Migration

**EC2 Issues**:
```bash
# Check instance is running
aws ec2 describe-instances --instance-ids <instance-id>

# Check containers
aws ssm start-session --target <instance-id>
docker ps
docker-compose logs

# Check security group
aws ec2 describe-security-groups --group-ids <sg-id>
```

**ECS Issues**:
```bash
# Check service status
aws ecs describe-services \
  --cluster costfx-dev \
  --services costfx-dev-backend costfx-dev-frontend

# Check tasks
aws ecs list-tasks --cluster costfx-dev

# Check ALB health
aws elbv2 describe-target-health \
  --target-group-arn <tg-arn>
```

### Database Connection Issues

```bash
# Verify security group rules
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=costfx-dev-rds-sg"

# Test connection from EC2/ECS
# For EC2:
aws ssm start-session --target <instance-id>
nc -zv <rds-endpoint> 5432

# Check DATABASE_URL in SSM
aws ssm get-parameter \
  --name '/costfx/dev/database_url' \
  --with-decryption
```

## Cost Comparison

### Before Migration (ECS):
```
Application Load Balancer: $16.20/mo
NAT Gateway:               $32.40/mo
ECS Fargate (4 tasks):     $50.40/mo
RDS db.t3.micro:           $12.96/mo
CloudWatch:                 $5.00/mo
Data Transfer:             $10.00/mo
─────────────────────────────────────
Total:                    ~$126.96/mo
```

### After Migration (EC2):
```
EC2 t3.medium:            $30.37/mo
RDS db.t3.micro:          $12.96/mo
EBS 30GB:                  $3.00/mo
CloudWatch:                $2.00/mo
Data Transfer:             $5.00/mo
─────────────────────────────────────
Total:                    ~$53.33/mo

Savings:                  ~$73.63/mo (58%)
```

## FAQs

**Q: Will I lose my database data?**  
A: No, RDS database is preserved during migration.

**Q: How long is the downtime?**  
A: 10-15 minutes for EC2→ECS, 15-20 minutes for ECS→EC2.

**Q: Can I migrate back if there are issues?**  
A: Yes, just run the workflow with the previous deployment_type.

**Q: What happens to my Docker images?**  
A: They remain in ECR and are used by the new deployment.

**Q: Do I need to update my code?**  
A: No, the same code runs on both deployment types.

**Q: Can I automate this migration?**  
A: Yes, but manual review is recommended for production.

**Q: What about my custom domain?**  
A: You'll need to update DNS records (see DNS Configuration section).

## Support

For issues during migration:
1. Check CloudWatch Logs
2. Review GitHub Actions workflow output
3. Check AWS Console resource states
4. Refer to [DEPLOYMENT.md](../docs/DEPLOYMENT.md)

## Related Documentation

- [Full Deployment Guide](../docs/DEPLOYMENT.md)
- [Quick Start Guide](QUICK_START.md)
- [Terraform README](terraform/README.md)

---

**Remember**: Always create a database snapshot before migrating!
