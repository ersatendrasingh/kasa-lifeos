-- Remove Auth.js and pre-Better-Auth structures after the migration completed.
DROP TABLE IF EXISTS "OtpChallenge";
DROP TABLE IF EXISTS "Authenticator";
DROP TABLE IF EXISTS "VerificationToken";

DROP TYPE IF EXISTS "OtpChannel";
DROP TYPE IF EXISTS "OtpPurpose";

ALTER TABLE "User"
DROP COLUMN IF EXISTS "emailVerified",
DROP COLUMN IF EXISTS "phone",
DROP COLUMN IF EXISTS "phoneVerified",
DROP COLUMN IF EXISTS "passwordHash",
DROP COLUMN IF EXISTS "passwordSetAt",
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

ALTER TABLE "Account"
DROP CONSTRAINT IF EXISTS "Account_issuer_providerAccountId_key",
DROP COLUMN IF EXISTS "type",
DROP COLUMN IF EXISTS "issuer",
DROP COLUMN IF EXISTS "expires_at",
DROP COLUMN IF EXISTS "token_type",
DROP COLUMN IF EXISTS "session_state";

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"
ON "Account"("provider", "providerAccountId");
