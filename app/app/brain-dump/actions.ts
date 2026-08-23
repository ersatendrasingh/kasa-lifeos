"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { CaptureActionState } from "@/lib/brain-dump/action-state";
import { getServerSession } from "@/lib/auth-session";
import { createCaptureForUser } from "@/lib/brain-dump/service";

const captureSchema = z.object({
  text: z
    .string()
    .trim()
    .min(2, "Write at least two characters.")
    .max(2_000, "Keep one capture under 2,000 characters."),
  source: z.enum(["WEB", "VOICE"]).default("WEB"),
});

export async function createCaptureAction(
  _previousState: CaptureActionState,
  formData: FormData,
): Promise<CaptureActionState> {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return {
      status: "error",
      message: "Sign in to save and organize your Smart Inbox capture.",
    };
  }

  const parsed = captureSchema.safeParse({
    text: formData.get("text"),
    source: formData.get("source") || "WEB",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "That capture is not valid.",
    };
  }

  try {
    const result = await createCaptureForUser(
      session.user.id,
      parsed.data.text,
      parsed.data.source,
    );
    revalidatePath("/app/inbox");
    revalidatePath("/app/brain-dump");
    revalidatePath("/app");

    return {
      status: "success",
      message: result.classification.actionSummary,
      category: result.classification.category,
      confidence: result.classification.confidence,
      submissionId: result.capture.id,
      title: result.classification.title,
      actionSummary: result.classification.actionSummary,
      classifier: result.classification.classifier,
    };
  } catch {
    console.error("Failed to create Smart Inbox capture");
    return {
      status: "error",
      message: "Could not save this capture. Please try again.",
    };
  }
}
