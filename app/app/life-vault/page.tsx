import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VaultScreen } from "@/components/vault/vault-screen";
import { getServerSession } from "@/lib/auth-session";
import { getVaultOverview } from "@/lib/documents/service";

export const metadata: Metadata = {
  title: "Life Vault",
  description:
    "Every important document, findable in seconds. KASA reads and files each one for you.",
};

export default async function LifeVaultPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/sign-in");

  const overview = await getVaultOverview(session.user.id);

  /*
   * Dates and Maps are serialised for the client component: Prisma returns Date
   * objects and this layer returns a Map, neither of which survives the RSC
   * boundary as the plain shapes the UI expects.
   */
  const serialise = (documents: typeof overview.recent) =>
    documents.map((document) => ({
      ...document,
      issuedOn: document.issuedOn?.toISOString() ?? null,
      expiresAt: document.expiresAt?.toISOString() ?? null,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    }));

  return (
    <VaultScreen
      initial={{
        total: overview.total,
        recent: serialise(overview.recent),
        favorites: serialise(overview.favorites),
        expiringSoon: serialise(overview.expiringSoon),
        counts: Object.fromEntries(overview.counts),
        schemaMissing: overview.schemaMissing,
        customCategories: overview.customCategories.map(({ slug, label }) => ({
          slug,
          label,
        })),
      }}
    />
  );
}
