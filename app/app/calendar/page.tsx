import type { Metadata } from "next";

import { CalendarScreen } from "@/components/app/calendar-screen";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Plans, tasks, reminders and renewals in one calm view.",
};

export default function CalendarPage() {
  return <CalendarScreen />;
}
