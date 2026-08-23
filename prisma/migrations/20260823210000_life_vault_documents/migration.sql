-- Life Vault documents.
--
-- Search is the entire navigation model for this module (no folders), so the
-- searchable text is maintained by Postgres as a generated tsvector column with
-- a GIN index. Doing it in the database rather than in application code means
-- the vector can never drift out of sync with the row.
--
-- Weights are ordered by how strongly a match should rank:
--   A  title          — the document's name
--   B  aliases        — "DL" for a driving licence, so short queries hit
--   C  tags, last 4   — user tags and the last digits of an identity number
--   D  ocrText        — full text read off the document
-- pg_trgm powers the `%` similarity operator used by the search query and the
-- trigram index below. Created first so the extension exists before anything
-- depends on it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL DEFAULT 'others',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ocrText" TEXT,
    "idNumberMasked" TEXT,
    "idNumberLast4" TEXT,
    "issuedOn" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentReminder" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "leadDays" INTEGER NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_objectKey_key" ON "Document"("objectKey");

CREATE INDEX "Document_userId_updatedAt_idx" ON "Document"("userId", "updatedAt" DESC);

CREATE INDEX "Document_userId_categorySlug_updatedAt_idx" ON "Document"("userId", "categorySlug", "updatedAt" DESC);

CREATE INDEX "Document_userId_favorite_idx" ON "Document"("userId", "favorite");

CREATE INDEX "Document_userId_expiresAt_idx" ON "Document"("userId", "expiresAt");

CREATE UNIQUE INDEX "DocumentCategory_userId_slug_key" ON "DocumentCategory"("userId", "slug");

CREATE UNIQUE INDEX "DocumentReminder_documentId_leadDays_key" ON "DocumentReminder"("documentId", "leadDays");

CREATE INDEX "DocumentReminder_status_remindAt_idx" ON "DocumentReminder"("status", "remindAt");

ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentCategory" ADD CONSTRAINT "DocumentCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentReminder" ADD CONSTRAINT "DocumentReminder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Generated search vector.
--
-- Wrapped in a function because a STORED generated column requires an IMMUTABLE
-- expression, and the obvious inline version is not: `to_tsvector(text, text)`
-- is only STABLE (the config name is resolved at runtime), as is
-- `array_to_string`. Casting the config to regconfig and declaring this wrapper
-- IMMUTABLE satisfies the requirement — with a fixed config and a constant
-- delimiter over text[], the result genuinely depends only on the inputs.
--
-- 'simple' rather than 'english': identity terms like "DL" and "PAN" and digit
-- fragments must not be stemmed or discarded as stopwords.
CREATE OR REPLACE FUNCTION "kasa_document_search_vector"(
    "title" text,
    "aliases" text[],
    "tags" text[],
    "id_last4" text,
    "ocr_text" text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT setweight(to_tsvector('simple'::regconfig, coalesce("title", '')), 'A')
        || setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string("aliases", ' '), '')), 'B')
        || setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string("tags", ' '), '')), 'C')
        || setweight(to_tsvector('simple'::regconfig, coalesce("id_last4", '')), 'C')
        || setweight(to_tsvector('simple'::regconfig, coalesce("ocr_text", '')), 'D')
$$;

ALTER TABLE "Document"
ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
    "kasa_document_search_vector"(
        "title",
        "aliases",
        "tags",
        "idNumberLast4",
        "ocrText"
    )
) STORED;

CREATE INDEX "Document_searchVector_idx" ON "Document" USING GIN ("searchVector");

-- Trigram index on the title so partial words ("pass" for "Passport") still
-- match. Full-text search alone only matches whole lexemes and prefixes.
CREATE INDEX "Document_title_trgm_idx" ON "Document" USING GIN ("title" gin_trgm_ops);
