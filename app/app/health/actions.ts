"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerSession } from "@/lib/auth-session";
import { addHealthEntry } from "@/lib/health/service";
import { healthEntryTypes } from "@/lib/health/types";

const entrySchema = z.object({
  type: z.enum(healthEntryTypes),
  value: z.coerce.number().finite().nonnegative().max(1_000_000),
  unit: z.string().trim().min(1).max(24),
  recordedAt: z.coerce.date(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

export type HealthEntryActionResult =
  | { ok: true; entry: Awaited<ReturnType<typeof addHealthEntry>> }
  | { ok: false; error: string };

export async function createHealthEntryAction(
  input: z.input<typeof entrySchema>,
): Promise<HealthEntryActionResult> {
  const session = await getServerSession();
  if (!session?.user?.id) return { ok: false, error: "Please sign in again." };

  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check this health entry.",
    };
  }

  try {
    const entry = await addHealthEntry(session.user.id, {
      ...parsed.data,
      source: "manual",
    });
    revalidatePath("/app/health");
    return { ok: true, entry };
  } catch {
    console.error("Failed to create health entry");
    return { ok: false, error: "Could not save this entry. Try again." };
  }
}
