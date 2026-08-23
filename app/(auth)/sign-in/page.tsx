import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getServerSession } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in securely to your personal KASA Life OS.",
};

export default async function SignInPage() {
  const session = await getServerSession();
  if (session?.user) redirect("/app");
  return <AuthScreen intent="SIGN_IN" />;
}
