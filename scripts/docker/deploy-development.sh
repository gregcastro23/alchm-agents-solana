#!/bin/bash

# Planetary Agents - Development Deployment Script
# Sets up development environment with hot reloading

set -e

echo "🚀 Planetary Agents - Development Environment"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="planetary-agents-dev"
COMPOSE_FILE="docker-compose.dev.yml"
ENV_FILE=".env.docker.dev"

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
    log_info "Checking development requirements..."

    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "docker-compose.dev.yml not found!"
        exit 1
    fi

    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env.docker.dev not found. Creating from template..."
        cp .env.docker.dev.example .env.docker.dev || {
            log_error "Failed to create .env.docker.dev file"
            exit 1
        }
        log_warning "Please edit .env.docker.dev with your API keys before continuing"
        exit 1
    fi

    log_success "Requirements check passed"
}

# Setup development environment
setup_dev() {
    log_info "Setting up development environment..."

    # Create necessary directories
    mkdir -p logs database/init-dev

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        yarn install
    fi

    if [ ! -d "backend/node_modules" ]; then
        log_info "Installing backend dependencies..."
        cd backend && yarn install && cd ..
    fi

    log_success "Development environment setup complete"
}

# Start development services
start_dev() {
    log_info "Starting development services..."

    # Stop any existing containers
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans || true

    # Start core services first (database, cache)
    log_info "Starting core services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres-dev redis-dev

    # Wait for core services
    log_info "Waiting for core services..."
    sleep 15

    # Start application services
    log_info "Starting application services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d backend-dev frontend-dev

    # Wait for application services
    sleep 20
}

# Start development tools
start_tools() {
    read -p "Start development tools (Redis Commander, pgAdmin)? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Starting development tools..."
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile tools up -d

        echo ""
        log_info "Development Tools URLs:"
        echo "- Redis Commander: http://localhost:8081 (admin/consciousness)"
        echo "- pgAdmin: http://localhost:8082 (admin@planetary-agents.dev/consciousness)"
    fi
}

# Show development status
show_dev_status() {
    echo ""
    log_info "Development Environment Status:"
    echo "==============================="
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    log_info "Service URLs:"
    echo "- Frontend (Dev): http://localhost:3000"
    echo "- Backend (Dev):  http://localhost:8000"
    echo "- Database:       localhost:5433"
    echo "- Redis:          localhost:6380"
    echo ""
    log_info "Debugging:"
    echo "- Frontend Debug: Chrome DevTools -> localhost:9229"
    echo "- Backend Debug:  Chrome DevTools -> localhost:9230"
    echo ""
    log_info "Development Commands:"
    echo "- View logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "- Restart: docker-compose -f $COMPOSE_FILE restart frontend-dev"
    echo "- Shell access: docker-compose -f $COMPOSE_FILE exec frontend-dev sh"
    echo "- Database shell: docker-compose -f $COMPOSE_FILE exec postgres-dev psql -U planetary -d planetary_agents_dev"
}

# Watch logs
watch_logs() {
    read -p "Watch live logs? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Watching development logs (Ctrl+C to stop)..."
        docker-compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Main execution
main() {
    echo ""
    check_requirements
    setup_dev
    start_dev
    start_tools
    show_dev_status
    watch_logs

    log_success "🎉 Development environment is ready!"
    echo ""
    log_info "Happy coding! 🚀"
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Setup failed! Check the logs for details."
        log_info "Cleanup with: docker-compose -f $COMPOSE_FILE down"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Run main function
main "$@"