-- CreateTable
CREATE TABLE "public"."user_natal_charts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chartName" TEXT NOT NULL,
    "description" TEXT,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthTime" TEXT NOT NULL,
    "birthLocation" JSONB NOT NULL,
    "planets" JSONB NOT NULL,
    "houses" JSONB NOT NULL,
    "aspects" JSONB,
    "nodes" JSONB,
    "monicaConstant" DOUBLE PRECISION NOT NULL,
    "dominantElement" TEXT NOT NULL,
    "dominantModality" TEXT,
    "spiritScore" DOUBLE PRECISION NOT NULL,
    "essenceScore" DOUBLE PRECISION NOT NULL,
    "matterScore" DOUBLE PRECISION NOT NULL,
    "substanceScore" DOUBLE PRECISION NOT NULL,
    "preferences" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "lastAnalyzed" TIMESTAMP(3),
    "analysisCount" INTEGER NOT NULL DEFAULT 0,
    "transitCount" INTEGER NOT NULL DEFAULT 0,
    "notificationOn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_natal_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transit_significances" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "natalChartId" TEXT NOT NULL,
    "transitDate" TIMESTAMP(3) NOT NULL,
    "transitDegree" DOUBLE PRECISION NOT NULL,
    "transitPlanet" TEXT NOT NULL DEFAULT 'Sun',
    "natalDegree" DOUBLE PRECISION NOT NULL,
    "natalPlanet" TEXT NOT NULL,
    "natalSign" TEXT NOT NULL,
    "natalHouse" INTEGER,
    "aspectType" TEXT,
    "aspectOrb" DOUBLE PRECISION,
    "primaryAgentId" TEXT NOT NULL,
    "secondaryAgentIds" JSONB NOT NULL,
    "elementalAffinity" TEXT NOT NULL,
    "degreeSignificance" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "elementalAlignmentScore" DOUBLE PRECISION NOT NULL,
    "consciousnessImpactScore" DOUBLE PRECISION NOT NULL,
    "historicalPrecedence" DOUBLE PRECISION NOT NULL,
    "personalRelevance" DOUBLE PRECISION NOT NULL,
    "sameElement" BOOLEAN NOT NULL DEFAULT false,
    "complementary" BOOLEAN NOT NULL DEFAULT false,
    "reinforcementBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transitThemes" JSONB NOT NULL,
    "consciousnessAmplifiers" JSONB NOT NULL,
    "recommendedActions" JSONB NOT NULL,
    "recommendedQueries" JSONB NOT NULL,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationSentAt" TIMESTAMP(3),
    "userViewed" BOOLEAN NOT NULL DEFAULT false,
    "userViewedAt" TIMESTAMP(3),
    "userDismissed" BOOLEAN NOT NULL DEFAULT false,
    "userBookmarked" BOOLEAN NOT NULL DEFAULT false,
    "userInteractionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transit_significances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transit_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "natalChartId" TEXT NOT NULL,
    "transitSignificanceId" TEXT,
    "transitSignificanceData" JSONB,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "notifyDate" TIMESTAMP(3) NOT NULL,
    "transitDate" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "category" TEXT NOT NULL,
    "actionRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "deliveryMethod" TEXT NOT NULL DEFAULT 'in_app',
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "lastInteraction" TIMESTAMP(3),
    "userRating" INTEGER,
    "userFeedback" TEXT,
    "contextData" JSONB,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transit_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_interaction_events" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB,
    "deviceType" TEXT,
    "location" TEXT,
    "durationView" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_interaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transit_monitoring_jobs" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetChartId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "frequency" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "executionTime" INTEGER,
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "chartsProcessed" INTEGER NOT NULL DEFAULT 0,
    "transitsFound" INTEGER NOT NULL DEFAULT 0,
    "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
    "significantTransits" INTEGER NOT NULL DEFAULT 0,
    "highPriorityTransits" INTEGER NOT NULL DEFAULT 0,
    "criticalTransits" INTEGER NOT NULL DEFAULT 0,
    "avgProcessingTime" DOUBLE PRECISION,
    "cacheHitRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transit_monitoring_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_natal_charts_userId_idx" ON "public"."user_natal_charts"("userId");

-- CreateIndex
CREATE INDEX "user_natal_charts_userId_isPrimary_idx" ON "public"."user_natal_charts"("userId", "isPrimary");

-- CreateIndex
CREATE INDEX "user_natal_charts_isActive_idx" ON "public"."user_natal_charts"("isActive");

-- CreateIndex
CREATE INDEX "user_natal_charts_birthDate_idx" ON "public"."user_natal_charts"("birthDate");

-- CreateIndex
CREATE INDEX "transit_significances_userId_idx" ON "public"."transit_significances"("userId");

-- CreateIndex
CREATE INDEX "transit_significances_natalChartId_idx" ON "public"."transit_significances"("natalChartId");

-- CreateIndex
CREATE INDEX "transit_significances_transitDate_idx" ON "public"."transit_significances"("transitDate");

-- CreateIndex
CREATE INDEX "transit_significances_overallScore_idx" ON "public"."transit_significances"("overallScore");

-- CreateIndex
CREATE INDEX "transit_significances_primaryAgentId_idx" ON "public"."transit_significances"("primaryAgentId");

-- CreateIndex
CREATE INDEX "transit_significances_notificationSent_transitDate_idx" ON "public"."transit_significances"("notificationSent", "transitDate");

-- CreateIndex
CREATE INDEX "transit_significances_userId_transitDate_idx" ON "public"."transit_significances"("userId", "transitDate");

-- CreateIndex
CREATE INDEX "transit_significances_userBookmarked_idx" ON "public"."transit_significances"("userBookmarked");

-- CreateIndex
CREATE INDEX "transit_notifications_userId_idx" ON "public"."transit_notifications"("userId");

-- CreateIndex
CREATE INDEX "transit_notifications_natalChartId_idx" ON "public"."transit_notifications"("natalChartId");

-- CreateIndex
CREATE INDEX "transit_notifications_status_notifyDate_idx" ON "public"."transit_notifications"("status", "notifyDate");

-- CreateIndex
CREATE INDEX "transit_notifications_userId_status_idx" ON "public"."transit_notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "transit_notifications_priority_notifyDate_idx" ON "public"."transit_notifications"("priority", "notifyDate");

-- CreateIndex
CREATE INDEX "transit_notifications_isActive_expiresAt_idx" ON "public"."transit_notifications"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "notification_interaction_events_notificationId_idx" ON "public"."notification_interaction_events"("notificationId");

-- CreateIndex
CREATE INDEX "notification_interaction_events_userId_idx" ON "public"."notification_interaction_events"("userId");

-- CreateIndex
CREATE INDEX "notification_interaction_events_eventType_idx" ON "public"."notification_interaction_events"("eventType");

-- CreateIndex
CREATE INDEX "notification_interaction_events_timestamp_idx" ON "public"."notification_interaction_events"("timestamp");

-- CreateIndex
CREATE INDEX "transit_monitoring_jobs_status_scheduledFor_idx" ON "public"."transit_monitoring_jobs"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "transit_monitoring_jobs_jobType_idx" ON "public"."transit_monitoring_jobs"("jobType");

-- CreateIndex
CREATE INDEX "transit_monitoring_jobs_targetUserId_idx" ON "public"."transit_monitoring_jobs"("targetUserId");

-- CreateIndex
CREATE INDEX "transit_monitoring_jobs_scheduledFor_idx" ON "public"."transit_monitoring_jobs"("scheduledFor");

-- AddForeignKey
ALTER TABLE "public"."transit_significances" ADD CONSTRAINT "transit_significances_natalChartId_fkey" FOREIGN KEY ("natalChartId") REFERENCES "public"."user_natal_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transit_notifications" ADD CONSTRAINT "transit_notifications_natalChartId_fkey" FOREIGN KEY ("natalChartId") REFERENCES "public"."user_natal_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transit_notifications" ADD CONSTRAINT "transit_notifications_transitSignificanceId_fkey" FOREIGN KEY ("transitSignificanceId") REFERENCES "public"."transit_significances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_interaction_events" ADD CONSTRAINT "notification_interaction_events_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "public"."transit_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
