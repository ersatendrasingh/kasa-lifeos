-- Use Better Auth's canonical schema names so the adapter needs no legacy
-- field aliases and generated Prisma clients stay predictable.
ALTER TABLE "User"
RENAME COLUMN "isEmailVerified" TO "emailVerified";

ALTER TABLE "Session"
RENAME COLUMN "sessionToken" TO "token";

ALTER TABLE "Session"
RENAME COLUMN "expires" TO "expiresAt";

ALTER TABLE "Account"
ADD COLUMN "issuer" TEXT;

UPDATE "Account"
SET "issuer" = "provider"
WHERE "issuer" IS NULL;

ALTER TABLE "Account"
ALTER COLUMN "issuer" SET NOT NULL;

ALTER TABLE "Account"
RENAME COLUMN "providerAccountId" TO "accountId";

ALTER TABLE "Account"
RENAME COLUMN "provider" TO "providerId";

ALTER TABLE "Account"
RENAME COLUMN "refresh_token" TO "refreshToken";

ALTER TABLE "Account"
RENAME COLUMN "access_token" TO "accessToken";

ALTER TABLE "Account"
RENAME COLUMN "id_token" TO "idToken";

DROP INDEX IF EXISTS "Account_provider_providerAccountId_key";

CREATE UNIQUE INDEX "Account_issuer_accountId_key"
ON "Account"("issuer", "accountId");
