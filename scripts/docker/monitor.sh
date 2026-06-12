#!/bin/bash

# Planetary Agents - Docker Monitoring Script
# Comprehensive monitoring and management utilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
DEV_COMPOSE_FILE="docker-compose.dev.yml"

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

log_header() {
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}$(echo "$1" | sed 's/./=/g')${NC}"
}

# Show help
show_help() {
    echo "🌟 Planetary Agents - Docker Monitoring & Management"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  status      Show service status and health"
    echo "  logs        View and follow logs"
    echo "  stats       Show resource usage statistics"
    echo "  health      Perform comprehensive health checks"
    echo "  restart     Restart specific services"
    echo "  scale       Scale services up/down"
    echo "  backup      Backup database and volumes"
    echo "  restore     Restore from backup"
    echo "  cleanup     Clean up unused containers and images"
    echo "  shell       Access service shell"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 logs frontend"
    echo "  $0 scale frontend 3"
    echo "  $0 restart backend"
}

# Show service status
show_status() {
    log_header "Service Status"

    if [ -f "$COMPOSE_FILE" ] && docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        echo "Production Services:"
        docker-compose -f "$COMPOSE_FILE" ps
        echo ""
    fi

    if [ -f "$DEV_COMPOSE_FILE" ] && docker-compose -f "$DEV_COMPOSE_FILE" ps | grep -q "Up"; then
        echo "Development Services:"
        docker-compose -f "$DEV_COMPOSE_FILE" ps
        echo ""
    fi

    log_header "Container Health"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "label=com.docker.compose.project=planetary-agents"
}

# View logs
view_logs() {
    local service=${1:-""}
    local compose_file="$COMPOSE_FILE"

    # Check if development environment is running
    if [ -f "$DEV_COMPOSE_FILE" ] && docker-compose -f "$DEV_COMPOSE_FILE" ps | grep -q "Up"; then
        compose_file="$DEV_COMPOSE_FILE"
        log_info "Using development environment"
    fi

    if [ -n "$service" ]; then
        log_info "Showing logs for service: $service"
        docker-compose -f "$compose_file" logs -f --tail=100 "$service"
    else
        log_info "Showing logs for all services (Ctrl+C to stop)"
        docker-compose -f "$compose_file" logs -f --tail=50
    fi
}

# Show resource statistics
show_stats() {
    log_header "Resource Usage Statistics"

    echo "Container Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" \
        $(docker ps -q --filter "label=com.docker.compose.project=planetary-agents")

    echo ""
    echo "Docker System Information:"
    docker system df

    echo ""
    echo "Volume Usage:"
    docker volume ls --filter "name=planetary" --format "table {{.Name}}\t{{.Driver}}\t{{.Mountpoint}}"
}

# Comprehensive health check
health_check() {
    log_header "Comprehensive Health Check"

    local compose_file="$COMPOSE_FILE"
    local healthy=true

    # Determine which environment is running
    if [ -f "$DEV_COMPOSE_FILE" ] && docker-compose -f "$DEV_COMPOSE_FILE" ps | grep -q "Up"; then
        compose_file="$DEV_COMPOSE_FILE"
        log_info "Checking development environment"
    else
        log_info "Checking production environment"
    fi

    # Check container health
    log_info "Checking container health..."
    local containers=$(docker-compose -f "$compose_file" ps -q)

    for container in $containers; do
        local name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/\///')
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-healthcheck")
        local status=$(docker inspect --format='{{.State.Status}}' "$container")

        if [ "$status" = "running" ]; then
            if [ "$health" = "healthy" ] || [ "$health" = "no-healthcheck" ]; then
                log_success "✓ $name is running and healthy"
            else
                log_error "✗ $name is running but unhealthy ($health)"
                healthy=false
            fi
        else
            log_error "✗ $name is not running ($status)"
            healthy=false
        fi
    done

    # Check service endpoints
    log_info "Checking service endpoints..."

    # Check backend
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        log_success "✓ Backend API is responding"
    else
        log_error "✗ Backend API is not responding"
        healthy=false
    fi

    # Check frontend
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        log_success "✓ Frontend is responding"
    else
        log_error "✗ Frontend is not responding"
        healthy=false
    fi

    # Check database connectivity
    if docker-compose -f "$compose_file" exec -T postgres pg_isready > /dev/null 2>&1 || \
       docker-compose -f "$compose_file" exec -T postgres-dev pg_isready > /dev/null 2>&1; then
        log_success "✓ Database is accessible"
    else
        log_error "✗ Database is not accessible"
        healthy=false
    fi

    # Check Redis connectivity
    if docker-compose -f "$compose_file" exec -T redis redis-cli ping | grep -q PONG || \
       docker-compose -f "$compose_file" exec -T redis-dev redis-cli ping | grep -q PONG; then
        log_success "✓ Redis is accessible"
    else
        log_error "✗ Redis is not accessible"
        healthy=false
    fi

    echo ""
    if [ "$healthy" = true ]; then
        log_success "🎉 All health checks passed!"
    else
        log_error "❌ Some health checks failed. Check the logs for details."
        return 1
    fi
}

# Restart services
restart_service() {
    local service=${1:-""}
    local compose_file="$COMPOSE_FILE"

    if [ -f "$DEV_COMPOSE_FILE" ] && docker-compose -f "$DEV_COMPOSE_FILE" ps | grep -q "Up"; then
        compose_file="$DEV_COMPOSE_FILE"
    fi

    if [ -n "$service" ]; then
        log_info "Restarting service: $service"
        docker-compose -f "$compose_file" restart "$service"
        log_success "Service $service restarted"
    else
        log_info "Restarting all services"
        docker-compose -f "$compose_file" restart
        log_success "All services restarted"
    fi
}

# Scale services
scale_service() {
    local service="$1"
    local replicas="$2"
    local compose_file="$COMPOSE_FILE"

    if [ -z "$service" ] || [ -z "$replicas" ]; then
        log_error "Usage: scale <service> <replicas>"
        return 1
    fi

    log_info "Scaling $service to $replicas replicas"
    docker-compose -f "$compose_file" up -d --scale "$service=$replicas"
    log_success "Service $service scaled to $replicas replicas"
}

# Cleanup unused resources
cleanup_docker() {
    log_header "Docker Cleanup"

    read -p "This will remove unused containers, networks, and images. Continue? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up unused Docker resources..."

        # Remove stopped containers
        docker container prune -f

        # Remove unused networks
        docker network prune -f

        # Remove unused images
        docker image prune -f

        # Remove unused volumes (be careful with this)
        read -p "Also remove unused volumes? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker volume prune -f
        fi

        log_success "Docker cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# Access service shell
access_shell() {
    local service=${1:-"frontend"}
    local compose_file="$COMPOSE_FILE"

    if [ -f "$DEV_COMPOSE_FILE" ] && docker-compose -f "$DEV_COMPOSE_FILE" ps | grep -q "Up"; then
        compose_file="$DEV_COMPOSE_FILE"
        service="${service}-dev"
    fi

    log_info "Accessing shell for service: $service"
    docker-compose -f "$compose_file" exec "$service" sh
}

# Main command dispatcher
case "$1" in
    status)
        show_status
        ;;
    logs)
        view_logs "$2"
        ;;
    stats)
        show_stats
        ;;
    health)
        health_check
        ;;
    restart)
        restart_service "$2"
        ;;
    scale)
        scale_service "$2" "$3"
        ;;
    cleanup)
        cleanup_docker
        ;;
    shell)
        access_shell "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "$1" ]; then
            show_status
        else
            log_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
        fi
        ;;
esac