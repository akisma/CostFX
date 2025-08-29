#!/bin/bash
set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-west-2}"
ENVIRONMENT="${ENVIRONMENT:-prod}"

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
    
    # Check if AWS CLI is installed and configured
    if ! command -v aws &> /dev/null; then
        echo_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        echo_error "Terraform is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        echo_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    echo_success "All prerequisites are met!"
}

# Get or create ECR repositories
setup_ecr() {
    echo_info "Setting up ECR repositories..."
    
    # Create backend repository if it doesn't exist
    if ! aws ecr describe-repositories --repository-names costfx-backend --region $AWS_REGION &> /dev/null; then
        echo_info "Creating backend ECR repository..."
        aws ecr create-repository --repository-name costfx-backend --region $AWS_REGION
    fi
    
    # Create frontend repository if it doesn't exist
    if ! aws ecr describe-repositories --repository-names costfx-frontend --region $AWS_REGION &> /dev/null; then
        echo_info "Creating frontend ECR repository..."
        aws ecr create-repository --repository-name costfx-frontend --region $AWS_REGION
    fi
    
    echo_success "ECR repositories are ready!"
}

# Build and push Docker images
build_and_push() {
    echo_info "Building and pushing Docker images..."
    
    # Get ECR registry URL
    ECR_REGISTRY=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com
    IMAGE_TAG=$(git rev-parse --short HEAD)
    
    # Login to ECR
    echo_info "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    
    # Build backend image
    echo_info "Building backend image..."
    docker build -t $ECR_REGISTRY/costfx-backend:$IMAGE_TAG -f deploy/docker/Dockerfile.backend .
    
    # Build frontend image
    echo_info "Building frontend image..."
    read -p "Enter your domain name (or press Enter for localhost): " DOMAIN_NAME
    if [ -z "$DOMAIN_NAME" ]; then
        API_URL="http://localhost:3002/api/v1"
        echo_warning "Using localhost for API URL. This won't work in production!"
    else
        API_URL="https://$DOMAIN_NAME/api/v1"
    fi
    
    docker build -t $ECR_REGISTRY/costfx-frontend:$IMAGE_TAG \
        -f deploy/docker/Dockerfile.frontend \
        --target production \
        --build-arg VITE_API_URL=$API_URL .
    
    # Push images
    echo_info "Pushing backend image..."
    docker push $ECR_REGISTRY/costfx-backend:$IMAGE_TAG
    
    echo_info "Pushing frontend image..."
    docker push $ECR_REGISTRY/costfx-frontend:$IMAGE_TAG
    
    # Export variables for Terraform
    export BACKEND_IMAGE="$ECR_REGISTRY/costfx-backend:$IMAGE_TAG"
    export FRONTEND_IMAGE="$ECR_REGISTRY/costfx-frontend:$IMAGE_TAG"
    
    echo_success "Docker images built and pushed!"
    echo_info "Backend image: $BACKEND_IMAGE"
    echo_info "Frontend image: $FRONTEND_IMAGE"
}

# Create terraform.tfvars file
create_tfvars() {
    echo_info "Creating terraform.tfvars file..."
    
    # Check if tfvars already exists
    if [ -f "deploy/terraform/terraform.tfvars" ]; then
        echo_warning "terraform.tfvars already exists. Creating backup..."
        cp deploy/terraform/terraform.tfvars deploy/terraform/terraform.tfvars.backup
    fi
    
    # Prompt for secrets
    echo ""
    echo_warning "Please provide the following secrets:"
    read -p "JWT Secret (press Enter to generate): " JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32)
        echo_info "Generated JWT secret: $JWT_SECRET"
    fi
    
    read -p "OpenAI API Key (optional): " OPENAI_API_KEY
    read -p "Database Password (press Enter to generate): " DB_PASSWORD
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(openssl rand -base64 16)
        echo_info "Generated database password: $DB_PASSWORD"
    fi
    
    # Create tfvars file
    cat > deploy/terraform/terraform.tfvars << EOF
# Environment Configuration
environment = "$ENVIRONMENT"
aws_region = "$AWS_REGION"

# Docker Images
backend_image = "$BACKEND_IMAGE"
frontend_image = "$FRONTEND_IMAGE"

# Application Secrets
jwt_secret = "$JWT_SECRET"
openai_api_key = "$OPENAI_API_KEY"

# Database Configuration
db_username = "postgres"
db_password = "$DB_PASSWORD"
EOF
    
    echo_success "terraform.tfvars created!"
}

# Deploy with Terraform
deploy() {
    echo_info "Deploying with Terraform..."
    
    cd deploy/terraform
    
    # Initialize Terraform
    echo_info "Initializing Terraform..."
    terraform init
    
    # Plan deployment
    echo_info "Planning deployment..."
    terraform plan
    
    echo ""
    echo_warning "Review the plan above. Do you want to proceed with deployment?"
    read -p "Type 'yes' to continue: " CONFIRM
    
    if [ "$CONFIRM" = "yes" ]; then
        echo_info "Applying Terraform configuration..."
        terraform apply -auto-approve
        
        echo ""
        echo_success "🎉 Deployment completed!"
        echo_info "Getting deployment URLs..."
        
        LOAD_BALANCER_URL=$(terraform output -raw load_balancer_url)
        BACKEND_URL=$(terraform output -raw backend_url)
        
        echo ""
        echo_success "Application URLs:"
        echo_info "Frontend: $LOAD_BALANCER_URL"
        echo_info "Backend API: $BACKEND_URL"
        echo ""
        echo_warning "Note: It may take a few minutes for the services to become healthy."
    else
        echo_warning "Deployment cancelled."
    fi
    
    cd ../..
}

# Main deployment function
main() {
    echo_info "Starting CostFX deployment..."
    echo_info "Environment: $ENVIRONMENT"
    echo_info "AWS Region: $AWS_REGION"
    echo ""
    
    check_prerequisites
    setup_ecr
    build_and_push
    create_tfvars
    deploy
}

# Show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -e, --environment   Environment (default: prod)"
    echo "  -r, --region        AWS region (default: us-west-2)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 --environment staging --region us-east-1"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function
main
