CREATE TABLE "Mission" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"title" TEXT NOT NULL,"category" TEXT NOT NULL,"description" TEXT,"targetValue" DECIMAL(14,2),"currentValue" DECIMAL(14,2),"unit" TEXT,"targetDate" TIMESTAMP(3),"status" TEXT NOT NULL DEFAULT 'ACTIVE',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Mission_pkey" PRIMARY KEY ("id"));
CREATE TABLE "MissionMilestone" ("id" TEXT NOT NULL,"missionId" TEXT NOT NULL,"title" TEXT NOT NULL,"completedAt" TIMESTAMP(3),"position" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "MissionMilestone_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Mission_userId_status_updatedAt_idx" ON "Mission"("userId","status","updatedAt" DESC);
CREATE INDEX "MissionMilestone_missionId_position_idx" ON "MissionMilestone"("missionId","position");
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionMilestone" ADD CONSTRAINT "MissionMilestone_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
