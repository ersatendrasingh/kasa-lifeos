import { File } from "expo-file-system";

import { apiFetch } from "@/lib/api-client";

export type VaultDocument = {
  id: string;
  title: string;
  categorySlug: string;
  kind: "IMAGE" | "PDF" | string;
  mimeType: string;
  sizeBytes: number;
  originalFileName: string;
  tags: string[];
  aliases: string[];
  idNumberMasked: string | null;
  issuedOn: string | null;
  expiresAt: string | null;
  favorite: boolean;
  aiConfidence: number | null;
  createdAt: string;
  updatedAt: string;
};

export type VaultFilters = {
  query?: string;
  category?: string | null;
  favorites?: boolean;
  kind?: "IMAGE" | "PDF" | null;
  expiry?: "upcoming" | "expired" | "none" | null;
  sort?: "updated" | "created" | "title" | "expiry";
};

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

export async function listVaultDocuments(filters: VaultFilters = {}) {
  const params = new URLSearchParams();
  if (filters.query?.trim()) params.set("q", filters.query.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.favorites) params.set("favorites", "true");
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.expiry) params.set("expiry", filters.expiry);
  if (filters.sort && filters.sort !== "updated") {
    params.set("sort", filters.sort);
  }
  const suffix = params.size ? `?${params}` : "";
  const response = await apiFetch<{ documents: VaultDocument[] }>(
    `/api/documents${suffix}`,
  );
  throwIfError(response.error, "Could not load your documents");
  return response.data?.documents ?? [];
}

export async function uploadVaultDocument(input: {
  uri: string;
  fileName: string;
  mimeType: string;
  category?: string | null;
}) {
  const file = new File(input.uri);
  if (!file.exists || file.size === 0) {
    throw new Error("This file is empty or unavailable");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("Choose a file smaller than 25 MB");
  }
  const response = await apiFetch<{
    document: VaultDocument;
    extraction: { aiUsed: boolean };
  }>("/api/documents", {
    method: "POST",
    body: {
      fileName: input.fileName || file.name || "document",
      mimeType: input.mimeType || file.type || "application/octet-stream",
      fileData: await file.base64(),
      categorySlug: input.category ?? undefined,
    },
  });
  throwIfError(response.error, "Could not save this document");
  if (!response.data?.document)
    throw new Error("KASA did not save the document");
  return response.data;
}

export async function setVaultFavourite(id: string, favorite: boolean) {
  const response = await apiFetch<{ document: VaultDocument }>(
    `/api/documents/${id}`,
    { method: "PATCH", body: { favorite } },
  );
  throwIfError(response.error, "Could not update this document");
  return response.data?.document;
}

export async function deleteVaultDocument(id: string) {
  const response = await apiFetch(`/api/documents/${id}`, {
    method: "DELETE",
  });
  throwIfError(response.error, "Could not delete this document");
}

export async function vaultDocumentUrl(id: string) {
  const response = await apiFetch<{ url: string }>(`/api/documents/${id}/url`);
  throwIfError(response.error, "Could not open this document");
  if (!response.data?.url) throw new Error("Document link is unavailable");
  return response.data.url;
}
