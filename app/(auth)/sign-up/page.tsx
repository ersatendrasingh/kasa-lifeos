import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getServerSession } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "Create your KASA",
  description: "Create your private, personalized KASA Life OS.",
};

export default async function SignUpPage() {
  const session = await getServerSession();
  if (session?.user) redirect("/app");
  return <AuthScreen intent="SIGN_UP" />;
}
