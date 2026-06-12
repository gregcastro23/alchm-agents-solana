#!/bin/bash

# Planetary Agents - Production Deployment Script
# Deploys the full stack with all optimizations

set -e

echo "🌟 Planetary Agents - Production Deployment"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="planetary-agents"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.docker"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required files exist
check_requirements() {
    log_info "Checking deployment requirements..."

    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "docker-compose.yml not found!"
        exit 1
    fi

    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env.docker not found. Creating from template..."
        cp .env.docker.example .env.docker || {
            log_error "Failed to create .env.docker file"
            exit 1
        }
        log_warning "Please edit .env.docker with your API keys before continuing"
        exit 1
    fi

    log_success "Requirements check passed"
}

# Validate environment variables
validate_env() {
    log_info "Validating environment configuration..."

    source "$ENV_FILE"

    # Check required API keys
    if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your_anthropic_api_key_here" ]; then
        log_error "ANTHROPIC_API_KEY is not configured in $ENV_FILE"
        exit 1
    fi

    if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
        log_error "OPENAI_API_KEY is not configured in $ENV_FILE"
        exit 1
    fi

    log_success "Environment validation passed"
}

# Build and deploy
deploy() {
    log_info "Starting production deployment..."

    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans || true

    # Pull latest images for dependencies
    log_info "Pulling latest dependency images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull postgres redis

    # Build application images
    log_info "Building application images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache

    # Start services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

    # Wait for services to be healthy
    log_info "Waiting for services to become healthy..."
    sleep 30

    # Check service health
    check_health
}

# Health check
check_health() {
    log_info "Performing health checks..."

    # Check database
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U planetary -d planetary_agents > /dev/null 2>&1; then
        log_success "✓ Database is healthy"
    else
        log_error "✗ Database health check failed"
        return 1
    fi

    # Check Redis
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; then
        log_success "✓ Redis is healthy"
    else
        log_error "✗ Redis health check failed"
        return 1
    fi

    # Check backend
    sleep 10
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        log_success "✓ Backend is healthy"
    else
        log_error "✗ Backend health check failed"
        return 1
    fi

    # Check frontend
    sleep 10
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "✓ Frontend is healthy"
    else
        log_error "✗ Frontend health check failed"
        return 1
    fi

    log_success "All services are healthy!"
}

# Show deployment status
show_status() {
    echo ""
    log_info "Deployment Status:"
    echo "=================="
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    log_info "Service URLs:"
    echo "- Frontend: http://localhost:3000"
    echo "- Backend:  http://localhost:8000"
    echo "- API Health: http://localhost:8000/api/health"
    echo ""
    log_info "Logs:"
    echo "- View logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "- Backend logs: docker-compose -f $COMPOSE_FILE logs -f backend"
    echo "- Frontend logs: docker-compose -f $COMPOSE_FILE logs -f frontend"
}

# Cleanup on failure
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Deployment failed! Cleaning up..."
        docker-compose -f "$COMPOSE_FILE" down --remove-orphans || true
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Main execution
main() {
    echo ""
    check_requirements
    validate_env
    deploy
    show_status

    log_success "🎉 Production deployment completed successfully!"
    echo ""
    log_info "Monitor deployment with:"
    echo "  ./scripts/docker/monitor.sh"
    echo ""
    log_info "Scale services with:"
    echo "  docker-compose -f $COMPOSE_FILE scale frontend=2 backend=2"
}

# Run main function
main "$@"