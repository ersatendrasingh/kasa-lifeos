-- CreateEnum
CREATE TYPE "CaptureCategory" AS ENUM ('TASK', 'REMINDER', 'IDEA', 'EXPENSE', 'SHOPPING', 'WISH');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('PROCESSING', 'CLASSIFIED', 'NEEDS_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CaptureClassifier" AS ENUM ('RULES', 'AI', 'USER');

-- CreateEnum
CREATE TYPE "CaptureSource" AS ENUM ('WEB', 'MOBILE', 'VOICE', 'IMPORT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'TRIGGERED', 'SNOOZED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('INBOX', 'EXPLORING', 'PLANNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShoppingItemStatus" AS ENUM ('TO_BUY', 'BOUGHT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WishStatus" AS ENUM ('WISHED', 'SAVING', 'ACHIEVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('CAPTURED', 'TASK_COMPLETED', 'REMINDER_TRIGGERED', 'DOCUMENT_ADDED', 'FINANCE', 'HEALTH', 'CAREER', 'LEARNING', 'RELATIONSHIP', 'VEHICLE', 'HOME', 'ACHIEVEMENT', 'NOTE');

-- CreateEnum
CREATE TYPE "TimelineVisibility" AS ENUM ('PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'READ', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DashboardWidgetType" AS ENUM ('TODAY_SCORE', 'STREAK', 'FOCUS', 'QUICK_CAPTURE', 'PENDING_BILLS', 'UPCOMING_EVENTS', 'HABITS', 'FINANCE', 'FOLLOW_UPS', 'BIRTHDAYS', 'LEARNING');

-- CreateEnum
CREATE TYPE "DashboardWidgetSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'FULL');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardWidget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DashboardWidgetType" NOT NULL,
    "position" INTEGER NOT NULL,
    "size" "DashboardWidgetSize" NOT NULL DEFAULT 'MEDIUM',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "category" "CaptureCategory" NOT NULL,
    "status" "CaptureStatus" NOT NULL DEFAULT 'CLASSIFIED',
    "classifier" "CaptureClassifier" NOT NULL DEFAULT 'RULES',
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" "CaptureSource" NOT NULL DEFAULT 'WEB',
    "dueAt" TIMESTAMP(3),
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "metadata" JSONB,
    "classifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "recurrence" JSONB,
    "targetType" TEXT,
    "targetId" TEXT,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" "IdeaStatus" NOT NULL DEFAULT 'INBOX',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "category" TEXT,
    "merchant" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" TEXT,
    "status" "ShoppingItemStatus" NOT NULL DEFAULT 'TO_BUY',
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wish" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "WishStatus" NOT NULL DEFAULT 'WISHED',
    "targetAmount" DECIMAL(14,2),
    "currency" TEXT DEFAULT 'INR',
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TimelineEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "visibility" "TimelineVisibility" NOT NULL DEFAULT 'PRIVATE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "DashboardWidget_userId_enabled_position_idx" ON "DashboardWidget"("userId", "enabled", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardWidget_userId_type_key" ON "DashboardWidget"("userId", "type");

-- CreateIndex
CREATE INDEX "Capture_userId_createdAt_idx" ON "Capture"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Capture_userId_category_status_idx" ON "Capture"("userId", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Task_captureId_key" ON "Task"("captureId");

-- CreateIndex
CREATE INDEX "Task_userId_status_dueAt_idx" ON "Task"("userId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_captureId_key" ON "Reminder"("captureId");

-- CreateIndex
CREATE INDEX "Reminder_userId_status_remindAt_idx" ON "Reminder"("userId", "status", "remindAt");

-- CreateIndex
CREATE INDEX "Reminder_status_remindAt_idx" ON "Reminder"("status", "remindAt");

-- CreateIndex
CREATE UNIQUE INDEX "Idea_captureId_key" ON "Idea"("captureId");

-- CreateIndex
CREATE INDEX "Idea_userId_status_createdAt_idx" ON "Idea"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Expense_captureId_key" ON "Expense"("captureId");

-- CreateIndex
CREATE INDEX "Expense_userId_occurredAt_idx" ON "Expense"("userId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "Expense_userId_isConfirmed_idx" ON "Expense"("userId", "isConfirmed");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingItem_captureId_key" ON "ShoppingItem"("captureId");

-- CreateIndex
CREATE INDEX "ShoppingItem_userId_status_createdAt_idx" ON "ShoppingItem"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Wish_captureId_key" ON "Wish"("captureId");

-- CreateIndex
CREATE INDEX "Wish_userId_status_targetDate_idx" ON "Wish"("userId", "status", "targetDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_userId_occurredAt_idx" ON "TimelineEvent"("userId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "TimelineEvent_userId_type_occurredAt_idx" ON "TimelineEvent"("userId", "type", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "TimelineEvent_sourceType_sourceId_idx" ON "TimelineEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledAt_idx" ON "Notification"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "Capture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "Capture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "Capture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "Capture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "Capture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wish" ADD CONSTRAINT "Wish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wish" ADD CONSTRAINT "Wish_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "Capture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
