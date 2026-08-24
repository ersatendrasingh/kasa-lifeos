import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TimelineEventType } from "../app/generated/prisma/client";

const sourceType = "dev-timeline-seed-2026";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const moments: Array<{ type: TimelineEventType; title: string; summary: string }> = [
  { type: "CAREER", title: "Career planning session", summary: "Mapped the next role, core skills to build, and the first small move for the quarter." },
  { type: "HEALTH", title: "Health check-in recorded", summary: "Logged weight, sleep and movement to keep the bigger wellness pattern visible." },
  { type: "RELATIONSHIP", title: "Family dinner together", summary: "Made time for a relaxed evening and caught up on the small things that matter." },
  { type: "FINANCE", title: "Monthly savings reviewed", summary: "Checked savings progress and adjusted the next month’s plan with more clarity." },
  { type: "LEARNING", title: "Learning milestone completed", summary: "Finished a focused learning block and noted the practical ideas worth applying." },
  { type: "ACHIEVEMENT", title: "A meaningful win", summary: "Paused to acknowledge progress instead of immediately moving on to the next thing." },
  { type: "NOTE", title: "Personal reflection saved", summary: "Captured an important decision, what led to it, and what to remember for later." },
  { type: "HOME", title: "Home life organised", summary: "Took care of an important household detail before it became urgent." },
  { type: "DOCUMENT_ADDED", title: "Important document secured", summary: "Added a record to Life Vault so the detail is easy to find when needed." },
  { type: "TASK_COMPLETED", title: "Priority task closed", summary: "Completed a meaningful commitment and cleared space for the next priority." },
];

function at(monthsAgo: number, day: number) {
  const date = new Date();
  date.setHours(11 + (monthsAgo % 6), 15, 0, 0);
  date.setDate(day);
  date.setMonth(date.getMonth() - monthsAgo);
  return date;
}

async function main() {
  const requestedUserId = process.argv.find((argument) => argument.startsWith("--user="))?.slice(7);
  const user = requestedUserId
    ? await db.user.findUnique({ where: { id: requestedUserId }, select: { id: true, name: true } })
    : await db.user.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true } });
  if (!user) throw new Error("No development user found. Pass --user=<id> to seed a specific user.");

  // Only previous records produced by this script are replaced; real history is untouched.
  await db.timelineEvent.deleteMany({ where: { userId: user.id, sourceType } });
  const entries = Array.from({ length: 52 }, (_, index) => {
    const moment = moments[index % moments.length];
    return {
      userId: user.id,
      type: moment.type,
      title: moment.title,
      summary: moment.summary,
      occurredAt: at(index, 3 + ((index * 7) % 23)),
      sourceType,
      metadata: { demo: true, timelineSeed: "2026", sequence: index + 1 },
    };
  });
  await db.timelineEvent.createMany({ data: entries });
  console.log(`Seeded ${entries.length} demo timeline moments for ${user.name}.`);
}

main().finally(() => db.$disconnect());
