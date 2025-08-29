#!/bin/bash
set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-west-2}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
APP_NAME="${APP_NAME:-costfx}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com
    echo_success "ECR login successful!"
}

# Build and push Docker images
build_and_push_images() {
    echo_info "Building and pushing Docker images..."
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    BACKEND_REPO_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME-$ENVIRONMENT-backend"
    FRONTEND_REPO_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME-$ENVIRONMENT-frontend"
    
    # Build backend image
    echo_info "Building backend image..."
    docker build -f deploy/docker/Dockerfile.backend -t $BACKEND_REPO_URI:latest .
    docker push $BACKEND_REPO_URI:latest
    echo_success "Backend image pushed!"
    
    # Build frontend image with proper API URL
    echo_info "Building frontend image..."
    # Get ALB DNS for API URL
    ALB_DNS=$(terraform -chdir=deploy/terraform output -raw load_balancer_dns 2>/dev/null || echo "")
    if [ -n "$ALB_DNS" ]; then
        API_URL="http://$ALB_DNS/api/v1"
    else
        API_URL="http://localhost:3001/api/v1"
        echo_warning "Load balancer DNS not found, using localhost API URL"
    fi
    
    docker build \
        -f deploy/docker/Dockerfile.frontend \
        --build-arg VITE_API_URL="$API_URL" \
        -t $FRONTEND_REPO_URI:latest .
    docker push $FRONTEND_REPO_URI:latest
    echo_success "Frontend image pushed!"
}

# Deploy infrastructure
deploy_infrastructure() {
    echo_info "Deploying infrastructure with Terraform..."
    
    cd deploy/terraform
    
    # Initialize Terraform
    terraform init
    
    # Plan deployment
    terraform plan -var="environment=$ENVIRONMENT" -var="aws_region=$AWS_REGION"
    
    # Ask for confirmation
    echo_warning "About to apply Terraform changes. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo_info "Deployment cancelled."
        exit 0
    fi
    
    # Apply changes
    terraform apply -var="environment=$ENVIRONMENT" -var="aws_region=$AWS_REGION" -auto-approve
    
    cd ../..
    echo_success "Infrastructure deployed!"
}

# Update ECS services
update_services() {
    echo_info "Updating ECS services..."
    
    # Force new deployment to pick up new images
    aws ecs update-service \
        --cluster "$APP_NAME-$ENVIRONMENT-cluster" \
        --service "$APP_NAME-$ENVIRONMENT-backend" \
        --force-new-deployment \
        --region $AWS_REGION
    
    aws ecs update-service \
        --cluster "$APP_NAME-$ENVIRONMENT-cluster" \
        --service "$APP_NAME-$ENVIRONMENT-frontend" \
        --force-new-deployment \
        --region $AWS_REGION
    
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
    
    ALB_DNS=$(terraform -chdir=deploy/terraform output -raw load_balancer_dns 2>/dev/null || echo "")
    if [ -n "$ALB_DNS" ]; then
        echo_success "Application is available at: http://$ALB_DNS"
        echo_info "Backend API is available at: http://$ALB_DNS/api/v1/"
    else
        echo_warning "Could not retrieve application URL. Check Terraform outputs."
    fi
}

# Main deployment function
main() {
    echo_info "Starting deployment of CostFX to AWS ECS..."
    echo_info "Environment: $ENVIRONMENT"
    echo_info "Region: $AWS_REGION"
    echo_info "App Name: $APP_NAME"
    echo ""
    
    check_prerequisites
    deploy_infrastructure
    ecr_login
    build_and_push_images
    update_services
    wait_for_deployment
    show_app_url
    
    echo ""
    echo_success "🎉 Deployment completed successfully!"
    echo_info "Next steps:"
    echo "  1. Update OpenAI API key in SSM Parameter Store:"
    echo "     aws ssm put-parameter --name '/$APP_NAME/$ENVIRONMENT/openai_api_key' --value 'your_api_key' --type SecureString --overwrite"
    echo "  2. Run database migrations (if needed)"
    echo "  3. Verify application is working correctly"
}

# Run main function
main "$@"
