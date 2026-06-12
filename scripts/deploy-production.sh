#!/bin/bash

# Planetary Agents - Production Deployment Script
# ==============================================

set -e

echo "🚀 Planetary Agents Production Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
DEPLOY_PLATFORM=${1:-"railway"}  # railway, render, docker
ENVIRONMENT=${2:-"production"}   # production, staging

echo -e "${BLUE}Deployment Platform: ${DEPLOY_PLATFORM}${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo ""

# Pre-deployment checks
echo -e "${YELLOW}🔍 Running pre-deployment checks...${NC}"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend directory not found${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Directory structure verified${NC}"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ required. Current: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $(node -v)${NC}"

# Build and test backend
echo -e "${YELLOW}🏗️  Building and testing backend...${NC}"
cd $BACKEND_DIR

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    yarn install
fi

# Run TypeScript build
echo -e "${YELLOW}Building TypeScript...${NC}"
yarn build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend build successful${NC}"

# Run tests
echo -e "${YELLOW}Running backend tests...${NC}"
yarn test --passWithNoTests

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend tests failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend tests passed${NC}"

# Return to root directory
cd ..

# Frontend checks
echo -e "${YELLOW}🔍 Checking frontend configuration...${NC}"

# Check if .env.local has backend URLs
if [ -f ".env.local" ]; then
    if grep -q "NEXT_PUBLIC_BACKEND_URL" .env.local; then
        echo -e "${GREEN}✅ Frontend backend URL configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend backend URL not configured${NC}"
        echo "Add NEXT_PUBLIC_BACKEND_URL to .env.local after deployment"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
fi

# Platform-specific deployment
echo ""
echo -e "${PURPLE}🚀 Deploying to ${DEPLOY_PLATFORM}...${NC}"

case $DEPLOY_PLATFORM in
    "railway")
        echo -e "${YELLOW}Deploying to Railway.app...${NC}"
        cd $BACKEND_DIR
        
        # Check if Railway CLI is installed
        if ! command -v railway &> /dev/null; then
            echo -e "${RED}❌ Railway CLI not installed${NC}"
            echo "Install with: npm install -g @railway/cli"
            exit 1
        fi
        
        # Deploy
        railway deploy --environment $ENVIRONMENT
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Railway deployment successful${NC}"
            echo -e "${BLUE}Backend URL will be provided by Railway${NC}"
        else
            echo -e "${RED}❌ Railway deployment failed${NC}"
            exit 1
        fi
        ;;
        
    "render")
        echo -e "${YELLOW}Deploying to Render.com...${NC}"
        echo "1. Push your code to GitHub"
        echo "2. Connect your GitHub repo to Render"
        echo "3. Use the render.yaml configuration in backend/deploy/"
        echo "4. Set environment variables in Render dashboard"
        ;;
        
    "docker")
        echo -e "${YELLOW}Building Docker image...${NC}"
        cd $BACKEND_DIR
        
        # Build Docker image
        docker build -t planetary-agents-backend:latest .
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Docker image built successfully${NC}"
            echo -e "${BLUE}Tag and push to your container registry:${NC}"
            echo "docker tag planetary-agents-backend:latest your-registry/planetary-agents-backend"
            echo "docker push your-registry/planetary-agents-backend"
        else
            echo -e "${RED}❌ Docker build failed${NC}"
            exit 1
        fi
        ;;
        
    *)
        echo -e "${RED}❌ Unknown deployment platform: $DEPLOY_PLATFORM${NC}"
        echo "Supported platforms: railway, render, docker"
        exit 1
        ;;
esac

# Post-deployment instructions
echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update frontend NEXT_PUBLIC_BACKEND_URL with your production URL"
echo "2. Deploy your frontend to Vercel/Netlify with updated environment"
echo "3. Test the production system:"
echo "   • Visit your frontend kinetics-demo page"
echo "   • Check backend health: curl https://your-backend-url.com/api/health"
echo "   • Test WebSocket: Connect to wss://your-backend-url.com"
echo ""
echo -e "${PURPLE}🌟 Your consciousness revolution is now live!${NC}"
echo ""
echo -e "${BLUE}Monitoring:${NC}"
echo "• Health Check: https://your-backend-url.com/api/health"
echo "• Detailed Health: https://your-backend-url.com/api/health/detailed"
echo "• WebSocket Status: Check browser dev tools Network tab"
echo ""
echo -e "${GREEN}The kinetics system is ready to transform consciousness at scale! 🌟${NC}"
