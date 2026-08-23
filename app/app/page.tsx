import type { Metadata } from "next";

import { MainScreen } from "@/components/app/main-screen";
import { getServerSession } from "@/lib/auth-session";
import { getMainScreenData } from "@/lib/main-screen-data";

export const metadata: Metadata = {
  title: "Today",
  description: "Your personalized daily view in KASA.",
};

export default async function AppMainPage() {
  const session = await getServerSession();
  const data = await getMainScreenData(session?.user);

  return <MainScreen initialData={data} />;
}
