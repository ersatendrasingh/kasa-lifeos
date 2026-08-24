CREATE TABLE "LearningTrack" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'COURSE',
  "provider" TEXT,
  "url" TEXT,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "weeklyGoalMinutes" INTEGER NOT NULL DEFAULT 180,
  "lastStudiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningTrack_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LearningLesson" (
  "id" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningLesson_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LearningSession" (
  "id" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "note" TEXT,
  "studiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningTrack_userId_status_updatedAt_idx" ON "LearningTrack"("userId", "status", "updatedAt" DESC);
CREATE INDEX "LearningLesson_trackId_position_idx" ON "LearningLesson"("trackId", "position");
CREATE INDEX "LearningSession_trackId_studiedAt_idx" ON "LearningSession"("trackId", "studiedAt" DESC);
ALTER TABLE "LearningTrack" ADD CONSTRAINT "LearningTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningLesson" ADD CONSTRAINT "LearningLesson_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "LearningTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "LearningTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
