import { redirect } from "next/navigation";

export default async function BrainDumpPage() {
  redirect("/app/inbox");
}
