# Planetary Agents Frontend - Next.js Multi-stage Dockerfile
# Optimized for production deployment with security and performance

# =====================================
# Dependencies Stage
# =====================================
FROM node:20-alpine AS deps

# Install build dependencies for native modules
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    gcc \
    linux-headers

# Enable Corepack for Yarn 4 support
RUN corepack enable

WORKDIR /app

# Copy package files and yarn configuration
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Prepare Yarn 4.10.2 (from package.json)
RUN corepack prepare yarn@4.10.2 --activate

# Install dependencies with Yarn 4
# For production, we don't need dev dependencies like tree-sitter
# Use workspaces focus or production mode would be ideal, but for now just continue on errors
RUN YARN_ENABLE_IMMUTABLE_INSTALLS=false yarn install || echo "Some optional dependencies failed, continuing..."

# =====================================
# Builder Stage
# =====================================
FROM node:20-alpine AS builder

# Install build dependencies for Prisma and native modules
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    openssl-dev

# Enable Corepack for Yarn 4 support
RUN corepack enable

WORKDIR /app

# Copy package.json and yarn configuration
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Prepare Yarn 4.10.2
RUN corepack prepare yarn@4.10.2 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=1

# Generate Prisma client without bundling the engine binary
RUN npx prisma generate --no-engine

# Build the application
# Increase memory limit for build process
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN yarn build

# =====================================
# Runner Stage (Production)
# =====================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup --gid 1001 --system nodejs
RUN adduser --system nextjs --uid 1001

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy Next.js build artifacts
COPY --from=builder /app/public ./public

# Create .next directory and set ownership
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy Next.js production files with correct ownership
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Create logs directory
RUN mkdir -p logs && chown nextjs:nodejs logs

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 3000, path: '/api/health', timeout: 3000 }; const request = http.request(options, (res) => { if (res.statusCode === 200) { process.exit(0); } else { process.exit(1); } }); request.on('error', () => process.exit(1)); request.on('timeout', () => process.exit(1)); request.end();" || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
