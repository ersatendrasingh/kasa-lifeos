import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModuleScreen } from "@/components/app/module-screen";
import { getProductModule, productModules } from "@/lib/app-navigation";

type ModulePageProps = { params: Promise<{ module: string }> };

export function generateStaticParams() {
  return productModules.map((module) => ({ module: module.slug }));
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

  return <ModuleScreen module={productModule} />;
}
