# 🚀 **Option 2: Simple EC2 + Docker Compose Development Plan**

## **📋 Migration Strategy**

### **Phase 1: Setup New EC2 Infrastructure (2-3 hours)**
1. **Create EC2 Instance via Terraform**
   - Add new `ec2-simple.tf` file to existing terraform
   - t3.micro instance in existing VPC/subnets
   - Reuse existing security groups (modify to allow port 3000/3001)
   - Add Elastic IP for consistent access

2. **Instance Configuration**
   - Amazon Linux 2023 (matches your current stack)
   - Install Docker + Docker Compose via user_data script
   - Configure CloudWatch agent for basic monitoring
   - SSH key access for debugging

### **Phase 2: Deployment Automation (1-2 hours)**
1. **Simple Deploy Script**
   - `rsync` code to EC2 instance
   - `docker-compose pull && docker-compose up -d`
   - Health check validation
   - Rollback capability

2. **GitHub Actions Integration**
   - Modify existing workflow to deploy to EC2 instead of ECS
   - SSH-based deployment (much simpler than ECS API calls)
   - Same environment variable management

### **Phase 3: Database Integration (30 minutes)**
1. **RDS Connection**
   - Keep existing RDS PostgreSQL (no changes needed)
   - Update security group to allow EC2 → RDS access
   - Same DATABASE_URL, just different source IP

2. **Environment Variables**
   - Copy existing SSM parameters
   - Simple `.env` file on EC2 or docker-compose environment

### **Phase 4: Monitoring & Logging (1 hour)**
1. **Basic Monitoring**
   - CloudWatch agent on EC2
   - Docker container logs → CloudWatch
   - Simple health check endpoint monitoring

2. **Alerting**
   - Reuse existing SNS topics
   - EC2 instance health checks
   - Application health monitoring

## **📊 Implementation Details**

### **Terraform Changes**
```hcl
# New file: deploy/terraform/ec2-simple.tf
resource "aws_instance" "app_server" {
  ami           = "ami-0c02fb55956c7d316"  # Amazon Linux 2023
  instance_type = "t3.micro"
  key_name      = var.key_name
  
  vpc_security_group_ids = [aws_security_group.app_server.id]
  subnet_id              = module.vpc.private_subnets[0]
  
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {}))
  
  tags = {
    Name = "${var.app_name}-${var.environment}-app-server"
  }
}

resource "aws_eip" "app_server" {
  instance = aws_instance.app_server.id
  domain   = "vpc"
}
```

### **Deployment Script**
```bash
#!/bin/bash
# deploy/scripts/deploy-ec2.sh

set -e

SERVER_IP="your-ec2-ip"
APP_DIR="/home/ec2-user/costfx"

echo "🚀 Deploying to EC2..."

# Sync code (excluding node_modules, .git, etc.)
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude logs \
  . ec2-user@$SERVER_IP:$APP_DIR/

# Deploy with zero downtime
ssh ec2-user@$SERVER_IP "cd $APP_DIR && \
  docker-compose pull && \
  docker-compose up -d && \
  sleep 5 && \
  curl -f http://localhost:3001/health || exit 1"

echo "✅ Deployment complete!"
```

### **Docker Compose (Reuse Existing)**
- Your current `docker-compose.yml` works as-is
- Just need to ensure environment variables are set
- Maybe add restart policies: `restart: unless-stopped`

## **🎯 Migration Timeline**

### **Day 1: Infrastructure Setup**
- [ ] Create EC2 Terraform configuration
- [ ] Apply terraform and provision instance
- [ ] Install Docker/Docker Compose
- [ ] Test basic connectivity

### **Day 2: Application Deployment**  
- [ ] Create deployment script
- [ ] Deploy application to EC2
- [ ] Verify database connectivity
- [ ] Test application functionality

### **Day 3: CI/CD Integration**
- [ ] Modify GitHub Actions workflow
- [ ] Test automated deployments
- [ ] Set up basic monitoring
- [ ] Update DNS/load balancer (if needed)

### **Day 4: Cleanup & Validation**
- [ ] Full end-to-end testing
- [ ] Performance validation
- [ ] Clean up old ECS resources (save costs immediately!)

## **💰 Cost Impact**

### **Before (ECS/Fargate)**
- ECS Tasks: ~$30/month
- ALB: ~$18/month  
- NAT Gateway: ~$30/month
- **Total: ~$78/month**

### **After (EC2)**
- t3.micro: ~$8.50/month
- Elastic IP: ~$3.60/month
- **Total: ~$12/month**

**💡 Savings: ~$66/month (85% reduction!)**

## **🔄 Rollback Plan**
- Keep ECS infrastructure until EC2 is fully validated
- Can switch DNS back to ECS ALB instantly if needed
- Zero risk approach - test thoroughly before decommissioning ECS

## **🎁 Bonus Benefits**
- **SSH Access**: Can debug directly on server
- **Faster Iteration**: No container registry pushes needed for quick tests
- **Simpler Architecture**: Easier to understand and maintain
- **Local Development Parity**: Same Docker Compose stack

## **📝 Notes**
- Generated on September 23, 2025
- Plan for migrating from ECS/Fargate to simple EC2 + Docker Compose
- Focus on rapid development with minimal cost and complexity
- Estimated total migration time: 1-2 days
- Risk level: Low (can rollback easily)
