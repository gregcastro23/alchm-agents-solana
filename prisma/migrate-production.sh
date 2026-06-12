#!/bin/bash
set -e

echo "🔄 Running Prisma production migration..."
export DATABASE_URL="postgres://6bb60f3551cd58c1d30af9fc9c4b3ab972fb9e8fcf747c33847cab1be9bb335c:sk_hslIpQhztLsaV6Bev8Vsh@db.prisma.io:5432/postgres?sslmode=require"

npx prisma migrate deploy

echo "✅ Production database migration complete!"
