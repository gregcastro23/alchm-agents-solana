-- CreateTable
CREATE TABLE "consciousness_snapshots" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "interactionCount" INTEGER NOT NULL,
    "chatQuality" DOUBLE PRECISION NOT NULL,
    "momentResonance" DOUBLE PRECISION NOT NULL,
    "alchemicalCoherence" DOUBLE PRECISION NOT NULL,
    "power" DOUBLE PRECISION NOT NULL,
    "resonance" DOUBLE PRECISION NOT NULL,
    "wisdom" DOUBLE PRECISION NOT NULL,
    "charisma" DOUBLE PRECISION NOT NULL,
    "intuition" DOUBLE PRECISION NOT NULL,
    "adaptability" DOUBLE PRECISION NOT NULL,
    "vitality" DOUBLE PRECISION NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "spirit" DOUBLE PRECISION NOT NULL,
    "essence" DOUBLE PRECISION NOT NULL,
    "matter" DOUBLE PRECISION NOT NULL,
    "substance" DOUBLE PRECISION NOT NULL,
    "aNumber" DOUBLE PRECISION NOT NULL,
    "heat" DOUBLE PRECISION NOT NULL,
    "entropy" DOUBLE PRECISION NOT NULL,
    "reactivity" DOUBLE PRECISION NOT NULL,
    "energy" DOUBLE PRECISION NOT NULL,
    "planetaryHour" TEXT NOT NULL,
    "moonPhase" TEXT NOT NULL,
    "activeModifiers" TEXT NOT NULL DEFAULT '[]',
    "specialStates" TEXT NOT NULL DEFAULT '[]',
    "consciousnessVelocity" DOUBLE PRECISION NOT NULL,
    "interactionMomentum" DOUBLE PRECISION NOT NULL,
    "evolutionTrajectory" TEXT NOT NULL,
    "powerLevelUnlocks" TEXT NOT NULL DEFAULT '[]',
    "actionCompletion" DOUBLE PRECISION NOT NULL,
    "toolSelectionQuality" DOUBLE PRECISION NOT NULL,
    "routingAccuracy" DOUBLE PRECISION NOT NULL,
    "contextRetention" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "userMessage" TEXT NOT NULL,
    "agentResponsePreview" TEXT NOT NULL,
    "responseQuality" DOUBLE PRECISION NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consciousness_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consciousness_snapshots_agentId_timestamp_idx" ON "consciousness_snapshots"("agentId", "timestamp");

-- CreateIndex
CREATE INDEX "consciousness_snapshots_userId_agentId_idx" ON "consciousness_snapshots"("userId", "agentId");

-- CreateIndex
CREATE INDEX "consciousness_snapshots_timestamp_idx" ON "consciousness_snapshots"("timestamp");

-- CreateIndex
CREATE INDEX "consciousness_snapshots_sessionId_idx" ON "consciousness_snapshots"("sessionId");

-- CreateIndex
CREATE INDEX "consciousness_snapshots_evolutionTrajectory_idx" ON "consciousness_snapshots"("evolutionTrajectory");

-- CreateIndex
CREATE INDEX "consciousness_snapshots_responseQuality_idx" ON "consciousness_snapshots"("responseQuality");

-- CreateIndex
CREATE INDEX "consciousness_snapshots_planetaryHour_idx" ON "consciousness_snapshots"("planetaryHour");

-- CreateIndex
CREATE INDEX "consciousness_snapshots_moonPhase_idx" ON "consciousness_snapshots"("moonPhase");
