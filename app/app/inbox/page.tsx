import type { Metadata } from "next";

import { BrainDumpScreen } from "@/components/app/brain-dump-screen";
import { getServerSession } from "@/lib/auth-session";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Smart Inbox",
  description: "Capture anything and let KASA organize it.",
};

export default async function SmartInboxPage() {
  const session = await getServerSession();
  const userId = session?.user?.id;
  const captures = userId
    ? await db.capture.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          rawText: true,
          category: true,
          confidence: true,
          classifier: true,
          source: true,
          createdAt: true,
        },
      })
    : [];

  const recentCaptures = captures.map((capture) => ({
    id: capture.id,
    text: capture.rawText,
    category: capture.category,
    confidence: capture.confidence,
    classifier: capture.classifier,
    source: capture.source,
    createdAtLabel: new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    }).format(capture.createdAt),
  }));

  return <BrainDumpScreen isAuthenticated captures={recentCaptures} />;
}
