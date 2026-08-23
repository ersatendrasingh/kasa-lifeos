CREATE TABLE "AutomationAttachment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationAttachment_objectKey_key" ON "AutomationAttachment"("objectKey");
CREATE INDEX "AutomationAttachment_userId_createdAt_idx" ON "AutomationAttachment"("userId", "createdAt" DESC);
CREATE INDEX "AutomationAttachment_eventId_idx" ON "AutomationAttachment"("eventId");

ALTER TABLE "AutomationAttachment"
ADD CONSTRAINT "AutomationAttachment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationAttachment"
ADD CONSTRAINT "AutomationAttachment_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "AutomationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
