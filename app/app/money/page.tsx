import type { Metadata } from "next";
import { MoneyWorkspace } from "@/components/app/money-workspace";
export const metadata: Metadata = {
  title: "Money",
  description: "Private spending and contact-based khata.",
};
export default function MoneyPage() {
  return <MoneyWorkspace />;
}
