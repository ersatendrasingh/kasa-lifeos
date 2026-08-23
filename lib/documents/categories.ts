import {
  Archive,
  Briefcase,
  Car,
  GraduationCap,
  Home,
  IdCard,
  Landmark,
  Plane,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

/*
 * Life Vault categories.
 *
 * Flat and fixed on purpose. The module's goal is finding any document within
 * 30 seconds, and nested folders work against that — every extra level is
 * another decision at save time and another guess at find time. Categories are
 * a coarse filter; search does the real work.
 *
 * Slugs are the contract shared with the database (`Document.categorySlug`),
 * the AI extraction prompt, and the mobile app, so they must stay stable.
 */
export type DocumentCategoryDefinition = {
  slug: string;
  label: string;
  /// Shown in the picker to make the choice obvious without reading docs.
  hint: string;
  icon: LucideIcon;
  /// Reuses the semantic accent tokens from globals.css.
  accent: string;
};

export const documentCategories: DocumentCategoryDefinition[] = [
  {
    slug: "identity",
    label: "Identity",
    hint: "Aadhaar, PAN, passport, licence",
    icon: IdCard,
    accent: "bg-brand-soft text-brand",
  },
  {
    slug: "financial",
    label: "Financial",
    hint: "Bank, tax, insurance, investments",
    icon: Landmark,
    accent: "bg-positive-soft text-positive",
  },
  {
    slug: "vehicle",
    label: "Vehicle",
    hint: "RC, insurance, PUC, service",
    icon: Car,
    accent: "bg-warning-soft text-warning",
  },
  {
    slug: "medical",
    label: "Medical",
    hint: "Reports, prescriptions, health cover",
    icon: Stethoscope,
    accent: "bg-danger-soft text-danger",
  },
  {
    slug: "education",
    label: "Education",
    hint: "Degrees, marksheets, certificates",
    icon: GraduationCap,
    accent: "bg-info-soft text-info",
  },
  {
    slug: "employment",
    label: "Employment",
    hint: "Offer letters, payslips, contracts",
    icon: Briefcase,
    accent: "bg-info-soft text-info",
  },
  {
    slug: "property",
    label: "Property",
    hint: "Deeds, rent agreements, bills",
    icon: Home,
    accent: "bg-warning-soft text-warning",
  },
  {
    slug: "travel",
    label: "Travel",
    hint: "Visas, tickets, bookings",
    icon: Plane,
    accent: "bg-brand-soft text-brand",
  },
  {
    slug: "others",
    label: "Others",
    hint: "Anything that does not fit yet",
    icon: Archive,
    accent: "bg-surface-soft text-muted-foreground",
  },
];

export const documentCategorySlugs = documentCategories.map(
  (category) => category.slug,
);

const categoriesBySlug = new Map(
  documentCategories.map((category) => [category.slug, category]),
);

export function getDocumentCategory(slug: string) {
  return categoriesBySlug.get(slug);
}

/*
 * Resolves any category slug to something displayable, including the custom
 * categories a user creates. Custom slugs have no icon or accent of their own,
 * so they inherit the neutral "others" styling and show their stored label.
 */
export function resolveDocumentCategory(
  slug: string,
  customLabels?: Map<string, string>,
): DocumentCategoryDefinition {
  const builtIn = categoriesBySlug.get(slug);
  if (builtIn) return builtIn;

  const fallback = categoriesBySlug.get("others")!;
  return {
    ...fallback,
    slug,
    label: customLabels?.get(slug) ?? humanizeSlug(slug),
    hint: "Your category",
  };
}

export function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

/*
 * Normalises a user-entered category name into a slug. Kept here so the web
 * form, the API and the mobile app all derive identical slugs for the same
 * input — otherwise "Pet Records" and "pet records" become two categories.
 */
export function toCategorySlug(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
