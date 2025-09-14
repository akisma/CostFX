#!/bin/bash

# CostFX Unified Deployment Script
# Single entry point for all deployment operations
# Usage: ./deploy.sh [options]

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Source utilities
source "$SCRIPT_DIR/scripts/utils.sh"

# Configuration
AWS_REGION="${AWS_REGION:-us-west-2}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
APP_NAME="${APP_NAME:-costfx}"

# Display usage information
show_usage() {
    cat << EOF
CostFX Deployment Script

USAGE:
    ./deploy.sh [OPTIONS]

OPTIONS:
    --help                  Show this help message
    --setup-infra          Deploy infrastructure only (Terraform)
    --frontend-only        Rebuild and redeploy frontend only
    --update-ssm-only      Update SSM parameters only
    --full                 Full deployment (default)

EXAMPLES:
    ./deploy.sh                    # Full deployment
    ./deploy.sh --frontend-only    # Rebuild frontend with correct API URL
    ./deploy.sh --setup-infra      # Deploy infrastructure only
    ./deploy.sh --update-ssm-only  # Update SSM parameters only

ENVIRONMENT VARIABLES:
    AWS_REGION      AWS region (default: us-west-2)
    ENVIRONMENT     Environment name (default: dev)
    APP_NAME        Application name (default: costfx)

EOF
}

# Parse command line arguments
parse_args() {
    OPERATION="full"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --setup-infra)
                OPERATION="infra"
                shift
                ;;
            --frontend-only)
                OPERATION="frontend"
                shift
                ;;
            --update-ssm-only)
                OPERATION="ssm"
                shift
                ;;
            --full)
                OPERATION="full"
                shift
                ;;
            *)
                echo_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Deploy infrastructure only
deploy_infrastructure_only() {
    echo_success "🏗️  Deploying infrastructure..."
    echo_info "Environment: $ENVIRONMENT"
    echo_info "AWS Region: $AWS_REGION"
    echo ""
    
    check_prerequisites
    deploy_infrastructure
    show_infrastructure_outputs
    
    echo_success "✅ Infrastructure deployment completed!"
}

# Frontend-only rebuild
deploy_frontend_only() {
    echo_success "🔧 Rebuilding frontend..."
    echo_info "This will rebuild the frontend with the correct API URL"
    echo ""
    
    check_prerequisites
    
    # Check if infrastructure exists
    local ALB_DNS=$(get_alb_dns)
    if [ -z "$ALB_DNS" ]; then
        echo_error "No load balancer found. Please deploy infrastructure first:"
        echo "  ./deploy.sh --setup-infra"
        exit 1
    fi
    
    echo_info "Load balancer found: $ALB_DNS"
    echo_info "API URL will be: http://$ALB_DNS/api/v1"
    echo ""
    
    ecr_login
    rebuild_frontend_with_correct_api_url
    
    # Wait for deployment
    echo_info "Waiting for frontend deployment to complete..."
    aws ecs wait services-stable \
        --cluster "$APP_NAME-$ENVIRONMENT" \
        --services "$APP_NAME-$ENVIRONMENT-frontend" \
        --region $AWS_REGION
    
    echo_success "✅ Frontend rebuild completed!"
    echo_info "Frontend is now available at: http://$ALB_DNS"
}

# SSM parameters only
update_ssm_only() {
    echo_success "📝 Updating SSM parameters..."
    
    check_prerequisites
    deploy_infrastructure
    
    echo_success "✅ SSM parameters updated!"
}

# Full deployment
deploy_full() {
    echo_success "🚀 Starting full deployment..."
    echo_info "Environment: $ENVIRONMENT"
    echo_info "AWS Region: $AWS_REGION" 
    echo_info "App Name: $APP_NAME"
    echo ""
    
    check_prerequisites
    deploy_infrastructure
    ecr_login
    build_and_push_images
    rebuild_frontend_with_correct_api_url
    update_services
    wait_for_deployment
    show_app_url
    
    echo ""
    echo_success "🎉 Full deployment completed successfully!"
    show_next_steps
}

# Show infrastructure outputs
show_infrastructure_outputs() {
    echo_info "Infrastructure outputs:"
    terraform -chdir=terraform output 2>/dev/null || echo_warning "No Terraform outputs available"
}

# Show next steps
show_next_steps() {
    echo_info "Next steps:"
    echo "  1. Update OpenAI API key in SSM Parameter Store:"
    echo "     aws ssm put-parameter --name '/$APP_NAME/$ENVIRONMENT/openai_api_key' --value 'your_api_key' --type SecureString --overwrite"
    echo "  2. Run database migrations (if needed)"
    echo "  3. Verify application is working correctly"
}

# Main function
main() {
    parse_args "$@"
    
    case $OPERATION in
        "infra")
            deploy_infrastructure_only
            ;;
        "frontend")
            deploy_frontend_only
            ;;
        "ssm")
            update_ssm_only
            ;;
        "full")
            deploy_full
            ;;
        *)
            echo_error "Invalid operation: $OPERATION"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
