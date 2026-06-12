#!/bin/bash
# =============================================================================
# Planetary Agents - Production Database Migration Script
# =============================================================================
# This script helps migrate your Prisma schema to production database
#
# Usage:
#   ./scripts/migrate-production-db.sh
#
# Prerequisites:
#   1. Set up Vercel Postgres, Supabase, or Neon database
#   2. Add DATABASE_URL to Vercel environment variables
#   3. Pull env vars: vercel env pull .env.vercel
# =============================================================================

set -e

echo "🗄️  Planetary Agents - Production Database Migration"
echo "=================================================="
echo ""

# Check if .env.vercel exists
if [ ! -f .env.vercel ]; then
  echo "⚠️  .env.vercel not found!"
  echo "📥 Pulling environment variables from Vercel..."
  vercel env pull .env.vercel
  echo ""
fi

# Check required env vars
if grep -q "DATABASE_URL=" .env.vercel 2>/dev/null; then
  echo "✅ DATABASE_URL found in .env.vercel"
else
  echo "❌ DATABASE_URL not found in .env.vercel"
  echo ""
  echo "Please add DATABASE_URL to your Vercel project:"
  echo "1. Go to: https://vercel.com/dashboard"
  echo "2. Select project: planetary-agents"
  echo "3. Go to: Settings → Environment Variables"
  echo "4. Add: DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/..."
  echo ""
  exit 1
fi

if grep -q "DIRECT_URL=" .env.vercel 2>/dev/null; then
  echo "✅ DIRECT_URL found in .env.vercel"
else
  echo "❌ DIRECT_URL not found in .env.vercel"
  echo ""
  echo "DIRECT_URL is required for migrations (prisma migrate deploy bypasses the Accelerate proxy)."
  echo "Add it to your Vercel project:"
  echo "1. Go to: https://vercel.com/dashboard"
  echo "2. Select project: planetary-agents"
  echo "3. Go to: Settings → Environment Variables"
  echo "4. Add: DIRECT_URL=postgresql://user:pass@host:5432/dbname"
  echo "   (Get the direct connection string from console.prisma.io → your project → Connection string)"
  echo ""
  echo "⚠️  Keep DIRECT_URL out of runtime services — it bypasses Accelerate's connection pooler."
  echo "   Runtime queries must use DATABASE_URL (the prisma+postgres:// URL)."
  echo ""
  exit 1
fi

echo ""
echo "🔍 Checking Prisma schema..."
if [ ! -f prisma/schema.prisma ]; then
  echo "❌ prisma/schema.prisma not found!"
  exit 1
fi
echo "✅ Prisma schema found"

echo ""
echo "📊 Current local database info:"
echo "   Host: localhost:5433"
echo "   Database: planetary_agents"
echo "   User: planetary"
echo ""

read -p "🚀 Ready to migrate production database? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Migration cancelled"
  exit 0
fi

echo ""
echo "🔧 Generating Prisma Client..."
npx prisma generate

echo ""
echo "📤 Pushing schema to production database..."
echo "   (Using DATABASE_URL from .env.vercel)"

# Use .env.vercel for the migration
export $(grep -v '^#' .env.vercel | xargs)

# Deploy migrations
npx prisma migrate deploy

echo ""
echo "✅ Production database migration complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify tables in production database"
echo "   2. Seed initial data (if needed)"
echo "   3. Deploy to Vercel: git push origin main"
echo ""
echo "🔍 To check production database:"
echo "   npx prisma studio --schema=./prisma/schema.prisma"
echo ""
