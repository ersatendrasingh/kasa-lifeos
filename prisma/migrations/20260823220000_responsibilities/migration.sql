CREATE TYPE "ResponsibilityCadence" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

CREATE TABLE "Responsibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "provider" TEXT,
    "cadence" "ResponsibilityCadence" NOT NULL DEFAULT 'MONTHLY',
    "dueDay" INTEGER,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "notificationDays" JSONB NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Responsibility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResponsibilityPayment" (
    "id" TEXT NOT NULL,
    "responsibilityId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResponsibilityPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Responsibility_userId_active_nextDueAt_idx" ON "Responsibility"("userId", "active", "nextDueAt");
CREATE INDEX "ResponsibilityPayment_responsibilityId_paidAt_idx" ON "ResponsibilityPayment"("responsibilityId", "paidAt" DESC);

ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResponsibilityPayment" ADD CONSTRAINT "ResponsibilityPayment_responsibilityId_fkey" FOREIGN KEY ("responsibilityId") REFERENCES "Responsibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
