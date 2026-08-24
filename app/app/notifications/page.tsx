import type { Metadata } from "next";

import { NotificationsWorkspace } from "@/components/app/notifications-workspace";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your KASA reminders and updates.",
};

export default function NotificationsPage() {
  return <NotificationsWorkspace />;
}
