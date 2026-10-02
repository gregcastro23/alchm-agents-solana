-- Recorded schema change. This repository provisions environments with prisma db push.
CREATE TABLE "council_daily_editions" (
  "id" TEXT NOT NULL,
  "editionId" TEXT,
  "day" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'generating',
  "payload" JSONB,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "council_daily_editions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "council_daily_editions_editionId_key" ON "council_daily_editions"("editionId");
CREATE INDEX "council_daily_editions_status_day_idx" ON "council_daily_editions"("status", "day");
