#!/bin/bash
# EC2 deployment script - updates running containers on EC2 instance
# This script is used by GitHub Actions to deploy application updates to EC2

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
if [ -z "$INSTANCE_ID" ]; then
    print_error "INSTANCE_ID is required"
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    print_error "AWS_REGION is required"
    exit 1
fi

if [ -z "$BACKEND_IMAGE" ] && [ -z "$FRONTEND_IMAGE" ]; then
    print_error "At least one of BACKEND_IMAGE or FRONTEND_IMAGE is required"
    exit 1
fi

print_info "Starting EC2 deployment"
print_info "Instance ID: $INSTANCE_ID"
print_info "Region: $AWS_REGION"

# Create deployment script to run on EC2
cat > /tmp/deploy-on-ec2.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

cd /opt/costfx

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region AWS_REGION_PLACEHOLDER | docker login --username AWS --password-stdin ECR_REGISTRY_PLACEHOLDER

# Pull new images
if [ -n "BACKEND_IMAGE_PLACEHOLDER" ]; then
    echo "📥 Pulling new backend image..."
    docker pull BACKEND_IMAGE_PLACEHOLDER
fi

if [ -n "FRONTEND_IMAGE_PLACEHOLDER" ]; then
    echo "📥 Pulling new frontend image..."
    docker pull FRONTEND_IMAGE_PLACEHOLDER
fi

# Update docker-compose.yml with new images
if [ -n "BACKEND_IMAGE_PLACEHOLDER" ]; then
    echo "🔄 Updating backend image in docker-compose.yml..."
    sed -i "s|image: .*costfx-backend.*|image: BACKEND_IMAGE_PLACEHOLDER|" docker-compose.yml
fi

if [ -n "FRONTEND_IMAGE_PLACEHOLDER" ]; then
    echo "🔄 Updating frontend image in docker-compose.yml..."
    sed -i "s|image: .*costfx-frontend.*|image: FRONTEND_IMAGE_PLACEHOLDER|" docker-compose.yml
fi

# Restart services with new images
echo "🔄 Restarting services..."
docker-compose up -d --force-recreate

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
docker-compose ps

# Test backend
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "⚠️ Backend health check failed"
    docker-compose logs --tail=50 backend
fi

# Test frontend
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "⚠️ Frontend health check failed"
    docker-compose logs --tail=50 frontend
fi

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

echo "✅ Deployment completed successfully!"
DEPLOY_SCRIPT

# Replace placeholders in the script
sed -i "s|AWS_REGION_PLACEHOLDER|$AWS_REGION|g" /tmp/deploy-on-ec2.sh
sed -i "s|ECR_REGISTRY_PLACEHOLDER|${BACKEND_IMAGE%%/*}|g" /tmp/deploy-on-ec2.sh
sed -i "s|BACKEND_IMAGE_PLACEHOLDER|${BACKEND_IMAGE:-}|g" /tmp/deploy-on-ec2.sh
sed -i "s|FRONTEND_IMAGE_PLACEHOLDER|${FRONTEND_IMAGE:-}|g" /tmp/deploy-on-ec2.sh

# Make script executable
chmod +x /tmp/deploy-on-ec2.sh

# Copy script to EC2 instance
print_info "Copying deployment script to EC2 instance..."
aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[
        'mkdir -p /tmp/deploy',
        'cat > /tmp/deploy/deploy.sh << EOF',
        '$(cat /tmp/deploy-on-ec2.sh)',
        'EOF',
        'chmod +x /tmp/deploy/deploy.sh'
    ]" \
    --region "$AWS_REGION" \
    --output text \
    --query "Command.CommandId" > /tmp/copy-command-id.txt

COPY_COMMAND_ID=$(cat /tmp/copy-command-id.txt)
print_info "Copy command ID: $COPY_COMMAND_ID"

# Wait for copy to complete
print_info "Waiting for copy to complete..."
aws ssm wait command-executed \
    --command-id "$COPY_COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION"

# Execute deployment script on EC2
print_info "Executing deployment script on EC2..."
DEPLOY_COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["/tmp/deploy/deploy.sh 2>&1 | tee /tmp/deploy/deploy.log"]' \
    --region "$AWS_REGION" \
    --output text \
    --query "Command.CommandId")

print_info "Deploy command ID: $DEPLOY_COMMAND_ID"

# Wait for deployment to complete
print_info "Waiting for deployment to complete..."
aws ssm wait command-executed \
    --command-id "$DEPLOY_COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION"

# Get command output
print_info "Deployment output:"
aws ssm get-command-invocation \
    --command-id "$DEPLOY_COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query "StandardOutputContent" \
    --output text

# Check if deployment was successful
EXIT_CODE=$(aws ssm get-command-invocation \
    --command-id "$DEPLOY_COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query "ResponseCode" \
    --output text)

if [ "$EXIT_CODE" = "0" ]; then
    print_info "✅ EC2 deployment completed successfully!"
    exit 0
else
    print_error "❌ EC2 deployment failed with exit code: $EXIT_CODE"
    # Get error output
    aws ssm get-command-invocation \
        --command-id "$DEPLOY_COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --query "StandardErrorContent" \
        --output text
    exit 1
fi
