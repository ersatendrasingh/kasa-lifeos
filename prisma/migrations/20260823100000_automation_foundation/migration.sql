-- CreateEnum
CREATE TYPE "AutomationProvider" AS ENUM ('GMAIL', 'GOOGLE_CALENDAR', 'APPLE_CALENDAR', 'SMS', 'APPLE_HEALTH', 'HEALTH_CONNECT', 'PHOTOS', 'LOCATION', 'CONTACTS', 'NOTIFICATIONS', 'BROWSER_EXTENSION', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AutomationConnectionStatus" AS ENUM ('AVAILABLE', 'CONNECTING', 'CONNECTED', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "AutomationSource" AS ENUM ('MANUAL_TEXT', 'VOICE', 'CAMERA', 'DOCUMENT', 'EMAIL', 'CALENDAR', 'SMS', 'HEALTH', 'LOCATION', 'CONTACTS', 'NOTIFICATION', 'BROWSER', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AutomationPolicyMode" AS ENUM ('REVIEW_FIRST', 'AUTO_SAFE', 'PAUSED');

-- CreateEnum
CREATE TYPE "AutomationEventStatus" AS ENUM ('PROCESSING', 'ACTIONED', 'NEEDS_REVIEW', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('ADD_TIMELINE_EVENT', 'CREATE_TASK', 'CREATE_REMINDER', 'LOG_EXPENSE', 'ADD_SHOPPING_ITEM', 'ADD_WISH', 'SAVE_IDEA', 'UPSERT_LIFE_RECORD');

-- CreateEnum
CREATE TYPE "AutomationActionStatus" AS ENUM ('PROPOSED', 'NEEDS_REVIEW', 'EXECUTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "LifeRecordType" AS ENUM ('DOCUMENT', 'VEHICLE', 'SUBSCRIPTION', 'PURCHASE', 'TRIP', 'APPOINTMENT', 'PERSON', 'HEALTH', 'CAREER', 'HOME', 'LEARNING', 'OTHER');

-- CreateTable
CREATE TABLE "AutomationConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "AutomationProvider" NOT NULL,
  "status" "AutomationConnectionStatus" NOT NULL DEFAULT 'AVAILABLE',
  "externalAccountId" TEXT,
  "displayName" TEXT,
  "scopes" JSONB,
  "settings" JSONB,
  "lastSyncAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationPolicy" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "AutomationSource" NOT NULL,
  "mode" "AutomationPolicyMode" NOT NULL DEFAULT 'REVIEW_FIRST',
  "allowedActions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "connectionId" TEXT,
  "source" "AutomationSource" NOT NULL,
  "sourceExternalId" TEXT,
  "contentType" TEXT NOT NULL DEFAULT 'text/plain',
  "rawText" TEXT,
  "status" "AutomationEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "summary" TEXT,
  "confidence" DOUBLE PRECISION,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" "AutomationActionType" NOT NULL,
  "status" "AutomationActionStatus" NOT NULL DEFAULT 'PROPOSED',
  "title" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "requiresReview" BOOLEAN NOT NULL DEFAULT true,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "executedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifeRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "type" "LifeRecordType" NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "occurredAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "attributes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LifeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationConnection_userId_provider_key" ON "AutomationConnection"("userId", "provider");
CREATE INDEX "AutomationConnection_userId_status_idx" ON "AutomationConnection"("userId", "status");
CREATE UNIQUE INDEX "AutomationPolicy_userId_source_key" ON "AutomationPolicy"("userId", "source");
CREATE UNIQUE INDEX "AutomationEvent_userId_source_sourceExternalId_key" ON "AutomationEvent"("userId", "source", "sourceExternalId");
CREATE INDEX "AutomationEvent_userId_createdAt_idx" ON "AutomationEvent"("userId", "createdAt" DESC);
CREATE INDEX "AutomationEvent_userId_status_createdAt_idx" ON "AutomationEvent"("userId", "status", "createdAt" DESC);
CREATE INDEX "AutomationAction_userId_status_createdAt_idx" ON "AutomationAction"("userId", "status", "createdAt" DESC);
CREATE INDEX "AutomationAction_eventId_idx" ON "AutomationAction"("eventId");
CREATE INDEX "LifeRecord_userId_type_updatedAt_idx" ON "LifeRecord"("userId", "type", "updatedAt" DESC);
CREATE INDEX "LifeRecord_userId_expiresAt_idx" ON "LifeRecord"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "AutomationConnection" ADD CONSTRAINT "AutomationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationPolicy" ADD CONSTRAINT "AutomationPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AutomationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AutomationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LifeRecord" ADD CONSTRAINT "LifeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LifeRecord" ADD CONSTRAINT "LifeRecord_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "AutomationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
