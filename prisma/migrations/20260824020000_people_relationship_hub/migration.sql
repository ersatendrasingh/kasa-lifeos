-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "role" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FRIEND',
    "tags" JSONB,
    "birthday" TIMESTAMP(3),
    "anniversary" TIMESTAMP(3),
    "address" TEXT,
    "trustLevel" INTEGER NOT NULL DEFAULT 3,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "bloodGroup" TEXT,
    "emergency" BOOLEAN NOT NULL DEFAULT false,
    "lastContactAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Person_userId_favorite_updatedAt_idx" ON "Person"("userId", "favorite", "updatedAt" DESC);
CREATE INDEX "Person_userId_category_updatedAt_idx" ON "Person"("userId", "category", "updatedAt" DESC);
CREATE INDEX "Person_userId_lastContactAt_idx" ON "Person"("userId", "lastContactAt");
CREATE INDEX "PersonMemory_personId_occurredAt_idx" ON "PersonMemory"("personId", "occurredAt" DESC);
CREATE INDEX "PersonMemory_userId_kind_occurredAt_idx" ON "PersonMemory"("userId", "kind", "occurredAt" DESC);

ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonMemory" ADD CONSTRAINT "PersonMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonMemory" ADD CONSTRAINT "PersonMemory_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
