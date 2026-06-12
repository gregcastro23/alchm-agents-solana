-- CreateTable
CREATE TABLE "agent_consciousness" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consciousnessLevel" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "stats" JSONB,
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvolution" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_consciousness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_queries" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "queryLength" INTEGER NOT NULL,
    "ragUsed" BOOLEAN NOT NULL,
    "sourcesRetrieved" INTEGER NOT NULL,
    "retrievalTime" INTEGER NOT NULL,
    "generationTime" INTEGER,
    "totalTime" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "relevanceScores" JSONB NOT NULL,
    "avgRelevance" DOUBLE PRECISION NOT NULL,
    "modelUsed" TEXT,
    "temperature" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "rag_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_sources" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "era" TEXT,
    "category" TEXT,
    "tags" JSONB,
    "metadata" JSONB,

    CONSTRAINT "rag_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_feedback" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queryId" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "thumbsUp" BOOLEAN,
    "starRating" INTEGER,
    "sourcesHelpful" BOOLEAN,
    "comment" TEXT,

    CONSTRAINT "rag_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_consciousness_agentId_idx" ON "agent_consciousness"("agentId");

-- CreateIndex
CREATE INDEX "agent_consciousness_userId_idx" ON "agent_consciousness"("userId");

-- CreateIndex
CREATE INDEX "agent_consciousness_consciousnessLevel_idx" ON "agent_consciousness"("consciousnessLevel");

-- CreateIndex
CREATE UNIQUE INDEX "agent_consciousness_agentId_userId_key" ON "agent_consciousness"("agentId", "userId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "rag_queries_agentId_idx" ON "rag_queries"("agentId");

-- CreateIndex
CREATE INDEX "rag_queries_timestamp_idx" ON "rag_queries"("timestamp");

-- CreateIndex
CREATE INDEX "rag_queries_sessionId_idx" ON "rag_queries"("sessionId");

-- CreateIndex
CREATE INDEX "rag_queries_userId_idx" ON "rag_queries"("userId");

-- CreateIndex
CREATE INDEX "rag_queries_ragUsed_idx" ON "rag_queries"("ragUsed");

-- CreateIndex
CREATE INDEX "rag_queries_success_idx" ON "rag_queries"("success");

-- CreateIndex
CREATE INDEX "rag_queries_agentId_timestamp_idx" ON "rag_queries"("agentId", "timestamp");

-- CreateIndex
CREATE INDEX "rag_queries_userId_agentId_idx" ON "rag_queries"("userId", "agentId");

-- CreateIndex
CREATE INDEX "rag_sources_queryId_idx" ON "rag_sources"("queryId");

-- CreateIndex
CREATE INDEX "rag_sources_documentId_idx" ON "rag_sources"("documentId");

-- CreateIndex
CREATE INDEX "rag_sources_agentId_idx" ON "rag_sources"("agentId");

-- CreateIndex
CREATE INDEX "rag_sources_relevanceScore_idx" ON "rag_sources"("relevanceScore");

-- CreateIndex
CREATE INDEX "rag_feedback_queryId_idx" ON "rag_feedback"("queryId");

-- CreateIndex
CREATE INDEX "rag_feedback_agentId_idx" ON "rag_feedback"("agentId");

-- CreateIndex
CREATE INDEX "rag_feedback_timestamp_idx" ON "rag_feedback"("timestamp");

-- CreateIndex
CREATE INDEX "rag_feedback_thumbsUp_idx" ON "rag_feedback"("thumbsUp");

-- CreateIndex
CREATE INDEX "rag_feedback_starRating_idx" ON "rag_feedback"("starRating");

-- AddForeignKey
ALTER TABLE "rag_sources" ADD CONSTRAINT "rag_sources_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "rag_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_feedback" ADD CONSTRAINT "rag_feedback_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "rag_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
