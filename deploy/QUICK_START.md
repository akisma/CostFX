# CostFX Deployment Quick Start

## Current Configuration
🎯 **Default Deployment Type**: EC2 (simplified, cost-effective)

## Quick Deploy via GitHub Actions

### 1. Navigate to Actions
```
GitHub → Actions → "CostFX Infrastructure Deploy (Manual)"
```

### 2. Click "Run workflow"

### 3. Select Options:
- **Environment**: `dev` (or `prod`)
- **Deployment type**: `ec2` ← **SELECTED BY DEFAULT**
- **Force deploy**: `false` (optional)

### 4. Click "Run workflow" button

⏱️ **Estimated time**: 15-20 minutes for EC2, 20-30 minutes for ECS

## Deployment Types Comparison

| Feature | EC2 (Default) | ECS |
|---------|---------------|-----|
| **Cost** | ~$36/month (t3.small) | ~$126/month |
| **Setup** | Simple | Complex |
| **Scaling** | Manual | Automatic |
| **Load Balancer** | ❌ No | ✅ Yes (HTTPS) |
| **High Availability** | ❌ No | ✅ Multi-AZ |
| **Best For** | Dev, MVP, Low Traffic, Single User | Production, High Traffic |

## After Deployment

### Get Application URLs

**EC2 Deployment:**
```bash
# From GitHub Actions output, or:
terraform output ec2_public_ip
# Access: http://<ip-address>
```

**ECS Deployment:**
```bash
# From GitHub Actions output, or:
terraform output load_balancer_url
# Access: https://<alb-dns>
```

### Check Status

**EC2:**
```bash
# SSH or SSM Session Manager
aws ssm start-session --target <instance-id>

# Then on the instance:
cd /opt/costfx
docker-compose ps
docker-compose logs -f
```

**ECS:**
```bash
# Check service status
aws ecs describe-services --cluster costfx-dev --services costfx-dev-backend costfx-dev-frontend

# View logs
aws logs tail /ecs/costfx-dev-backend --follow
```

## Switching Deployment Types

### From EC2 to ECS:
1. Run workflow with `deployment_type = ecs`
2. Wait for deployment
3. Update DNS to ALB URL
4. ⏱️ **Downtime**: 15-20 minutes

### From ECS to EC2:
1. Run workflow with `deployment_type = ec2`
2. Wait for deployment
3. Update DNS to EC2 IP
4. ⏱️ **Downtime**: 10-15 minutes

## Common Tasks

### Update Application Code (EC2)
Re-run infrastructure deploy workflow - it will update containers

### Update Application Code (ECS)
Automatic on push to `main` branch

### View Logs
**EC2**: `/var/log/user-data.log` and `docker-compose logs`
**ECS**: CloudWatch Logs → `/ecs/costfx-dev-backend` or `/ecs/costfx-dev-frontend`

### SSH to EC2 (if key configured)
```bash
ssh -i <key>.pem ec2-user@<public-ip>
```

### SSM Session (Recommended)
```bash
aws ssm start-session --target <instance-id>
```

## Troubleshooting

### Deployment Failed
1. Check GitHub Actions logs
2. Review CloudWatch logs
3. Check AWS Console for resource creation errors

### Can't Access Application
**EC2:**
- Check security group allows port 80 and 3001
- Verify Elastic IP is attached
- Check if containers are running: `docker ps`

**ECS:**
- Check ALB target group health
- Review ECS service events
- Check CloudWatch logs

### Database Connection Issues
- Verify RDS security group rules
- Check DATABASE_URL in SSM Parameter Store
- Test connection from EC2/ECS tasks

## Emergency: Rollback

### Revert to Previous State
```bash
# Using Terraform
terraform workspace select dev
terraform apply -var="deployment_type=<previous-type>"

# Or via GitHub Actions
# Run workflow with previous deployment_type
```

### Restore Database
```bash
# If you have a snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier costfx-dev-postgres-restored \
  --db-snapshot-identifier <snapshot-id>
```

## Cost Monitoring

### View Current Costs
```
AWS Console → Cost Explorer → Daily Costs
```

### Budget Alerts
Budget is configured at $150/month with alerts at 80% and 100%

### Reduce Costs
1. **Switch to EC2** from ECS (saves ~$90/month)
2. **Stop EC2 when not in use** (dev only)
3. **Use t3.micro for very light usage** (saves additional ~$7/month vs t3.small)
4. **Delete dev environment** when not needed

## Support & Documentation

📚 **Detailed Docs**: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
🔧 **Terraform README**: [terraform/README.md](terraform/README.md)
🤖 **GitHub Actions**: [.github/workflows/](../.github/workflows/)

## Quick Commands Cheat Sheet

```bash
# Terraform
terraform workspace list
terraform workspace select dev
terraform output
terraform apply -var="deployment_type=ec2"

# AWS CLI
aws ec2 describe-instances --filters "Name=tag:Name,Values=costfx-dev-ec2"
aws ecs list-tasks --cluster costfx-dev
aws ssm start-session --target <instance-id>

# Docker (on EC2)
docker ps
docker-compose ps
docker-compose logs -f backend
docker-compose restart backend
```

## Security Notes

- 🔒 Secrets stored in SSM Parameter Store
- 🔐 EC2 uses IMDSv2 for metadata
- 🛡️ Security groups restrict access
- 📊 CloudWatch monitors resources
- 💾 RDS automatic backups enabled

## Next Steps

1. ✅ Deploy infrastructure (you're here!)
2. 📝 Configure domain/DNS
3. 🔐 Set up HTTPS (for EC2: use Certbot)
4. 📊 Monitor application performance
5. 🚀 Scale as needed (switch to ECS)

---

Need help? Check the full [DEPLOYMENT.md](../docs/DEPLOYMENT.md) guide or review CloudWatch logs.
