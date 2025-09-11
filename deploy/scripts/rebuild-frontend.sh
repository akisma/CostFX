#!/bin/bash

# CostFX Frontend Rebuild Script
# This script rebuilds and redeploys the frontend with the correct API URL
# Useful when the frontend was initially built before the load balancer was ready

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source colors and utilities
source "$SCRIPT_DIR/deploy.sh"

# Change to project root
cd "$PROJECT_ROOT"

echo_success "🔧 CostFX Frontend Rebuild"
echo_info "This will rebuild the frontend with the correct API URL and redeploy it"
echo ""

# Check if infrastructure exists
ALB_DNS=$(get_alb_dns)
if [ -z "$ALB_DNS" ]; then
    echo_error "No load balancer found. Please deploy infrastructure first with:"
    echo "  ./deploy/scripts/deploy.sh"
    exit 1
fi

echo_info "Load balancer found: $ALB_DNS"
echo_info "API URL will be: http://$ALB_DNS/api/v1"
echo ""

# Rebuild frontend
rebuild_frontend_if_needed

# Wait for new deployment
echo_info "Waiting for frontend deployment to complete..."
aws ecs wait services-stable \
    --cluster "$APP_NAME-$ENVIRONMENT-cluster" \
    --services "$APP_NAME-$ENVIRONMENT-frontend" \
    --region $AWS_REGION

echo ""
echo_success "✅ Frontend rebuild completed successfully!"
echo_info "Frontend is now available at: http://$ALB_DNS"
echo_info "API calls will now use: http://$ALB_DNS/api/v1"
