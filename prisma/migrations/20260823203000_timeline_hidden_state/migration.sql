ALTER TABLE "TimelineEvent" ADD COLUMN "hiddenAt" TIMESTAMP(3);

CREATE INDEX "TimelineEvent_userId_hiddenAt_occurredAt_idx"
ON "TimelineEvent"("userId", "hiddenAt", "occurredAt" DESC);
