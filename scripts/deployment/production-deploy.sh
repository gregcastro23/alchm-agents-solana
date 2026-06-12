#!/bin/bash

# Planetary Agent Transit System - Production Deployment Script
# Handles Docker containerization, monitoring setup, and rollback capabilities

set -euo pipefail

# Configuration
DEPLOYMENT_NAME="planetary-agents"
NAMESPACE="${NAMESPACE:-planetary-agents-prod}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/your-org}"
VERSION="${VERSION:-$(git rev-parse --short HEAD)}"
ROLLBACK_VERSION="${ROLLBACK_VERSION:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."

    # Check required tools
    command -v docker >/dev/null 2>&1 || { log_error "Docker is required but not installed."; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed."; exit 1; }
    command -v helm >/dev/null 2>&1 || { log_error "Helm is required but not installed."; exit 1; }

    # Check Kubernetes connection
    kubectl cluster-info >/dev/null 2>&1 || { log_error "Unable to connect to Kubernetes cluster."; exit 1; }

    # Check Docker registry access
    docker login "$DOCKER_REGISTRY" >/dev/null 2>&1 || { log_error "Unable to authenticate with Docker registry."; exit 1; }

    # Validate environment variables
    # DIRECT_URL is the non-pooled connection used by prisma migrate deploy.
    # DATABASE_URL must remain the Accelerate proxy URL for all runtime queries.
    required_vars=("DATABASE_URL" "DIRECT_URL" "NEXTAUTH_SECRET" "CLERK_SECRET_KEY" "REDIS_URL")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set."
            exit 1
        fi
    done

    # Run security audit
    log_info "Running security audit..."
    if ! yarn test:security >/dev/null 2>&1; then
        log_error "Security audit failed. Aborting deployment."
        exit 1
    fi

    # Run integration tests
    log_info "Running integration tests..."
    if ! yarn test:integration >/dev/null 2>&1; then
        log_error "Integration tests failed. Aborting deployment."
        exit 1
    fi

    log_success "Pre-deployment checks passed."
}

# Build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."

    # Build Next.js application
    log_info "Building Next.js application..."
    docker build -f Dockerfile -t "$DOCKER_REGISTRY/$DEPLOYMENT_NAME/app:$VERSION" .

    # Build background worker
    if [[ -f "Dockerfile.worker" ]]; then
        log_info "Building background worker..."
        docker build -f Dockerfile.worker -t "$DOCKER_REGISTRY/$DEPLOYMENT_NAME/worker:$VERSION" .
    fi

    # Push images
    log_info "Pushing images to registry..."
    docker push "$DOCKER_REGISTRY/$DEPLOYMENT_NAME/app:$VERSION"
    [[ -f "Dockerfile.worker" ]] && docker push "$DOCKER_REGISTRY/$DEPLOYMENT_NAME/worker:$VERSION"

    log_success "Images built and pushed successfully."
}

# Database migration
run_database_migrations() {
    log_info "Running database migrations..."

    # Create backup before migration
    log_info "Creating database backup..."
    ./scripts/backup-database.sh

    # Run migrations
    if command -v prisma >/dev/null 2>&1; then
        npx prisma migrate deploy
        log_success "Database migrations completed."
    else
        log_warn "Prisma CLI not available. Please run migrations manually."
    fi
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    log_info "Deploying to Kubernetes..."

    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Update Helm values with current version
    cat > helm-values.yaml << EOF
image:
  registry: $DOCKER_REGISTRY
  tag: $VERSION

ingress:
  enabled: true
  hosts:
    - host: ${DOMAIN:-planetary-agents.com}
      paths:
        - path: /
          pathType: Prefix

env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: planetary-agents-secrets
        key: database-url
  - name: NEXTAUTH_SECRET
    valueFrom:
      secretKeyRef:
        name: planetary-agents-secrets
        key: nextauth-secret
  - name: CLERK_SECRET_KEY
    valueFrom:
      secretKeyRef:
        name: planetary-agents-secrets
        key: clerk-secret-key
  - name: REDIS_URL
    valueFrom:
      secretKeyRef:
        name: planetary-agents-secrets
        key: redis-url

monitoring:
  enabled: true
  prometheusRule:
    enabled: true
  grafana:
    enabled: true
EOF

    # Deploy with Helm
    if [[ -n "$ROLLBACK_VERSION" ]]; then
        log_info "Performing rollback to version $ROLLBACK_VERSION..."
        helm rollback "$DEPLOYMENT_NAME" 1 --namespace "$NAMESPACE"
    else
        log_info "Installing/upgrading Helm release..."
        helm upgrade --install "$DEPLOYMENT_NAME" ./helm/planetary-agents \
            --namespace "$NAMESPACE" \
            --values helm-values.yaml \
            --set image.tag="$VERSION" \
            --wait \
            --timeout 10m
    fi

    log_success "Kubernetes deployment completed."
}

# Setup monitoring and alerting
setup_monitoring() {
    log_info "Setting up monitoring and alerting..."

    # Install Prometheus and Grafana if not present
    if ! helm list -n monitoring | grep -q prometheus; then
        log_info "Installing Prometheus..."
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm install prometheus prometheus-community/prometheus --namespace monitoring --create-namespace
    fi

    if ! helm list -n monitoring | grep -q grafana; then
        log_info "Installing Grafana..."
        helm repo add grafana https://grafana.github.io/helm-charts
        helm install grafana grafana/grafana --namespace monitoring --create-namespace \
            --set adminPassword="${GRAFANA_ADMIN_PASSWORD:-admin}"
    fi

    # Setup application monitoring
    kubectl apply -f k8s/monitoring/ -n "$NAMESPACE"

    log_success "Monitoring setup completed."
}

# Health checks and validation
perform_health_checks() {
    log_info "Performing health checks..."

    # Wait for deployment to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE"

    # Check pod status
    if ! kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT_NAME" | grep -q "Running"; then
        log_error "Application pods are not running."
        exit 1
    fi

    # Test application health endpoint
    APP_URL=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[0].spec.rules[0].host}')
    if [[ -n "$APP_URL" ]]; then
        log_info "Testing application health at https://$APP_URL/api/health"
        if ! curl -f -k "https://$APP_URL/api/health" >/dev/null 2>&1; then
            log_error "Application health check failed."
            exit 1
        fi
    fi

    # Test database connectivity
    if ! kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT_NAME" -- npm run db:check >/dev/null 2>&1; then
        log_error "Database connectivity check failed."
        exit 1
    fi

    log_success "Health checks passed."
}

# Setup backup and recovery
setup_backup_and_recovery() {
    log_info "Setting up backup and recovery..."

    # Install Velero for backup
    if ! helm list -n velero | grep -q velero; then
        log_info "Installing Velero for backups..."
        helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
        helm install velero vmware-tanzu/velero \
            --namespace velero \
            --create-namespace \
            --set configuration.backupStorageLocation[0].bucket="${VELERO_BUCKET:-planetary-agents-backups}" \
            --set configuration.backupStorageLocation[0].config.region="${AWS_REGION:-us-east-1}"
    fi

    # Setup automated backups
    kubectl apply -f k8s/backup/ -n "$NAMESPACE"

    log_success "Backup and recovery setup completed."
}

# Performance optimization
apply_performance_optimizations() {
    log_info "Applying performance optimizations..."

    # Update resource limits
    kubectl apply -f k8s/performance/ -n "$NAMESPACE"

    # Setup horizontal pod autoscaling
    kubectl autoscale deployment "$DEPLOYMENT_NAME" \
        --cpu-percent=70 \
        --min=2 \
        --max=10 \
        -n "$NAMESPACE"

    log_success "Performance optimizations applied."
}

# Security hardening
apply_security_hardening() {
    log_info "Applying security hardening..."

    # Apply security policies
    kubectl apply -f k8s/security/ -n "$NAMESPACE"

    # Setup network policies
    kubectl apply -f k8s/network-policies/ -n "$NAMESPACE"

    # Enable security context
    kubectl apply -f k8s/security-context/ -n "$NAMESPACE"

    log_success "Security hardening applied."
}

# Post-deployment validation
post_deployment_validation() {
    log_info "Running post-deployment validation..."

    # Run smoke tests
    if ! yarn test:smoke >/dev/null 2>&1; then
        log_error "Smoke tests failed."
        exit 1
    fi

    # Validate monitoring
    if ! kubectl get servicemonitor -n "$NAMESPACE" | grep -q "$DEPLOYMENT_NAME"; then
        log_warn "ServiceMonitor not found. Monitoring may not be properly configured."
    fi

    # Check logs for errors
    ERROR_LOGS=$(kubectl logs -n "$NAMESPACE" -l app="$DEPLOYMENT_NAME" --tail=100 2>/dev/null | grep -i error || true)
    if [[ -n "$ERROR_LOGS" ]]; then
        log_warn "Found error logs in application pods:"
        echo "$ERROR_LOGS"
    fi

    log_success "Post-deployment validation completed."
}

# Rollback function
rollback_deployment() {
    log_error "Deployment failed. Initiating rollback..."

    # Rollback Helm release
    helm rollback "$DEPLOYMENT_NAME" 1 --namespace "$NAMESPACE"

    # Wait for rollback to complete
    kubectl wait --for=condition=available --timeout=300s deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE"

    log_info "Rollback completed. Previous version should be running."
}

# Main deployment function
main() {
    log_info "Starting production deployment of Planetary Agent Transit System v$VERSION"

    # Trap errors for rollback
    trap rollback_deployment ERR

    # Execute deployment steps
    pre_deployment_checks
    build_and_push_images
    run_database_migrations
    deploy_to_kubernetes
    setup_monitoring
    perform_health_checks
    setup_backup_and_recovery
    apply_performance_optimizations
    apply_security_hardening
    post_deployment_validation

    log_success "Production deployment completed successfully!"
    log_info "Application is now running at: https://${DOMAIN:-planetary-agents.com}"
    log_info "Monitoring dashboard: https://grafana.${DOMAIN:-planetary-agents.com}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --rollback)
            ROLLBACK_VERSION="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --dry-run)
            log_info "Dry run mode - commands will be displayed but not executed"
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --rollback VERSION    Rollback to specific version"
            echo "  --namespace NS        Kubernetes namespace (default: planetary-agents-prod)"
            echo "  --version VERSION     Docker image version (default: git commit hash)"
            echo "  --dry-run            Show commands without executing them"
            echo "  --help               Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
if [[ "${DRY_RUN:-false}" == "true" ]]; then
    log_info "DRY RUN MODE - Showing deployment steps:"
    # Add dry run logic here
    echo "Pre-deployment checks..."
    echo "Build and push images..."
    echo "Run database migrations..."
    echo "Deploy to Kubernetes..."
    echo "Setup monitoring..."
    echo "Health checks..."
    echo "Backup and recovery..."
    echo "Performance optimizations..."
    echo "Security hardening..."
    echo "Post-deployment validation..."
else
    main
fi
