"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Camera,
  Check,
  ChevronDown,
  FileImage,
  FileText,
  Filter,
  FolderOpen,
  Image as ImageIcon,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";

import { DocumentViewer } from "@/components/vault/document-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  documentCategories,
  resolveDocumentCategory,
} from "@/lib/documents/categories";
import { cn } from "@/lib/utils";

export type VaultDocument = {
  id: string;
  title: string;
  categorySlug: string;
  kind: string;
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

type VaultScreenProps = {
  initial: {
    total: number;
    recent: VaultDocument[];
    favorites: VaultDocument[];
    expiringSoon: VaultDocument[];
    counts: Record<string, number>;
    schemaMissing: boolean;
    customCategories: Array<{ slug: string; label: string }>;
  };
};

type Filters = {
  category: string | null;
  favorites: boolean;
  kind: "IMAGE" | "PDF" | null;
  expiry: "upcoming" | "expired" | "none" | null;
  sort: "updated" | "created" | "title" | "expiry";
};

const emptyFilters: Filters = {
  category: null,
  favorites: false,
  kind: null,
  expiry: null,
  sort: "updated",
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(value: string) {
  return Math.ceil(
    (new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
}

function isUpcoming(document: VaultDocument) {
  if (!document.expiresAt) return false;
  const days = daysUntil(document.expiresAt);
  return days >= 0 && days <= 90;
}

function DocumentCard({
  document,
  customLabels,
  onOpen,
  onToggleFavorite,
  onDelete,
}: {
  document: VaultDocument;
  customLabels: Map<string, string>;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const category = resolveDocumentCategory(document.categorySlug, customLabels);
  const Icon = document.kind === "PDF" ? FileText : FileImage;
  const expiry = document.expiresAt ? daysUntil(document.expiresAt) : null;

  return (
    <article className="surface-glass group relative overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus-visible:outline-none"
        aria-label={`Open ${document.title}`}
      >
        <div className="flex items-start gap-3 pr-8">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              category.accent,
            )}
          >
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">
                {document.title}
              </span>
              {document.favorite ? (
                <Star className="fill-warning text-warning size-3.5 shrink-0" />
              ) : null}
            </span>
            <span className="text-muted-foreground mt-1 block truncate text-xs">
              {category.label}
              {document.idNumberMasked ? ` · ${document.idNumberMasked}` : ""}
            </span>
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">Tap to preview</span>
          {expiry !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.68rem] font-semibold",
                expiry < 0
                  ? "bg-danger-soft text-danger"
                  : expiry <= 30
                    ? "bg-warning-soft text-warning"
                    : "bg-info-soft text-info",
              )}
            >
              <TriangleAlert className="size-3" />
              {expiry < 0
                ? `Expired ${formatDate(document.expiresAt)}`
                : `${expiry}d left`}
            </span>
          ) : null}
        </div>
      </button>
      <div className="absolute top-3 right-3 flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={document.favorite ? "Remove favourite" : "Add favourite"}
          onClick={onToggleFavorite}
        >
          <Star
            className={cn(
              "size-4",
              document.favorite ? "fill-warning text-warning" : "",
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete document"
          className="text-muted-foreground hover:text-danger opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background/70 text-muted-foreground hover:border-primary/35 hover:text-foreground",
      )}
    >
      {active ? <Check className="size-3.5" /> : null}
      {children}
    </button>
  );
}

export function VaultScreen({ initial }: VaultScreenProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [results, setResults] = useState<VaultDocument[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState(initial.recent);
  const [expiringSoon, setExpiringSoon] = useState(initial.expiringSoon);
  const [total, setTotal] = useState(initial.total);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [viewing, setViewing] = useState<VaultDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const customLabels = useMemo(
    () =>
      new Map(initial.customCategories.map(({ slug, label }) => [slug, label])),
    [initial.customCategories],
  );
  const hasFilters =
    filters.category !== null ||
    filters.favorites ||
    filters.kind !== null ||
    filters.expiry !== null ||
    filters.sort !== "updated";
  const searchActive = query.trim().length > 0 || hasFilters;
  // Results from a previous search stay in memory, but are never rendered once
  // the query and filters are cleared.
  const visibleResults = searchActive ? results : null;

  const refresh = useCallback(async () => {
    const response = await fetch("/api/documents");
    if (!response.ok) return;
    const { documents } = (await response.json()) as {
      documents: VaultDocument[];
    };
    setTotal(documents.length);
    setRecent(documents.slice(0, 8));
    setExpiringSoon(documents.filter(isUpcoming).slice(0, 6));
  }, []);

  useEffect(() => {
    if (!searchActive) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setSearching(true);
        try {
          const params = new URLSearchParams();
          if (query.trim()) params.set("q", query.trim());
          if (filters.category) params.set("category", filters.category);
          if (filters.favorites) params.set("favorites", "true");
          if (filters.kind) params.set("kind", filters.kind);
          if (filters.expiry) params.set("expiry", filters.expiry);
          if (filters.sort !== "updated") params.set("sort", filters.sort);
          const response = await fetch(`/api/documents?${params}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Search failed");
          const data = (await response.json()) as {
            documents: VaultDocument[];
          };
          setResults(data.documents);
        } catch (error) {
          if ((error as Error).name !== "AbortError") {
            setUploadNote("Could not refresh results. Please try again.");
          }
        } finally {
          setSearching(false);
        }
      },
      query.trim() ? 220 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, query, searchActive]);

  function resetSearch() {
    setQuery("");
    setFilters(emptyFilters);
    setShowAdvanced(false);
  }

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadNote(null);
    try {
      const body = new FormData();
      body.set("file", file);
      if (filters.category) body.set("categorySlug", filters.category);
      const response = await fetch("/api/documents", { method: "POST", body });
      const data = (await response.json()) as {
        document?: VaultDocument;
        extraction?: { aiUsed: boolean };
        error?: string;
      };
      if (!response.ok || !data.document) {
        setUploadNote(data.error ?? "Could not save this document");
        return;
      }
      setUploadNote(
        data.extraction?.aiUsed
          ? `Saved “${data.document.title}” and extracted its details.`
          : `Saved “${data.document.title}”. You can find it anytime.`,
      );
      setTotal((value) => value + 1);
      setRecent((items) => [data.document!, ...items].slice(0, 8));
      if (isUpcoming(data.document)) {
        setExpiringSoon((items) => [data.document!, ...items].slice(0, 6));
      }
      void refresh();
    } catch {
      setUploadNote("Could not save this document. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleFavorite(target: VaultDocument) {
    const favorite = !target.favorite;
    const apply = (items: VaultDocument[]) =>
      items.map((item) =>
        item.id === target.id ? { ...item, favorite } : item,
      );
    setRecent(apply);
    setResults((items) => (items ? apply(items) : items));
    try {
      const response = await fetch(`/api/documents/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite }),
      });
      if (!response.ok) throw new Error("Update failed");
    } catch {
      setUploadNote("Could not update favourite. Please try again.");
      void refresh();
    }
  }

  async function remove(target: VaultDocument) {
    if (
      !window.confirm(
        `Delete “${target.title}”? This permanently removes the file.`,
      )
    ) {
      return;
    }
    const drop = (items: VaultDocument[]) =>
      items.filter((item) => item.id !== target.id);
    setRecent(drop);
    setExpiringSoon(drop);
    setResults((items) => (items ? drop(items) : items));
    try {
      const response = await fetch(`/api/documents/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");
      setTotal((value) => Math.max(0, value - 1));
    } catch {
      setUploadNote("Could not delete this document. Please try again.");
      void refresh();
    }
  }

  const cards = (documents: VaultDocument[]) => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          customLabels={customLabels}
          onOpen={() => setViewing(document)}
          onToggleFavorite={() => void toggleFavorite(document)}
          onDelete={() => void remove(document)}
        />
      ))}
    </div>
  );

  return (
    <main className="route-content-enter relative pb-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="ambient-glow absolute top-0 left-0 size-[36rem] max-w-full" />
      </div>

      <section className="flex flex-col gap-4 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm font-medium">
            Life Vault
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            Your important documents, ready when you are.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
            Search by document name, nickname, tag, or last four digits.
          </p>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <ShieldCheck className="text-positive size-4" />
          Private and encrypted
        </div>
      </section>

      <section className="surface-glass rounded-3xl border p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-4 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search passport, DL, Aadhaar, 1234…"
              aria-label="Search documents"
              className="bg-background/80 h-12 rounded-2xl pr-20 pl-11 text-base shadow-none"
            />
            {searching ? (
              <Spinner className="text-brand absolute top-1/2 right-11 size-4 -translate-y-1/2" />
            ) : null}
            {query ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2"
                onClick={() => setQuery("")}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          <Button
            variant="outline"
            className={cn(
              "h-12 rounded-2xl",
              showAdvanced && "border-primary bg-primary/5 text-primary",
            )}
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((value) => !value)}
          >
            <Filter /> Filters
            {hasFilters ? " active" : ""}
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                showAdvanced && "rotate-180",
              )}
            />
          </Button>
          <Button
            className="h-12 rounded-2xl"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Spinner /> : <Upload />}
            Add document
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-3">
          <FilterChip
            active={filters.favorites}
            onClick={() =>
              setFilters((value) => ({
                ...value,
                favorites: !value.favorites,
              }))
            }
          >
            <Star className="size-3.5" /> Favourites
          </FilterChip>
          <FilterChip
            active={filters.expiry === "upcoming"}
            onClick={() =>
              setFilters((value) => ({
                ...value,
                expiry: value.expiry === "upcoming" ? null : "upcoming",
              }))
            }
          >
            <TriangleAlert className="size-3.5" /> Expiring soon
          </FilterChip>
          <FilterChip
            active={filters.kind === "PDF"}
            onClick={() =>
              setFilters((value) => ({
                ...value,
                kind: value.kind === "PDF" ? null : "PDF",
              }))
            }
          >
            <FileText className="size-3.5" /> PDFs
          </FilterChip>
          {hasFilters || query ? (
            <button
              type="button"
              onClick={resetSearch}
              className="text-muted-foreground hover:text-foreground px-2 text-sm font-medium"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {showAdvanced ? (
          <div className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Category
              </p>
              <div className="flex flex-wrap gap-2">
                {documentCategories.map((category) => (
                  <FilterChip
                    key={category.slug}
                    active={filters.category === category.slug}
                    onClick={() =>
                      setFilters((value) => ({
                        ...value,
                        category:
                          value.category === category.slug
                            ? null
                            : category.slug,
                      }))
                    }
                  >
                    {category.label}
                    {initial.counts[category.slug] ? (
                      <span className="opacity-70">
                        {initial.counts[category.slug]}
                      </span>
                    ) : null}
                  </FilterChip>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <label className="text-muted-foreground grid gap-1.5 text-xs font-semibold tracking-wide uppercase">
                File type
                <select
                  value={filters.kind ?? ""}
                  onChange={(event) =>
                    setFilters((value) => ({
                      ...value,
                      kind:
                        event.target.value === "IMAGE" ||
                        event.target.value === "PDF"
                          ? event.target.value
                          : null,
                    }))
                  }
                  className="border-input bg-background text-foreground focus:border-primary h-10 rounded-xl border px-3 text-sm font-medium normal-case outline-none"
                >
                  <option value="">All files</option>
                  <option value="IMAGE">Images</option>
                  <option value="PDF">PDFs</option>
                </select>
              </label>
              <label className="text-muted-foreground grid gap-1.5 text-xs font-semibold tracking-wide uppercase">
                Sort by
                <select
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((value) => ({
                      ...value,
                      sort: event.target.value as Filters["sort"],
                    }))
                  }
                  className="border-input bg-background text-foreground focus:border-primary h-10 rounded-xl border px-3 text-sm font-medium normal-case outline-none"
                >
                  <option value="updated">Recently updated</option>
                  <option value="created">Recently added</option>
                  <option value="title">Name A–Z</option>
                  <option value="expiry">Expiry date</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      <section className="flex flex-wrap items-center gap-2 py-4">
        <Button
          variant="ghost"
          size="sm"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera /> Scan with camera
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={uploading}
          onClick={() => pdfInputRef.current?.click()}
        >
          <FileText /> Upload a PDF
        </Button>
        {uploadNote ? (
          <p className="text-muted-foreground ml-1 flex items-center gap-1.5 text-xs">
            <Sparkles className="text-brand size-3.5" /> {uploadNote}
          </p>
        ) : null}
      </section>

      {initial.schemaMissing ? (
        <section className="surface-glass rounded-3xl border p-10 text-center">
          <TriangleAlert className="text-warning mx-auto size-7" />
          <h2 className="mt-4 text-lg font-semibold">
            Life Vault is being set up
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            The document database is not ready yet. Apply the migration and
            refresh this page.
          </p>
        </section>
      ) : searchActive ? (
        <section className="pt-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {searching && visibleResults === null
                ? "Finding documents…"
                : `${visibleResults?.length ?? 0} result${visibleResults?.length === 1 ? "" : "s"}`}
            </h2>
            {filters.category ? (
              <span className="text-muted-foreground text-sm">
                in{" "}
                {resolveDocumentCategory(filters.category, customLabels).label}
              </span>
            ) : null}
          </div>
          {visibleResults && visibleResults.length > 0 ? (
            cards(visibleResults)
          ) : !searching ? (
            <div className="surface-glass rounded-3xl border px-6 py-12 text-center">
              <FolderOpen className="text-muted-foreground mx-auto size-8" />
              <h3 className="mt-4 text-base font-semibold">
                No documents match these filters
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Try a different keyword, remove a filter, or add a new document.
              </p>
              <Button variant="outline" className="mt-5" onClick={resetSearch}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </section>
      ) : total === 0 ? (
        <section className="surface-glass rounded-3xl border px-6 py-12 text-center">
          <span className="bg-brand-soft text-brand mx-auto flex size-14 items-center justify-center rounded-2xl">
            <Upload className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">
            Start your secure document vault
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            Add an Aadhaar, PAN, passport, insurance policy, or any important
            record. We’ll organize it so it is easy to find later.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => cameraInputRef.current?.click()}>
              <Camera /> Scan a document
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon /> Upload from device
            </Button>
          </div>
        </section>
      ) : (
        <div className="space-y-8 pt-3">
          {expiringSoon.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="bg-warning-soft text-warning flex size-7 items-center justify-center rounded-lg">
                  <TriangleAlert className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">Needs attention</h2>
                  <p className="text-muted-foreground text-xs">
                    Documents expiring in the next 90 days
                  </p>
                </div>
              </div>
              {cards(expiringSoon)}
            </section>
          ) : null}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Recently added</h2>
                <p className="text-muted-foreground text-xs">
                  Your latest documents, ready to preview
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(true)}
              >
                <ArrowDownUp /> Browse all
              </Button>
            </div>
            {cards(recent)}
          </section>
        </div>
      )}

      {viewing ? (
        <DocumentViewer
          documentId={viewing.id}
          title={viewing.title}
          mimeType={viewing.mimeType}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </main>
  );
}
