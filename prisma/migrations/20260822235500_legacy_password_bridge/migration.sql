-- Preserve password login for users created before the Better Auth migration.
-- New passwords are written directly to Better Auth credential accounts.
INSERT INTO "Account" (
    "id",
    "userId",
    "type",
    "issuer",
    "provider",
    "providerAccountId",
    "password",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_' || "id",
    "id",
    'credentials',
    'local:oauth:legacy',
    'credential',
    "id",
    "passwordHash",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE "passwordHash" IS NOT NULL
ON CONFLICT ("issuer", "providerAccountId") DO NOTHING;
