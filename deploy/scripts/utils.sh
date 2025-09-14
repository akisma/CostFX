#!/bin/bash

# CostFX Deployment Utilities
# Common functions used by deployment scripts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    echo_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        echo_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        echo_error "Terraform is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    echo_success "All prerequisites met!"
}

# Get ECR login token
ecr_login() {
    echo_info "Logging into ECR..."
    local ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    aws ecr get-login-password --region $AWS_REGION | \
        docker login --username AWS --password-stdin \
        $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    echo_success "ECR login successful!"
}

# Get the load balancer DNS name with multiple fallback methods
get_alb_dns() {
    local ALB_DNS=""
    
    # Method 1: Try to get from Terraform output
    ALB_DNS=$(terraform -chdir=terraform output -raw load_balancer_dns 2>/dev/null || echo "")
    
    # Method 2: Try AWS CLI using naming convention
    if [ -z "$ALB_DNS" ]; then
        ALB_DNS=$(aws elbv2 describe-load-balancers \
            --query "LoadBalancers[?LoadBalancerName=='$APP_NAME-$ENVIRONMENT-alb'].DNSName" \
            --output text \
            --region $AWS_REGION 2>/dev/null || echo "")
    fi
    
    # Method 3: Try to get any ALB with our app tag
    if [ -z "$ALB_DNS" ]; then
        ALB_DNS=$(aws elbv2 describe-load-balancers \
            --query "LoadBalancers[?contains(LoadBalancerName, '$APP_NAME')].DNSName" \
            --output text \
            --region $AWS_REGION 2>/dev/null | head -1 || echo "")
    fi
    
    echo "$ALB_DNS"
}

# Deploy Terraform infrastructure
deploy_infrastructure() {
    echo_info "Deploying infrastructure with Terraform..."
    
    # Get the directory where this script is located
    local UTILS_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local DEPLOY_DIR="$(cd "$UTILS_SCRIPT_DIR/.." && pwd)"
    
    # Navigate to terraform directory
    cd "$DEPLOY_DIR/terraform"
    
    # Initialize Terraform
    terraform init
    
    # Create terraform.tfvars if it doesn't exist
    if [ ! -f terraform.tfvars ]; then
        echo_info "Creating terraform.tfvars file..."
        cat > terraform.tfvars << EOF
app_name    = "$APP_NAME"
environment = "$ENVIRONMENT"
aws_region  = "$AWS_REGION"
EOF
    fi
    
    # Plan and apply
    terraform plan -out=tfplan
    terraform apply tfplan
    rm -f tfplan
    
    cd ..
    echo_success "Infrastructure deployment completed!"
}

# Build and push Docker images
build_and_push_images() {
    echo_info "Building and pushing Docker images..."
    
    local ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    local BACKEND_REPO_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME-$ENVIRONMENT-backend"
    local FRONTEND_REPO_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME-$ENVIRONMENT-frontend"
    
    # Build backend image
    echo_info "Building backend image..."
    docker build -f deploy/docker/Dockerfile.backend -t $BACKEND_REPO_URI:latest .
    docker push $BACKEND_REPO_URI:latest
    echo_success "Backend image pushed!"
    
    # Build frontend image with correct API URL
    echo_info "Building frontend image..."
    local ALB_DNS=$(get_alb_dns)
    local API_URL="http://${ALB_DNS}/api/v1"
    
    if [ -n "$ALB_DNS" ]; then
        echo_info "Using API URL: $API_URL"
        docker build -f Dockerfile.frontend \
            --platform linux/amd64 \
            --build-arg VITE_API_URL="$API_URL" \
            -t $FRONTEND_REPO_URI:latest .
    else
        echo_warning "ALB DNS not found, building frontend with placeholder URL"
        docker build -f Dockerfile.frontend \
            --platform linux/amd64 \
            --build-arg VITE_API_URL="http://localhost:3001/api/v1" \
            -t $FRONTEND_REPO_URI:latest .
    fi
    
    docker push $FRONTEND_REPO_URI:latest
    echo_success "Frontend image pushed!"
}

# Rebuild frontend with correct API URL
rebuild_frontend_with_correct_api_url() {
    echo_info "Rebuilding frontend with correct API URL..."
    
    local ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    local FRONTEND_REPO_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME-$ENVIRONMENT-frontend"
    
    # Get ALB DNS
    local ALB_DNS=$(get_alb_dns)
    if [ -z "$ALB_DNS" ]; then
        echo_error "Cannot determine load balancer DNS name"
        exit 1
    fi
    
    local API_URL="http://${ALB_DNS}/api/v1"
    echo_info "Building frontend with API URL: $API_URL"
    
    # Build and push frontend with correct API URL for AMD64 platform
    docker build -f Dockerfile.frontend \
        --platform linux/amd64 \
        --build-arg VITE_API_URL="$API_URL" \
        -t $FRONTEND_REPO_URI:latest .
    docker push $FRONTEND_REPO_URI:latest
    
    # Force ECS service update
    aws ecs update-service \
        --cluster "$APP_NAME-$ENVIRONMENT" \
        --service "$APP_NAME-$ENVIRONMENT-frontend" \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null
    
    echo_success "Frontend rebuilt and deployment triggered!"
}

# Update ECS services
update_services() {
    echo_info "Updating ECS services..."
    
    # Update backend service
    aws ecs update-service \
        --cluster "$APP_NAME-$ENVIRONMENT" \
        --service "$APP_NAME-$ENVIRONMENT-backend" \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null
    
    # Update frontend service
    aws ecs update-service \
        --cluster "$APP_NAME-$ENVIRONMENT" \
        --service "$APP_NAME-$ENVIRONMENT-frontend" \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null
    
    echo_success "ECS services updated!"
}

# Wait for deployment to complete
wait_for_deployment() {
    echo_info "Waiting for deployment to complete..."
    
    aws ecs wait services-stable \
        --cluster "$APP_NAME-$ENVIRONMENT-cluster" \
        --services "$APP_NAME-$ENVIRONMENT-backend" "$APP_NAME-$ENVIRONMENT-frontend" \
        --region $AWS_REGION
    
    echo_success "Deployment completed!"
}

# Show application URL
show_app_url() {
    echo_info "Getting application URL..."
    
    local ALB_DNS=$(get_alb_dns)
    if [ -n "$ALB_DNS" ]; then
        echo ""
        echo_success "🌐 Application is available at: http://$ALB_DNS"
        echo_info "📡 Backend API is available at: http://$ALB_DNS/api/v1/"
        echo ""
    else
        echo_warning "Could not retrieve application URL. Check Terraform outputs."
    fi
}
