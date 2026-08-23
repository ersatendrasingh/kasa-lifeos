import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModuleScreen } from "@/components/app/module-screen";
import { ResponsibilitiesScreen } from "@/components/app/responsibilities-screen";
import { getProductModule, productModules } from "@/lib/app-navigation";

type ModulePageProps = { params: Promise<{ module: string }> };

export function generateStaticParams() {
  /*
   * life-vault is excluded: it has its own route at app/app/life-vault with a
   * real implementation. A static route always wins over a dynamic segment, so
   * generating a param for it would only pre-render a placeholder that is never
   * served.
   */
  return productModules
    .filter((module) => module.slug !== "life-vault")
    .map((module) => ({ module: module.slug }));
}

export async function generateMetadata({
  params,
}: ModulePageProps): Promise<Metadata> {
  const { module: slug } = await params;
  const productModule = getProductModule(slug);
  if (!productModule) return {};
  return {
    title: productModule.name,
    description: productModule.description,
  };
}

export default async function ProductModulePage({ params }: ModulePageProps) {
  const { module: slug } = await params;
  const productModule = getProductModule(slug);
  if (!productModule) notFound();

  /*
   * Keyed by slug so React remounts on every module change instead of reusing
   * the existing node. A CSS enter animation on a reused DOM node never
   * restarts, so without this the transition would vanish between modules.
   */
  if (slug === "renewals") return <ResponsibilitiesScreen />;
  return <ModuleScreen key={slug} module={productModule} />;
}
