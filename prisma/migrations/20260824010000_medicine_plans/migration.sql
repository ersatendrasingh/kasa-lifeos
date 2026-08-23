-- CreateTable
CREATE TABLE "MedicinePlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "times" JSONB NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicinePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicinePlan_userId_active_startDate_idx" ON "MedicinePlan"("userId", "active", "startDate");

-- AddForeignKey
ALTER TABLE "MedicinePlan" ADD CONSTRAINT "MedicinePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
