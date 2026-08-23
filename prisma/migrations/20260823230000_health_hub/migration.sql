-- CreateTable
CREATE TABLE "HealthEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthEntry_userId_type_recordedAt_idx" ON "HealthEntry"("userId", "type", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "HealthEntry_userId_recordedAt_idx" ON "HealthEntry"("userId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "HealthEntry_source_recordedAt_idx" ON "HealthEntry"("source", "recordedAt" DESC);

-- AddForeignKey
ALTER TABLE "HealthEntry" ADD CONSTRAINT "HealthEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
