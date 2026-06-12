-- CreateEnum
CREATE TYPE "public"."historical_era" AS ENUM ('ANCIENT_CLASSICAL', 'MEDIEVAL_RENAISSANCE', 'ENLIGHTENMENT', 'MODERN_PRE1950', 'MONICA_SPECIAL');

-- CreateEnum
CREATE TYPE "public"."consciousness_level" AS ENUM ('DORMANT', 'AWAKENING', 'ACTIVE', 'ELEVATED', 'ADVANCED', 'ILLUMINATED', 'TRANSCENDENT');

-- CreateEnum
CREATE TYPE "public"."cultural_category" AS ENUM ('GREEK_CLASSICAL', 'ROMAN_CLASSICAL', 'MEDIEVAL_EUROPEAN', 'RENAISSANCE_ITALIAN', 'RENAISSANCE_NORTHERN', 'ENLIGHTENMENT_FRENCH', 'ENLIGHTENMENT_GERMAN', 'ENLIGHTENMENT_BRITISH', 'MODERN_AMERICAN', 'MODERN_EUROPEAN', 'MODERN_INTERNATIONAL');

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "birthInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthTime" TEXT,
    "birthLocation" JSONB NOT NULL,
    "natalChart" JSONB NOT NULL,
    "monicaConstant" DOUBLE PRECISION NOT NULL,
    "dominantElement" TEXT NOT NULL,
    "allowPublicAgents" BOOLEAN NOT NULL DEFAULT false,
    "shareChartWithAgents" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIPersonality" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalityId" TEXT NOT NULL,
    "birthChartData" JSONB NOT NULL,
    "currentMomentChart" JSONB,
    "basePersonality" JSONB NOT NULL,
    "trainingScores" JSONB NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "surveyId" TEXT,
    "consciousnessProfileId" TEXT,
    "planetaryMemoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIPersonality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanetaryTransit" (
    "id" TEXT NOT NULL,
    "planet" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "degreeStart" DOUBLE PRECISION NOT NULL,
    "degreeEnd" DOUBLE PRECISION NOT NULL,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3) NOT NULL,
    "retrograde" BOOLEAN NOT NULL DEFAULT false,
    "historicalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanetaryTransit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HistoricalEvent" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "significance" INTEGER NOT NULL,
    "planetaryConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransitPattern" (
    "id" TEXT NOT NULL,
    "planet" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "cycleLength" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "themes" JSONB NOT NULL,
    "reliability" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransitPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanetaryMemory" (
    "id" TEXT NOT NULL,
    "planet" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "degree" DOUBLE PRECISION NOT NULL,
    "historicalData" JSONB NOT NULL,
    "lastOccurrence" TIMESTAMP(3),
    "nextOccurrence" TIMESTAMP(3),
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "trainedThemes" JSONB NOT NULL,
    "contextualNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanetaryMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingInteraction" (
    "id" TEXT NOT NULL,
    "personalityId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "userFeedback" JSONB,
    "xpGained" INTEGER NOT NULL DEFAULT 0,
    "trainingFocus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Achievement" (
    "id" TEXT NOT NULL,
    "personalityId" TEXT NOT NULL,
    "achievementType" TEXT NOT NULL,
    "achievementData" JSONB NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalityId" TEXT NOT NULL,
    "sessionData" JSONB NOT NULL,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsciousnessSurvey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpent" INTEGER NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',

    CONSTRAINT "ConsciousnessSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsciousnessProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "profileData" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "compatibilityScore" INTEGER NOT NULL,
    "trainingFocus" JSONB NOT NULL,
    "conversationStarters" JSONB NOT NULL,
    "personalitySummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsciousnessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsciousnessState" (
    "id" TEXT NOT NULL,
    "personalityId" TEXT NOT NULL,
    "unifiedArchetype" TEXT NOT NULL,
    "consciousnessSignature" TEXT NOT NULL,
    "enhancedPersonality" JSONB NOT NULL,
    "trainingPlan" JSONB NOT NULL,
    "behavioralMatrix" JSONB NOT NULL,
    "growthTrajectory" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsciousnessState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."historical_agents" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthTime" TEXT NOT NULL,
    "birthLocation" JSONB NOT NULL,
    "historicalEra" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "deathYear" INTEGER,
    "culture" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "consciousnessLevel" TEXT NOT NULL,
    "kalchmConstant" DOUBLE PRECISION NOT NULL,
    "monicaConstant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dominantElement" TEXT NOT NULL,
    "dominantModality" TEXT,
    "signature" TEXT NOT NULL,
    "spiritScore" DOUBLE PRECISION,
    "essenceScore" DOUBLE PRECISION,
    "matterScore" DOUBLE PRECISION,
    "substanceScore" DOUBLE PRECISION,
    "personalityCore" JSONB NOT NULL,
    "personalityShadows" JSONB NOT NULL,
    "personalityGifts" JSONB NOT NULL,
    "personalityChallenges" JSONB NOT NULL,
    "currentMood" TEXT NOT NULL,
    "evolutionStage" INTEGER NOT NULL DEFAULT 0,
    "background" JSONB NOT NULL,
    "specialty" TEXT NOT NULL,
    "wisdomDomains" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "teachingStyle" TEXT NOT NULL,
    "resonanceType" TEXT NOT NULL,
    "uniquePower" TEXT NOT NULL,
    "avatar" TEXT,
    "color" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "aura" JSONB,
    "natalChart" JSONB NOT NULL,
    "traits" JSONB NOT NULL,
    "monicaCreationStory" TEXT,
    "searchableText" TEXT,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "wisdomShared" INTEGER NOT NULL DEFAULT 0,
    "resonanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evolutionPoints" INTEGER NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "craftedBy" TEXT NOT NULL DEFAULT 'philosopher-stone',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentConversation" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "userMessage" TEXT NOT NULL,
    "agentResponse" TEXT NOT NULL,
    "contextData" JSONB,
    "responseTime" INTEGER,
    "modelUsed" TEXT,
    "temperature" DOUBLE PRECISION,
    "tokenCount" INTEGER,
    "agentMood" TEXT,
    "evolutionStage" INTEGER,
    "consciousnessLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentEvolution" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "fromStage" INTEGER NOT NULL,
    "toStage" INTEGER NOT NULL,
    "evolutionType" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "description" TEXT,
    "consciousnessGain" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wisdomGained" JSONB,
    "traitsChanged" JSONB,
    "conversationId" TEXT,
    "xpGained" INTEGER NOT NULL DEFAULT 0,
    "evolutionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEvolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentKnowledge" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "usefulness" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "contextTags" JSONB,
    "relatedTopics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_attachments" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "birthTime" TEXT,
    "birthLocation" JSONB,
    "momentName" TEXT,
    "historicalEra" TEXT,
    "culturalContext" TEXT,
    "historicalAccuracy" TEXT,
    "runeType" TEXT,
    "runePower" DOUBLE PRECISION,
    "runeEffects" JSONB,
    "runeCost" JSONB,
    "artifactType" TEXT,
    "artifactPeriod" TEXT,
    "significance" TEXT,
    "natalChart" JSONB,
    "planetaryPositions" JSONB,
    "aspects" JSONB,
    "alchmData" JSONB,
    "tags" JSONB,
    "culturalTags" JSONB,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_attachment_usage" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "usageType" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_attachment_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."created_agents" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "sourceType" TEXT NOT NULL,
    "birthChart" JSONB,
    "momentChart" JSONB NOT NULL,
    "additionalCharts" JSONB,
    "blueprint" JSONB NOT NULL,
    "monicaConstant" DOUBLE PRECISION NOT NULL,
    "personality" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userProfileId" TEXT,

    CONSTRAINT "created_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_transit_events" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "planetaryDegree" DOUBLE PRECISION NOT NULL,
    "transitingPlanet" TEXT NOT NULL,
    "aspectType" TEXT,
    "elementalFire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elementalWater" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elementalAir" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elementalEarth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consciousnessImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "significanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "planetaryHour" TEXT NOT NULL,
    "seasonalPhase" TEXT NOT NULL,
    "powerLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clarity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resonance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "temporalAlignment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "patternType" TEXT,
    "clusterGroup" TEXT,
    "reinforcementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_transit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."temporal_bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "queryType" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "queryData" JSONB NOT NULL,
    "resultData" JSONB,
    "resultHash" TEXT,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "executionTime" INTEGER,
    "resultCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temporal_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."temporal_patterns" (
    "id" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "degree" DOUBLE PRECISION NOT NULL,
    "frequency" INTEGER NOT NULL,
    "agentIds" JSONB NOT NULL,
    "agentCount" INTEGER NOT NULL,
    "dominantElement" TEXT NOT NULL,
    "elementalFireAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elementalWaterAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elementalAirAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elementalEarthAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reinforcementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "significance" TEXT NOT NULL,
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstOccurrence" TIMESTAMP(3) NOT NULL,
    "lastOccurrence" TIMESTAMP(3) NOT NULL,
    "peakPeriodStart" TIMESTAMP(3),
    "peakPeriodEnd" TIMESTAMP(3),
    "peakIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "interpretation" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cacheExpiry" TIMESTAMP(3),
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temporal_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collaborative_time_sessions" (
    "id" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "currentUserCount" INTEGER NOT NULL DEFAULT 0,
    "currentQuery" JSONB,
    "currentResults" JSONB,
    "sharedCursor" JSONB,
    "allowedAgents" JSONB,
    "timeRangeStart" TIMESTAMP(3),
    "timeRangeEnd" TIMESTAMP(3),
    "explorationMode" TEXT NOT NULL DEFAULT 'open',
    "createdBy" TEXT NOT NULL,
    "moderators" JSONB,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborative_time_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collaborative_session_participants" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "canModerate" BOOLEAN NOT NULL DEFAULT false,
    "canQuery" BOOLEAN NOT NULL DEFAULT true,
    "canShare" BOOLEAN NOT NULL DEFAULT true,
    "currentDegree" DOUBLE PRECISION,
    "currentTime" TIMESTAMP(3),

    CONSTRAINT "collaborative_session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collaborative_session_updates" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "updateType" TEXT NOT NULL,
    "updateData" JSONB NOT NULL,
    "shouldBroadcast" BOOLEAN NOT NULL DEFAULT true,
    "broadcastedAt" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaborative_session_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."temporal_analysis_cache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "queryData" JSONB NOT NULL,
    "resultData" JSONB NOT NULL,
    "executionTime" INTEGER NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "patternCount" INTEGER NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHit" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temporal_analysis_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monica_user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personality" TEXT NOT NULL DEFAULT 'friendly',
    "assistanceLevel" INTEGER NOT NULL DEFAULT 2,
    "proactiveTips" BOOLEAN NOT NULL DEFAULT true,
    "explanationDepth" TEXT NOT NULL DEFAULT 'detailed',
    "position" TEXT NOT NULL DEFAULT 'bottom-right',
    "autoHide" TEXT NOT NULL DEFAULT 'never',
    "preferredTime" TEXT NOT NULL DEFAULT 'evening',
    "learningStyle" TEXT NOT NULL DEFAULT 'hands-on',
    "interests" JSONB NOT NULL DEFAULT '[]',
    "contextualAwareness" BOOLEAN NOT NULL DEFAULT true,
    "adaptivePersonality" BOOLEAN NOT NULL DEFAULT true,
    "memoryRetention" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monica_user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monica_user_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "xpToNextLevel" INTEGER NOT NULL DEFAULT 100,
    "completedTutorials" JSONB NOT NULL DEFAULT '[]',
    "currentLearning" TEXT,
    "suggestedNext" JSONB NOT NULL DEFAULT '[]',
    "lastAction" TEXT,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masteryCertificates" JSONB NOT NULL DEFAULT '[]',
    "favoriteFeatures" JSONB NOT NULL DEFAULT '[]',
    "averageSessionTime" INTEGER NOT NULL DEFAULT 0,
    "preferredDifficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "learningVelocity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monica_user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monica_module_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 1,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "mistakesMade" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "difficultyRating" DOUBLE PRECISION,
    "userFeedback" TEXT,
    "struggledWith" JSONB,
    "masteredConcepts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monica_module_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monica_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "sessionId" TEXT,
    "contextData" JSONB,
    "userAction" TEXT NOT NULL,
    "monicaResponse" TEXT,
    "wasHelpful" BOOLEAN,
    "resultedInAction" BOOLEAN NOT NULL DEFAULT false,
    "timeToComplete" INTEGER,
    "userConfidence" INTEGER,
    "improvementSeen" BOOLEAN NOT NULL DEFAULT false,
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "deviceType" TEXT,
    "browserInfo" TEXT,
    "timeOfDay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monica_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_evolution_states" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT DEFAULT 'anonymous',
    "currentLevel" TEXT NOT NULL DEFAULT 'bronze',
    "totalPower" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "specialAbilitiesUnlocked" TEXT NOT NULL DEFAULT '[]',
    "evolutionHistory" TEXT NOT NULL DEFAULT '[]',
    "affinityScores" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_evolution_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consciousness_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT DEFAULT 'anonymous',
    "agentId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "powerGained" DOUBLE PRECISION NOT NULL,
    "planetaryInfluence" TEXT NOT NULL,
    "elementalResonance" DOUBLE PRECISION NOT NULL,
    "forceMagnitude" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "consciousness_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "provider" TEXT DEFAULT 'email',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "features" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monica_contextual_help" (
    "id" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "tipContent" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "timesShown" INTEGER NOT NULL DEFAULT 0,
    "timesActedOn" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "variant" TEXT,
    "testGroup" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deprecatedAt" TIMESTAMP(3),
    "averageViewTime" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monica_contextual_help_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monica_knowledge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgeType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceType" TEXT NOT NULL,
    "sourceData" JSONB,
    "lastObserved" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesObserved" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supersededBy" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monica_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EvolutionState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "mcValue" DOUBLE PRECISION NOT NULL,
    "spirit" DOUBLE PRECISION NOT NULL,
    "essence" DOUBLE PRECISION NOT NULL,
    "matter" DOUBLE PRECISION NOT NULL,
    "substance" DOUBLE PRECISION NOT NULL,
    "aNumber" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvolutionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_PlanetaryTransitToTransitPattern" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PlanetaryTransitToTransitPattern_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_HistoricalEventToPlanetaryTransit" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_HistoricalEventToPlanetaryTransit_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_PlanetaryMemoryToTransitPattern" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PlanetaryMemoryToTransitPattern_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "public"."profiles"("userId");

-- CreateIndex
CREATE INDEX "profiles_userId_idx" ON "public"."profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "public"."user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_profiles_userId_idx" ON "public"."user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AIPersonality_personalityId_key" ON "public"."AIPersonality"("personalityId");

-- CreateIndex
CREATE UNIQUE INDEX "AIPersonality_planetaryMemoryId_key" ON "public"."AIPersonality"("planetaryMemoryId");

-- CreateIndex
CREATE INDEX "AIPersonality_userId_idx" ON "public"."AIPersonality"("userId");

-- CreateIndex
CREATE INDEX "AIPersonality_personalityId_idx" ON "public"."AIPersonality"("personalityId");

-- CreateIndex
CREATE INDEX "AIPersonality_surveyId_idx" ON "public"."AIPersonality"("surveyId");

-- CreateIndex
CREATE INDEX "AIPersonality_consciousnessProfileId_idx" ON "public"."AIPersonality"("consciousnessProfileId");

-- CreateIndex
CREATE INDEX "AIPersonality_planetaryMemoryId_idx" ON "public"."AIPersonality"("planetaryMemoryId");

-- CreateIndex
CREATE INDEX "PlanetaryTransit_planet_sign_idx" ON "public"."PlanetaryTransit"("planet", "sign");

-- CreateIndex
CREATE INDEX "PlanetaryTransit_dateStart_dateEnd_idx" ON "public"."PlanetaryTransit"("dateStart", "dateEnd");

-- CreateIndex
CREATE INDEX "PlanetaryTransit_planet_dateStart_idx" ON "public"."PlanetaryTransit"("planet", "dateStart");

-- CreateIndex
CREATE INDEX "HistoricalEvent_date_idx" ON "public"."HistoricalEvent"("date");

-- CreateIndex
CREATE INDEX "HistoricalEvent_eventType_idx" ON "public"."HistoricalEvent"("eventType");

-- CreateIndex
CREATE INDEX "TransitPattern_planet_patternType_idx" ON "public"."TransitPattern"("planet", "patternType");

-- CreateIndex
CREATE INDEX "PlanetaryMemory_planet_sign_idx" ON "public"."PlanetaryMemory"("planet", "sign");

-- CreateIndex
CREATE UNIQUE INDEX "PlanetaryMemory_planet_sign_degree_key" ON "public"."PlanetaryMemory"("planet", "sign", "degree");

-- CreateIndex
CREATE INDEX "TrainingInteraction_personalityId_idx" ON "public"."TrainingInteraction"("personalityId");

-- CreateIndex
CREATE INDEX "TrainingInteraction_createdAt_idx" ON "public"."TrainingInteraction"("createdAt");

-- CreateIndex
CREATE INDEX "Achievement_personalityId_idx" ON "public"."Achievement"("personalityId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_personalityId_achievementType_key" ON "public"."Achievement"("personalityId", "achievementType");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "public"."UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_personalityId_idx" ON "public"."UserSession"("personalityId");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "public"."UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ConsciousnessSurvey_userId_idx" ON "public"."ConsciousnessSurvey"("userId");

-- CreateIndex
CREATE INDEX "ConsciousnessSurvey_completedAt_idx" ON "public"."ConsciousnessSurvey"("completedAt");

-- CreateIndex
CREATE INDEX "ConsciousnessProfile_userId_idx" ON "public"."ConsciousnessProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsciousnessProfile_userId_surveyId_key" ON "public"."ConsciousnessProfile"("userId", "surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsciousnessState_personalityId_key" ON "public"."ConsciousnessState"("personalityId");

-- CreateIndex
CREATE INDEX "ConsciousnessState_personalityId_idx" ON "public"."ConsciousnessState"("personalityId");

-- CreateIndex
CREATE UNIQUE INDEX "historical_agents_agentId_key" ON "public"."historical_agents"("agentId");

-- CreateIndex
CREATE INDEX "historical_agents_agentId_idx" ON "public"."historical_agents"("agentId");

-- CreateIndex
CREATE INDEX "historical_agents_name_idx" ON "public"."historical_agents"("name");

-- CreateIndex
CREATE INDEX "historical_agents_consciousnessLevel_idx" ON "public"."historical_agents"("consciousnessLevel");

-- CreateIndex
CREATE INDEX "historical_agents_isActive_idx" ON "public"."historical_agents"("isActive");

-- CreateIndex
CREATE INDEX "historical_agents_historicalEra_idx" ON "public"."historical_agents"("historicalEra");

-- CreateIndex
CREATE INDEX "historical_agents_birthYear_idx" ON "public"."historical_agents"("birthYear");

-- CreateIndex
CREATE INDEX "historical_agents_culture_idx" ON "public"."historical_agents"("culture");

-- CreateIndex
CREATE INDEX "historical_agents_kalchmConstant_idx" ON "public"."historical_agents"("kalchmConstant");

-- CreateIndex
CREATE INDEX "historical_agents_monicaConstant_idx" ON "public"."historical_agents"("monicaConstant");

-- CreateIndex
CREATE INDEX "historical_agents_popularityScore_idx" ON "public"."historical_agents"("popularityScore");

-- CreateIndex
CREATE INDEX "historical_agents_historicalEra_consciousnessLevel_idx" ON "public"."historical_agents"("historicalEra", "consciousnessLevel");

-- CreateIndex
CREATE INDEX "historical_agents_isActive_historicalEra_idx" ON "public"."historical_agents"("isActive", "historicalEra");

-- CreateIndex
CREATE INDEX "historical_agents_birthYear_culture_idx" ON "public"."historical_agents"("birthYear", "culture");

-- CreateIndex
CREATE INDEX "historical_agents_dominantElement_consciousnessLevel_idx" ON "public"."historical_agents"("dominantElement", "consciousnessLevel");

-- CreateIndex
CREATE INDEX "AgentConversation_agentId_idx" ON "public"."AgentConversation"("agentId");

-- CreateIndex
CREATE INDEX "AgentConversation_sessionId_idx" ON "public"."AgentConversation"("sessionId");

-- CreateIndex
CREATE INDEX "AgentConversation_userId_idx" ON "public"."AgentConversation"("userId");

-- CreateIndex
CREATE INDEX "AgentConversation_createdAt_idx" ON "public"."AgentConversation"("createdAt");

-- CreateIndex
CREATE INDEX "AgentEvolution_agentId_idx" ON "public"."AgentEvolution"("agentId");

-- CreateIndex
CREATE INDEX "AgentEvolution_evolutionDate_idx" ON "public"."AgentEvolution"("evolutionDate");

-- CreateIndex
CREATE INDEX "AgentEvolution_evolutionType_idx" ON "public"."AgentEvolution"("evolutionType");

-- CreateIndex
CREATE INDEX "AgentKnowledge_agentId_idx" ON "public"."AgentKnowledge"("agentId");

-- CreateIndex
CREATE INDEX "AgentKnowledge_category_idx" ON "public"."AgentKnowledge"("category");

-- CreateIndex
CREATE INDEX "AgentKnowledge_topic_idx" ON "public"."AgentKnowledge"("topic");

-- CreateIndex
CREATE INDEX "AgentKnowledge_confidence_idx" ON "public"."AgentKnowledge"("confidence");

-- CreateIndex
CREATE INDEX "agent_attachments_agentId_idx" ON "public"."agent_attachments"("agentId");

-- CreateIndex
CREATE INDEX "agent_attachments_type_idx" ON "public"."agent_attachments"("type");

-- CreateIndex
CREATE INDEX "agent_attachments_isActive_idx" ON "public"."agent_attachments"("isActive");

-- CreateIndex
CREATE INDEX "agent_attachments_priority_idx" ON "public"."agent_attachments"("priority");

-- CreateIndex
CREATE INDEX "agent_attachments_historicalEra_idx" ON "public"."agent_attachments"("historicalEra");

-- CreateIndex
CREATE INDEX "agent_attachments_culturalContext_idx" ON "public"."agent_attachments"("culturalContext");

-- CreateIndex
CREATE INDEX "agent_attachments_relevanceScore_idx" ON "public"."agent_attachments"("relevanceScore");

-- CreateIndex
CREATE INDEX "agent_attachments_agentId_type_idx" ON "public"."agent_attachments"("agentId", "type");

-- CreateIndex
CREATE INDEX "agent_attachments_type_historicalEra_idx" ON "public"."agent_attachments"("type", "historicalEra");

-- CreateIndex
CREATE INDEX "agent_attachment_usage_agentId_idx" ON "public"."agent_attachment_usage"("agentId");

-- CreateIndex
CREATE INDEX "agent_attachment_usage_attachmentId_idx" ON "public"."agent_attachment_usage"("attachmentId");

-- CreateIndex
CREATE INDEX "agent_attachment_usage_usedAt_idx" ON "public"."agent_attachment_usage"("usedAt");

-- CreateIndex
CREATE INDEX "agent_attachment_usage_relevanceScore_idx" ON "public"."agent_attachment_usage"("relevanceScore");

-- CreateIndex
CREATE INDEX "created_agents_creatorId_idx" ON "public"."created_agents"("creatorId");

-- CreateIndex
CREATE INDEX "agent_transit_events_agentId_planetaryDegree_idx" ON "public"."agent_transit_events"("agentId", "planetaryDegree");

-- CreateIndex
CREATE INDEX "agent_transit_events_timestamp_transitingPlanet_idx" ON "public"."agent_transit_events"("timestamp", "transitingPlanet");

-- CreateIndex
CREATE INDEX "agent_transit_events_planetaryDegree_aspectType_idx" ON "public"."agent_transit_events"("planetaryDegree", "aspectType");

-- CreateIndex
CREATE INDEX "agent_transit_events_agentId_timestamp_idx" ON "public"."agent_transit_events"("agentId", "timestamp");

-- CreateIndex
CREATE INDEX "agent_transit_events_significanceScore_idx" ON "public"."agent_transit_events"("significanceScore");

-- CreateIndex
CREATE INDEX "agent_transit_events_reinforcementScore_idx" ON "public"."agent_transit_events"("reinforcementScore");

-- CreateIndex
CREATE INDEX "agent_transit_events_seasonalPhase_planetaryHour_idx" ON "public"."agent_transit_events"("seasonalPhase", "planetaryHour");

-- CreateIndex
CREATE INDEX "agent_transit_events_elementalFire_elementalWater_elemental_idx" ON "public"."agent_transit_events"("elementalFire", "elementalWater", "elementalAir", "elementalEarth");

-- CreateIndex
CREATE INDEX "temporal_bookmarks_userId_idx" ON "public"."temporal_bookmarks"("userId");

-- CreateIndex
CREATE INDEX "temporal_bookmarks_isPublic_idx" ON "public"."temporal_bookmarks"("isPublic");

-- CreateIndex
CREATE INDEX "temporal_bookmarks_lastAccessed_idx" ON "public"."temporal_bookmarks"("lastAccessed");

-- CreateIndex
CREATE INDEX "temporal_bookmarks_accessCount_idx" ON "public"."temporal_bookmarks"("accessCount");

-- CreateIndex
CREATE INDEX "temporal_patterns_patternType_degree_idx" ON "public"."temporal_patterns"("patternType", "degree");

-- CreateIndex
CREATE INDEX "temporal_patterns_significance_reinforcementScore_idx" ON "public"."temporal_patterns"("significance", "reinforcementScore");

-- CreateIndex
CREATE INDEX "temporal_patterns_dominantElement_idx" ON "public"."temporal_patterns"("dominantElement");

-- CreateIndex
CREATE INDEX "temporal_patterns_agentCount_idx" ON "public"."temporal_patterns"("agentCount");

-- CreateIndex
CREATE INDEX "temporal_patterns_firstOccurrence_lastOccurrence_idx" ON "public"."temporal_patterns"("firstOccurrence", "lastOccurrence");

-- CreateIndex
CREATE INDEX "temporal_patterns_isActive_cacheExpiry_idx" ON "public"."temporal_patterns"("isActive", "cacheExpiry");

-- CreateIndex
CREATE UNIQUE INDEX "collaborative_time_sessions_sessionCode_key" ON "public"."collaborative_time_sessions"("sessionCode");

-- CreateIndex
CREATE INDEX "collaborative_time_sessions_sessionCode_idx" ON "public"."collaborative_time_sessions"("sessionCode");

-- CreateIndex
CREATE INDEX "collaborative_time_sessions_isActive_expiresAt_idx" ON "public"."collaborative_time_sessions"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "collaborative_time_sessions_createdBy_idx" ON "public"."collaborative_time_sessions"("createdBy");

-- CreateIndex
CREATE INDEX "collaborative_time_sessions_lastActivity_idx" ON "public"."collaborative_time_sessions"("lastActivity");

-- CreateIndex
CREATE INDEX "collaborative_session_participants_sessionId_isOnline_idx" ON "public"."collaborative_session_participants"("sessionId", "isOnline");

-- CreateIndex
CREATE INDEX "collaborative_session_participants_lastActive_idx" ON "public"."collaborative_session_participants"("lastActive");

-- CreateIndex
CREATE UNIQUE INDEX "collaborative_session_participants_sessionId_userId_key" ON "public"."collaborative_session_participants"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "collaborative_session_updates_sessionId_timestamp_idx" ON "public"."collaborative_session_updates"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "collaborative_session_updates_updateType_idx" ON "public"."collaborative_session_updates"("updateType");

-- CreateIndex
CREATE UNIQUE INDEX "temporal_analysis_cache_queryHash_key" ON "public"."temporal_analysis_cache"("queryHash");

-- CreateIndex
CREATE INDEX "temporal_analysis_cache_queryHash_idx" ON "public"."temporal_analysis_cache"("queryHash");

-- CreateIndex
CREATE INDEX "temporal_analysis_cache_expiresAt_idx" ON "public"."temporal_analysis_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "temporal_analysis_cache_hitCount_idx" ON "public"."temporal_analysis_cache"("hitCount");

-- CreateIndex
CREATE UNIQUE INDEX "monica_user_settings_userId_key" ON "public"."monica_user_settings"("userId");

-- CreateIndex
CREATE INDEX "monica_user_settings_userId_idx" ON "public"."monica_user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "monica_user_progress_userId_key" ON "public"."monica_user_progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "monica_user_progress_settingsId_key" ON "public"."monica_user_progress"("settingsId");

-- CreateIndex
CREATE INDEX "monica_user_progress_userId_idx" ON "public"."monica_user_progress"("userId");

-- CreateIndex
CREATE INDEX "monica_user_progress_level_idx" ON "public"."monica_user_progress"("level");

-- CreateIndex
CREATE INDEX "monica_user_progress_totalXP_idx" ON "public"."monica_user_progress"("totalXP");

-- CreateIndex
CREATE INDEX "monica_user_progress_currentStreak_idx" ON "public"."monica_user_progress"("currentStreak");

-- CreateIndex
CREATE INDEX "monica_module_progress_userId_idx" ON "public"."monica_module_progress"("userId");

-- CreateIndex
CREATE INDEX "monica_module_progress_moduleId_idx" ON "public"."monica_module_progress"("moduleId");

-- CreateIndex
CREATE INDEX "monica_module_progress_category_idx" ON "public"."monica_module_progress"("category");

-- CreateIndex
CREATE INDEX "monica_module_progress_completed_idx" ON "public"."monica_module_progress"("completed");

-- CreateIndex
CREATE INDEX "monica_module_progress_lastAccessed_idx" ON "public"."monica_module_progress"("lastAccessed");

-- CreateIndex
CREATE UNIQUE INDEX "monica_module_progress_userId_moduleId_key" ON "public"."monica_module_progress"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "monica_interactions_userId_idx" ON "public"."monica_interactions"("userId");

-- CreateIndex
CREATE INDEX "monica_interactions_settingsId_idx" ON "public"."monica_interactions"("settingsId");

-- CreateIndex
CREATE INDEX "monica_interactions_pageUrl_idx" ON "public"."monica_interactions"("pageUrl");

-- CreateIndex
CREATE INDEX "monica_interactions_interactionType_idx" ON "public"."monica_interactions"("interactionType");

-- CreateIndex
CREATE INDEX "monica_interactions_createdAt_idx" ON "public"."monica_interactions"("createdAt");

-- CreateIndex
CREATE INDEX "monica_interactions_wasHelpful_idx" ON "public"."monica_interactions"("wasHelpful");

-- CreateIndex
CREATE INDEX "agent_evolution_states_agentId_idx" ON "public"."agent_evolution_states"("agentId");

-- CreateIndex
CREATE INDEX "agent_evolution_states_userId_idx" ON "public"."agent_evolution_states"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_evolution_states_agentId_userId_key" ON "public"."agent_evolution_states"("agentId", "userId");

-- CreateIndex
CREATE INDEX "consciousness_interactions_agentId_idx" ON "public"."consciousness_interactions"("agentId");

-- CreateIndex
CREATE INDEX "consciousness_interactions_userId_idx" ON "public"."consciousness_interactions"("userId");

-- CreateIndex
CREATE INDEX "consciousness_interactions_timestamp_idx" ON "public"."consciousness_interactions"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "public"."subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_tier_idx" ON "public"."subscriptions"("tier");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "public"."subscriptions"("status");

-- CreateIndex
CREATE INDEX "monica_contextual_help_pageUrl_idx" ON "public"."monica_contextual_help"("pageUrl");

-- CreateIndex
CREATE INDEX "monica_contextual_help_contextType_idx" ON "public"."monica_contextual_help"("contextType");

-- CreateIndex
CREATE INDEX "monica_contextual_help_priority_idx" ON "public"."monica_contextual_help"("priority");

-- CreateIndex
CREATE INDEX "monica_contextual_help_successRate_idx" ON "public"."monica_contextual_help"("successRate");

-- CreateIndex
CREATE INDEX "monica_contextual_help_isActive_idx" ON "public"."monica_contextual_help"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "monica_contextual_help_pageUrl_tipId_version_key" ON "public"."monica_contextual_help"("pageUrl", "tipId", "version");

-- CreateIndex
CREATE INDEX "monica_knowledge_userId_idx" ON "public"."monica_knowledge"("userId");

-- CreateIndex
CREATE INDEX "monica_knowledge_knowledgeType_idx" ON "public"."monica_knowledge"("knowledgeType");

-- CreateIndex
CREATE INDEX "monica_knowledge_category_idx" ON "public"."monica_knowledge"("category");

-- CreateIndex
CREATE INDEX "monica_knowledge_confidence_idx" ON "public"."monica_knowledge"("confidence");

-- CreateIndex
CREATE INDEX "monica_knowledge_isActive_idx" ON "public"."monica_knowledge"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "monica_knowledge_userId_knowledgeType_key_key" ON "public"."monica_knowledge"("userId", "knowledgeType", "key");

-- CreateIndex
CREATE INDEX "_PlanetaryTransitToTransitPattern_B_index" ON "public"."_PlanetaryTransitToTransitPattern"("B");

-- CreateIndex
CREATE INDEX "_HistoricalEventToPlanetaryTransit_B_index" ON "public"."_HistoricalEventToPlanetaryTransit"("B");

-- CreateIndex
CREATE INDEX "_PlanetaryMemoryToTransitPattern_B_index" ON "public"."_PlanetaryMemoryToTransitPattern"("B");

-- AddForeignKey
ALTER TABLE "public"."user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIPersonality" ADD CONSTRAINT "AIPersonality_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."ConsciousnessSurvey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIPersonality" ADD CONSTRAINT "AIPersonality_consciousnessProfileId_fkey" FOREIGN KEY ("consciousnessProfileId") REFERENCES "public"."ConsciousnessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIPersonality" ADD CONSTRAINT "AIPersonality_planetaryMemoryId_fkey" FOREIGN KEY ("planetaryMemoryId") REFERENCES "public"."PlanetaryMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingInteraction" ADD CONSTRAINT "TrainingInteraction_personalityId_fkey" FOREIGN KEY ("personalityId") REFERENCES "public"."AIPersonality"("personalityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Achievement" ADD CONSTRAINT "Achievement_personalityId_fkey" FOREIGN KEY ("personalityId") REFERENCES "public"."AIPersonality"("personalityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsciousnessProfile" ADD CONSTRAINT "ConsciousnessProfile_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."ConsciousnessSurvey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsciousnessState" ADD CONSTRAINT "ConsciousnessState_personalityId_fkey" FOREIGN KEY ("personalityId") REFERENCES "public"."AIPersonality"("personalityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentConversation" ADD CONSTRAINT "AgentConversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."historical_agents"("agentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentEvolution" ADD CONSTRAINT "AgentEvolution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."historical_agents"("agentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentKnowledge" ADD CONSTRAINT "AgentKnowledge_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."historical_agents"("agentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_attachments" ADD CONSTRAINT "agent_attachments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."historical_agents"("agentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_attachment_usage" ADD CONSTRAINT "agent_attachment_usage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."historical_agents"("agentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_attachment_usage" ADD CONSTRAINT "agent_attachment_usage_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "public"."agent_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."created_agents" ADD CONSTRAINT "created_agents_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."created_agents" ADD CONSTRAINT "created_agents_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaborative_session_participants" ADD CONSTRAINT "collaborative_session_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."collaborative_time_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaborative_session_updates" ADD CONSTRAINT "collaborative_session_updates_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."collaborative_time_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monica_user_progress" ADD CONSTRAINT "monica_user_progress_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "public"."monica_user_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monica_module_progress" ADD CONSTRAINT "monica_module_progress_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "public"."monica_user_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monica_interactions" ADD CONSTRAINT "monica_interactions_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "public"."monica_user_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PlanetaryTransitToTransitPattern" ADD CONSTRAINT "_PlanetaryTransitToTransitPattern_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."PlanetaryTransit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PlanetaryTransitToTransitPattern" ADD CONSTRAINT "_PlanetaryTransitToTransitPattern_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."TransitPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_HistoricalEventToPlanetaryTransit" ADD CONSTRAINT "_HistoricalEventToPlanetaryTransit_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."HistoricalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_HistoricalEventToPlanetaryTransit" ADD CONSTRAINT "_HistoricalEventToPlanetaryTransit_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."PlanetaryTransit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PlanetaryMemoryToTransitPattern" ADD CONSTRAINT "_PlanetaryMemoryToTransitPattern_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."PlanetaryMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PlanetaryMemoryToTransitPattern" ADD CONSTRAINT "_PlanetaryMemoryToTransitPattern_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."TransitPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;
