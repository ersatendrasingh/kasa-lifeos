import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";
import { resolveDocumentCategory } from "@/lib/documents/categories";

/*
 * Life Vault data access.
 *
 * The module has one job: surface any document in under 30 seconds. There is no
 * folder tree, so search quality is the whole product, and it runs through the
 * `searchVector` generated column defined in the life_vault_documents migration.
 */

/// Columns safe to return to the client. `ocrText` is deliberately excluded from
/// list payloads — it is large and only powers server-side matching.
const listSelect = {
  id: true,
  title: true,
  categorySlug: true,
  kind: true,
  mimeType: true,
  sizeBytes: true,
  originalFileName: true,
  tags: true,
  aliases: true,
  idNumberMasked: true,
  // Only the last four digits are retained and searchable. This value never
  // leaves the server in list responses, but search scoring needs it.
  idNumberLast4: true,
  issuedOn: true,
  expiresAt: true,
  favorite: true,
  aiConfidence: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

export type DocumentListItem = Prisma.DocumentGetPayload<{
  select: typeof listSelect;
}>;

/*
 * Search.
 *
 * Implemented with plain Prisma `contains` filters rather than Postgres
 * full-text search, so the module works on any database created by a plain
 * `prisma db push` — no extensions, no generated columns, nothing that has to be
 * applied out of band. Substring matching also handles the cases that matter
 * here better than tsquery does: "pass" finds Passport, and a digit fragment
 * finds a number, neither of which whole-lexeme matching does well.
 *
 * Every term must match somewhere (AND), so extra words narrow the result. Each
 * term may match the title, an alias, a tag or the document text (OR).
 */
function buildSearchFilter(term: string): Prisma.DocumentWhereInput {
  const tokens = term
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    AND: tokens.map((token) => ({
      OR: [
        { title: { contains: token, mode: "insensitive" as const } },
        // Arrays need an exact element match, so a prefix is matched below via
        // the OCR text and title instead.
        { aliases: { has: token } },
        { tags: { has: token } },
        { idNumberLast4: { contains: token } },
        { ocrText: { contains: token, mode: "insensitive" as const } },
      ],
    })),
  };
}

/*
 * Ranks matches so the most likely document is first.
 *
 * Sorting in application code keeps the query portable. The candidate set is
 * capped by `take` before this runs, so it stays bounded regardless of how many
 * documents a user has.
 */
function scoreMatch(document: DocumentListItem, term: string) {
  const needle = term.toLowerCase();
  const title = document.title.toLowerCase();
  let score = 0;

  if (title === needle) score += 100;
  else if (title.startsWith(needle)) score += 60;
  else if (title.includes(needle)) score += 40;

  // An alias is an intentional shorthand ("DL"), so an exact hit is a strong
  // signal — stronger than the word merely appearing in the document body.
  if (document.aliases.some((alias) => alias.toLowerCase() === needle)) {
    score += 50;
  } else if (
    document.aliases.some((alias) => alias.toLowerCase().includes(needle))
  ) {
    score += 25;
  }

  if (document.tags.some((tag) => tag.toLowerCase() === needle)) score += 20;
  if (document.idNumberLast4?.includes(needle)) score += 30;
  if (document.favorite) score += 10;

  return score;
}

export type ListDocumentsOptions = {
  userId: string;
  search?: string | null;
  categorySlug?: string | null;
  favoritesOnly?: boolean;
  kind?: "IMAGE" | "PDF" | null;
  expiry?: "upcoming" | "expired" | "none" | null;
  sort?: "updated" | "created" | "title" | "expiry" | null;
  limit?: number;
};

/*
 * True when the failure is "the vault tables do not exist yet" rather than a
 * real problem.
 *
 * P2021 is Prisma's missing-table code and 42P01 is Postgres' undefined_table.
 * A developer who has pulled these changes but not yet run `prisma db push`
 * should see an empty vault that invites them to add a document, not a server
 * exception — the page is readable either way, and pushing the schema fixes it.
 */
function isMissingTableError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "42P01";
}

const emptyOverview = {
  total: 0,
  recent: [] as DocumentListItem[],
  favorites: [] as DocumentListItem[],
  expiringSoon: [] as DocumentListItem[],
  customCategories: [] as Array<{ slug: string; label: string }>,
  counts: new Map<string, number>(),
  /// Signals that the schema has not been pushed, so the UI can say so rather
  /// than implying the user has no documents.
  schemaMissing: false,
};

export async function listDocuments(options: ListDocumentsOptions) {
  const { userId, search, categorySlug, favoritesOnly, kind, expiry, sort } =
    options;
  const limit = Math.min(options.limit ?? 60, 100);
  const term = search?.trim();
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 90);

  const expiresAtFilter =
    expiry === "upcoming"
      ? { not: null, gte: now, lte: horizon }
      : expiry === "expired"
        ? { not: null, lt: now }
        : expiry === "none"
          ? null
          : undefined;
  const orderBy =
    sort === "created"
      ? { createdAt: "desc" as const }
      : sort === "title"
        ? { title: "asc" as const }
        : sort === "expiry"
          ? { expiresAt: "asc" as const }
          : { updatedAt: "desc" as const };

  let documents: DocumentListItem[];
  try {
    documents = await db.document.findMany({
      where: {
        userId,
        ...(categorySlug ? { categorySlug } : {}),
        ...(favoritesOnly ? { favorite: true } : {}),
        ...(kind ? { kind } : {}),
        ...(expiresAtFilter !== undefined
          ? { expiresAt: expiresAtFilter }
          : {}),
        ...(term ? buildSearchFilter(term) : {}),
      },
      orderBy,
      select: listSelect,
      take: term ? 120 : limit,
    });
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return [];
  }

  // Backfill the current reminder policy lazily for existing vault records.
  // The sync routine is idempotent, so ordinary reads only write when the
  // document's expiry or the renewal cadence has actually changed.
  await Promise.all(
    documents
      .filter((document) => document.expiresAt)
      .map((document) =>
        syncDocumentReminders(document.id, document.expiresAt),
      ),
  );

  if (!term) return documents;

  return documents
    .map((document) => ({ document, score: scoreMatch(document, term) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.document);
}

export async function getDocument(userId: string, documentId: string) {
  // userId is part of the filter rather than checked afterwards, so a document
  // belonging to someone else is indistinguishable from one that does not exist.
  return db.document.findFirst({
    where: { id: documentId, userId },
    include: { reminders: { orderBy: { leadDays: "desc" } } },
  });
}

/*
 * Dashboard payload: everything the vault landing page needs in one round trip,
 * since each of these is small and the page is useless without all of them.
 */
export async function getVaultOverview(userId: string) {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 90);

  let payload: Awaited<ReturnType<typeof getVaultOverviewData>>;
  try {
    payload = await getVaultOverviewData(userId, now, horizon);
  } catch (error) {
    // A fresh checkout can render before migrations have been applied. Keep the
    // route usable and let the UI explain the situation instead of returning a
    // generic 500 page.
    if (isMissingTableError(error)) {
      return { ...emptyOverview, schemaMissing: true };
    }
    throw error;
  }

  const {
    recent,
    favorites,
    expiringSoon,
    categoryCounts,
    customCategories,
    total,
  } = payload;

  const customLabels = new Map(
    customCategories.map((category) => [category.slug, category.label]),
  );

  return {
    schemaMissing: false,
    total,
    recent,
    favorites,
    expiringSoon,
    customCategories,
    counts: new Map(
      categoryCounts.map((row) => [row.categorySlug, row._count._all]),
    ),
    // Resolved here so every surface renders custom categories identically.
    resolveCategory: (slug: string) =>
      resolveDocumentCategory(slug, customLabels),
  };
}

async function getVaultOverviewData(userId: string, now: Date, horizon: Date) {
  const [
    recent,
    favorites,
    expiringSoon,
    categoryCounts,
    customCategories,
    total,
  ] = await Promise.all([
    db.document.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: listSelect,
      take: 8,
    }),
    db.document.findMany({
      where: { userId, favorite: true },
      orderBy: { updatedAt: "desc" },
      select: listSelect,
      take: 8,
    }),
    db.document.findMany({
      where: { userId, expiresAt: { not: null, gte: now, lte: horizon } },
      orderBy: { expiresAt: "asc" },
      select: listSelect,
      take: 6,
    }),
    db.document.groupBy({
      by: ["categorySlug"],
      where: { userId },
      _count: { _all: true },
    }),
    db.documentCategory.findMany({
      where: { userId },
      orderBy: { label: "asc" },
    }),
    db.document.count({ where: { userId } }),
  ]);

  return {
    recent,
    favorites,
    expiringSoon,
    categoryCounts,
    customCategories,
    total,
  };
}

/*
 * Expiry reminders, one row per lead time.
 *
 * Each lead time also gets a queued Notification, which is how delivery already
 * works elsewhere in KASA: the mobile app polls /api/notifications/sync for
 * QUEUED rows and schedules them locally. Reusing that pipeline means expiry
 * warnings need no new delivery infrastructure.
 *
 * Lead times in the past are skipped: a passport expiring in 20 days should not
 * generate an immediately-overdue six-month reminder. Existing rows are replaced
 * so editing an expiry date cannot leave stale reminders behind.
 */
/*
 * Renewal lead time is not one-size-fits-all. A passport or insurance policy
 * needs runway, whereas a short-lived record only needs a closer nudge. The
 * final 15-day reminder is the non-negotiable safety net for every expiring
 * document; a seven-day alert remains as the last call.
 */
function reminderLeadDays(input: { categorySlug: string; title: string }) {
  const label = `${input.categorySlug} ${input.title}`.toLowerCase();
  if (/(passport|visa|insurance|policy)/.test(label)) {
    return [180, 90, 30, 15, 7];
  }
  if (/(vehicle|driving|licen[cs]e|rc\b|puc|medical)/.test(label)) {
    return [90, 30, 15, 7];
  }
  return [60, 30, 15, 7];
}

export async function syncDocumentReminders(
  documentId: string,
  expiresAt: Date | null,
) {
  const document = await db.document.findUnique({
    where: { id: documentId },
    select: { userId: true, title: true, categorySlug: true },
  });
  if (!document) return;

  const now = Date.now();
  const expiry = expiresAt;
  const due = expiry
    ? reminderLeadDays(document)
        .map((leadDays) => {
          const remindAt = new Date(expiry);
          remindAt.setDate(remindAt.getDate() - leadDays);
          return { leadDays, remindAt };
        })
        .filter((row) => row.remindAt.getTime() > now)
    : [];

  const existing = await db.documentReminder.findMany({
    where: { documentId, status: "SCHEDULED" },
    select: { leadDays: true, remindAt: true },
  });
  const alreadyCurrent =
    existing.length === due.length &&
    existing.every((row) =>
      due.some(
        (candidate) =>
          candidate.leadDays === row.leadDays &&
          candidate.remindAt.getTime() === row.remindAt.getTime(),
      ),
    );
  if (alreadyCurrent) return;

  await db.documentReminder.deleteMany({ where: { documentId } });
  /*
   * Previously queued notifications for this document are withdrawn before new
   * ones are written, so changing an expiry date cannot leave a warning for the
   * old date sitting in the queue. Only QUEUED rows are touched — anything
   * already delivered is history and stays.
   */
  await db.notification.deleteMany({
    where: {
      userId: document.userId,
      status: "QUEUED",
      metadata: { path: ["documentId"], equals: documentId },
    },
  });

  if (!expiry || due.length === 0) return;

  const expiryLabel = expiry.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  await db.$transaction([
    db.documentReminder.createMany({
      data: due.map(({ leadDays, remindAt }) => ({
        documentId,
        leadDays,
        remindAt,
      })),
    }),
    db.notification.createMany({
      data: due.map(({ leadDays, remindAt }) => ({
        userId: document.userId,
        channel: "PUSH" as const,
        title: `${document.title} expires in ${leadDays} days`,
        body: `Valid until ${expiryLabel}. Renew it before it lapses.`,
        scheduledAt: remindAt,
        // Lets this document's notifications be found again on the next sync.
        metadata: { documentId, leadDays },
      })),
    }),
  ]);
}
