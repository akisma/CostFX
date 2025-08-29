#!/bin/bash
set -e

# Configuration
APP_NAME="${APP_NAME:-costfx}"
ENVIRONMENT="${ENVIRONMENT:-test}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-80}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"

# GitHub Actions compatibility
if [ "${GITHUB_ACTIONS}" = "true" ]; then
    FRONTEND_EXTERNAL_PORT="8081"
    BACKEND_EXTERNAL_PORT="3002" 
    POSTGRES_EXTERNAL_PORT="5433"
    REDIS_EXTERNAL_PORT="6380"
else
    FRONTEND_EXTERNAL_PORT="${FRONTEND_EXTERNAL_PORT:-8081}"
    BACKEND_EXTERNAL_PORT="${BACKEND_EXTERNAL_PORT:-3002}"
    POSTGRES_EXTERNAL_PORT="${POSTGRES_EXTERNAL_PORT:-5433}"
    REDIS_EXTERNAL_PORT="${REDIS_EXTERNAL_PORT:-6380}"
fi

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

# Clean up function
cleanup() {
    echo_info "Cleaning up containers..."
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    rm -f docker-compose.test.yml
    echo_success "Cleanup completed!"
}

# Ensure we're in the project root
ensure_project_root() {
    if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
        if [ -f "../../package.json" ] && [ -d "../../backend" ] && [ -d "../../frontend" ]; then
            cd ../..
            echo_info "Changed to project root: $(pwd)"
        else
            echo_error "Please run this script from the project root or deploy/scripts directory"
            exit 1
        fi
    fi
}

# Create docker-compose file for testing
create_test_compose() {
    cat > docker-compose.test.yml << EOF
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: restaurant_ai
    ports:
      - "${POSTGRES_EXTERNAL_PORT}:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_EXTERNAL_PORT}:6379"
    volumes:
      - redis_test_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  backend:
    build:
      context: .
      dockerfile: deploy/docker/Dockerfile.backend
    environment:
      - NODE_ENV=development
      - PORT=${BACKEND_PORT}
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/restaurant_ai
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=test_jwt_secret_for_local_testing_only
      - OPENAI_API_KEY=test_key
    ports:
      - "${BACKEND_EXTERNAL_PORT}:${BACKEND_PORT}"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:${BACKEND_PORT}/api/v1/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  frontend:
    build:
      context: .
      dockerfile: deploy/docker/Dockerfile.frontend
      target: production
      args:
        VITE_API_URL: http://localhost:${BACKEND_EXTERNAL_PORT}/api/v1
    ports:
      - "${FRONTEND_EXTERNAL_PORT}:${FRONTEND_PORT}"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:${FRONTEND_PORT}/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

volumes:
  postgres_test_data:
  redis_test_data:
EOF
}

# Build and test containers
test_containers() {
    echo_info "Testing containerized deployment locally..."
    echo_info "Backend port: ${BACKEND_EXTERNAL_PORT}"
    echo_info "Frontend port: ${FRONTEND_EXTERNAL_PORT}"
    
    # Ensure we're in the right directory
    ensure_project_root
    
    # Create test docker-compose file
    create_test_compose
    
    # Start services
    echo_info "Starting services..."
    docker-compose -f docker-compose.test.yml up -d
    
    # Wait for services to be healthy
    echo_info "Waiting for services to be healthy..."
    TIMEOUT=180  # Reduced timeout to 3 minutes
    ELAPSED=0
    INTERVAL=10
    
    while [ $ELAPSED -lt $TIMEOUT ]; do
        # Check if any containers have failed/exited
        if docker-compose -f docker-compose.test.yml ps | grep -E "(Exited|Exit)"; then
            echo_error "One or more containers have failed/exited"
            echo_error "Container status:"
            docker-compose -f docker-compose.test.yml ps
            echo_error "All logs:"
            docker-compose -f docker-compose.test.yml logs
            cleanup
            exit 1
        fi
        
        # Check if backend and postgres/redis are healthy (frontend may not have health check)
        BACKEND_HEALTHY=$(docker-compose -f docker-compose.test.yml ps backend | grep -c "healthy" || echo "0")
        POSTGRES_HEALTHY=$(docker-compose -f docker-compose.test.yml ps postgres | grep -c "healthy" || echo "0")
        REDIS_HEALTHY=$(docker-compose -f docker-compose.test.yml ps redis | grep -c "healthy" || echo "0")
        
        echo_info "Health status - Backend: $BACKEND_HEALTHY, Postgres: $POSTGRES_HEALTHY, Redis: $REDIS_HEALTHY"
        
        if [ "$BACKEND_HEALTHY" = "1" ] && [ "$POSTGRES_HEALTHY" = "1" ] && [ "$REDIS_HEALTHY" = "1" ]; then
            echo_success "Core services are healthy!"
            break
        fi
        
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
    done
    
    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo_error "Services failed to become healthy within 3 minutes"
        echo_error "Container status:"
        docker-compose -f docker-compose.test.yml ps
        echo_error "All logs:"
        docker-compose -f docker-compose.test.yml logs
        cleanup
        exit 1
    fi
    
    # Test backend API
    echo_info "Testing backend API..."
    sleep 10  # Give backend a moment to fully start
    if curl -f -s "http://localhost:${BACKEND_EXTERNAL_PORT}/api/v1/" > /dev/null; then
        echo_success "Backend API is responding!"
    else
        echo_error "Backend API is not responding"
        docker-compose -f docker-compose.test.yml logs backend
        cleanup
        exit 1
    fi
    
    # Test frontend
    echo_info "Testing frontend..."
    if curl -f -s "http://localhost:${FRONTEND_EXTERNAL_PORT}/" > /dev/null; then
        echo_success "Frontend is responding!"
    else
        echo_error "Frontend is not responding"
        docker-compose -f docker-compose.test.yml logs frontend
        cleanup
        exit 1
    fi
    
    echo_success "🎉 All containers are working correctly!"
    echo_info "Access the application at: http://localhost:${FRONTEND_EXTERNAL_PORT}"
    echo_info "Backend API available at: http://localhost:${BACKEND_EXTERNAL_PORT}/api/v1/"
    
    # In GitHub Actions, don't wait for user input
    if [ "${GITHUB_ACTIONS}" != "true" ]; then
        echo ""
        echo_warning "Press Enter to stop containers or Ctrl+C to keep them running..."
        read -r
    fi
    
    cleanup
}

# Show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  test     Test containers locally"
    echo "  cleanup  Clean up test containers"
    echo "  help     Show this help message"
}

# Main function
main() {
    case "${1:-test}" in
        test)
            test_containers
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            echo_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"
