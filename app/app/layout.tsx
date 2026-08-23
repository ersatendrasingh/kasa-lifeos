import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { getServerSession } from "@/lib/auth-session";

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/sign-in");
  return <AppShell user={session.user}>{children}</AppShell>;
}
