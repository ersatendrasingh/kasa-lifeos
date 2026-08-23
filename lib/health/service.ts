import type { Prisma } from "@/app/generated/prisma/client";

import { db } from "@/lib/db";
import type {
  HealthEntryType,
  HealthEntryView,
  NormalizedHealthEntry,
} from "@/lib/health/types";

function serializeEntry(entry: {
  id: string;
  type: string;
  value: { toString(): string };
  unit: string;
  source: string;
  recordedAt: Date;
  metadata: Prisma.JsonValue | null;
}): HealthEntryView {
  return {
    id: entry.id,
    type: entry.type as HealthEntryType,
    value: Number(entry.value.toString()),
    unit: entry.unit,
    source: entry.source,
    recordedAt: entry.recordedAt.toISOString(),
    metadata:
      entry.metadata &&
      typeof entry.metadata === "object" &&
      !Array.isArray(entry.metadata)
        ? (entry.metadata as Record<string, unknown>)
        : null,
  };
}

export async function addHealthEntry(
  userId: string,
  entry: NormalizedHealthEntry,
) {
  const created = await db.healthEntry.create({
    data: {
      userId,
      type: entry.type,
      value: entry.value,
      unit: entry.unit,
      source: entry.source,
      recordedAt: entry.recordedAt,
      metadata: entry.metadata,
    },
  });
  return serializeEntry(created);
}

export async function addHealthEntries(
  userId: string,
  entries: NormalizedHealthEntry[],
  sessionId: string,
) {
  const created = await db.$transaction(async (transaction) => {
    const existing = await transaction.healthEntry.findMany({
      where: {
        userId,
        metadata: { path: ["measurementSessionId"], equals: sessionId },
      },
      orderBy: { createdAt: "asc" },
    });
    if (existing.length) return existing;
    return Promise.all(
      entries.map((entry) =>
        transaction.healthEntry.create({
          data: {
            userId,
            type: entry.type,
            value: entry.value,
            unit: entry.unit,
            source: entry.source,
            recordedAt: entry.recordedAt,
            metadata: entry.metadata,
          },
        }),
      ),
    );
  });
  return created.map(serializeEntry);
}

export async function getHealthEntries(userId: string, days = 35) {
  const since = new Date(Date.now() - days * 86_400_000);
  const entries = await db.healthEntry.findMany({
    where: { userId, recordedAt: { gte: since } },
    orderBy: { recordedAt: "desc" },
    take: 500,
  });
  return entries.map(serializeEntry);
}
