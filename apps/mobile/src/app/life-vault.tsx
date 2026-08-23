import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { SymbolView } from "expo-symbols";
import * as WebBrowser from "expo-web-browser";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CompactNavDock } from "@/components/compact-nav-dock";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  deleteVaultDocument,
  listVaultDocuments,
  setVaultFavourite,
  uploadVaultDocument,
  vaultDocumentUrl,
  type VaultDocument,
  type VaultFilters,
} from "@/lib/documents";

const categories = [
  ["identity", "Identity", "person.text.rectangle", "#5B7CFA"],
  ["financial", "Financial", "indianrupeesign.circle", "#159B62"],
  ["vehicle", "Vehicle", "car.fill", "#D47A00"],
  ["medical", "Medical", "cross.case.fill", "#E8527A"],
  ["education", "Education", "graduationcap.fill", "#7251D5"],
  ["employment", "Work", "briefcase.fill", "#1484C8"],
  ["property", "Property", "house.fill", "#A66716"],
  ["travel", "Travel", "airplane", "#5B7CFA"],
  ["others", "Others", "square.grid.2x2.fill", "#826E65"],
] as const;

const emptyFilters: VaultFilters = { sort: "updated" };

type PendingUpload = {
  uri: string;
  name: string;
  mimeType: string;
  source: "scan" | "photo" | "file";
  width?: number;
  height?: number;
};

function daysUntil(value: string) {
  return Math.ceil(
    (new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
}

function expiryLabel(document: VaultDocument) {
  if (!document.expiresAt) return null;
  const days = daysUntil(document.expiresAt);
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  return `${days}d left`;
}

function categoryFor(slug: string) {
  return categories.find(([key]) => key === slug) ?? categories[8];
}

function addedLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function LifeVaultScreen() {
  const c = useTheme();
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<VaultFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [preview, setPreview] = useState<{
    document: VaultDocument;
    url: string | null;
  } | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(
    null,
  );
  const [cropOpen, setCropOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VaultDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeFilters = useMemo(
    () =>
      Boolean(
        filters.category ||
        filters.favorites ||
        filters.kind ||
        filters.expiry ||
        filters.sort !== "updated",
      ),
    [filters],
  );

  async function load(nextFilters = filters, nextQuery = query) {
    const items = await listVaultDocuments({
      ...nextFilters,
      query: nextQuery,
    });
    setDocuments(items);
  }

  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        void listVaultDocuments({ ...filters, query })
          .then((items) => active && setDocuments(items))
          .catch(
            (error) =>
              active &&
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Could not load Life Vault",
              ),
          )
          .finally(() => active && setLoading(false));
      },
      query.trim() ? 220 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, query]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
      DeviceEventEmitter.emit("kasa:calendar-updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveFile(input: {
    uri: string;
    name: string;
    mimeType: string;
  }) {
    setUploading(true);
    setMessage(null);
    try {
      const saved = await uploadVaultDocument({
        ...input,
        fileName: input.name,
        category: filters.category,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage(
        saved.extraction.aiUsed
          ? `Saved “${saved.document.title}” and read its details.`
          : `Saved “${saved.document.title}”.`,
      );
      await load();
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save this document",
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function normalizeImage(uri: string, rotate = 0) {
    return manipulateAsync(
      uri,
      [...(rotate ? [{ rotate }] : []), { resize: { width: 2200 } }],
      { compress: 0.9, format: SaveFormat.JPEG },
    );
  }

  async function prepareImage(
    uri: string,
    name: string,
    source: PendingUpload["source"],
  ) {
    const image = await normalizeImage(uri);
    setPendingUpload({
      uri: image.uri,
      name: `${name.replace(/\.[^.]+$/, "")}.jpg`,
      mimeType: "image/jpeg",
      source,
      width: image.width,
      height: image.height,
    });
  }

  async function scanWithCamera() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Camera access needed",
          "Allow camera access to scan and securely save a document.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: true,
        aspect: [3, 4],
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      await prepareImage(asset.uri, "kasa-document-scan.jpg", "scan");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Camera could not open",
      );
    }
  }

  async function choosePhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: true,
        aspect: [3, 4],
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      await prepareImage(
        asset.uri,
        asset.fileName ?? "kasa-photo.jpg",
        "photo",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Photos could not open",
      );
    }
  }

  async function chooseFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      if (asset.mimeType?.startsWith("image/")) {
        await prepareImage(asset.uri, asset.name, "file");
        return;
      }
      setPendingUpload({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/pdf",
        source: "file",
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "File picker could not open",
      );
    }
  }

  async function openDocument(document: VaultDocument) {
    setPreview({ document, url: null });
    try {
      const url = await vaultDocumentUrl(document.id);
      setPreview({ document, url });
    } catch (error) {
      setPreview(null);
      setMessage(
        error instanceof Error ? error.message : "Could not open document",
      );
    }
  }

  async function rotatePendingUpload() {
    if (!pendingUpload?.mimeType.startsWith("image/")) return;
    try {
      const image = await normalizeImage(pendingUpload.uri, 90);
      setPendingUpload((current) =>
        current
          ? {
              ...current,
              uri: image.uri,
              width: image.width,
              height: image.height,
            }
          : current,
      );
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not rotate image",
      );
    }
  }

  async function cropPendingUpload(crop: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  }) {
    if (!pendingUpload) return;
    try {
      const image = await manipulateAsync(pendingUpload.uri, [{ crop }], {
        compress: 0.9,
        format: SaveFormat.JPEG,
      });
      setPendingUpload((current) =>
        current
          ? {
              ...current,
              uri: image.uri,
              width: image.width,
              height: image.height,
            }
          : current,
      );
      setCropOpen(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not crop image",
      );
    }
  }

  async function sharePreview() {
    if (!preview?.url) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device");
      }
      const extension =
        preview.document.mimeType === "application/pdf" ? "pdf" : "jpg";
      const destination = new File(
        Paths.cache,
        `kasa-${preview.document.id}.${extension}`,
      );
      const file = await File.downloadFileAsync(preview.url, destination, {
        idempotent: true,
      });
      await Sharing.shareAsync(file.uri, {
        mimeType: preview.document.mimeType,
        dialogTitle: `Share ${preview.document.title}`,
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not share document",
      );
    } finally {
      setSharing(false);
    }
  }

  async function toggleFavorite(document: VaultDocument) {
    const favorite = !document.favorite;
    setDocuments((items) =>
      items.map((item) =>
        item.id === document.id ? { ...item, favorite } : item,
      ),
    );
    try {
      await setVaultFavourite(document.id, favorite);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update favourite",
      );
      void refresh();
    }
  }

  async function deleteDocument(document: VaultDocument) {
    setDeletingId(document.id);
    try {
      await deleteVaultDocument(document.id);
      setDocuments((items) => items.filter((item) => item.id !== document.id));
      DeviceEventEmitter.emit("kasa:calendar-updated");
      setDeleteTarget(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not delete document",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function updateFilters(change: Partial<VaultFilters>) {
    setFilters((current) => ({ ...current, ...change }));
  }

  const category = filters.category ? categoryFor(filters.category) : null;
  const filteredEmpty =
    !loading && documents.length === 0 && (activeFilters || query.trim());

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={c.brand}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <AppHeader label="Life Vault" />
          <View style={s.headingRow}>
            <View style={s.headingCopy}>
              <Text style={[s.eyebrow, { color: c.brand }]}>
                YOUR PRIVATE VAULT
              </Text>
              {__DEV__ ? (
                <Text style={[s.devBuild, { color: c.textSecondary }]}>
                  LIVE DEVELOPMENT BUILD
                </Text>
              ) : null}
              <Text style={[s.title, { color: c.text }]}>
                Everything important, in your pocket.
              </Text>
              <Text style={[s.subtitle, { color: c.textSecondary }]}>
                Find, preview, and protect your documents in seconds.
              </Text>
            </View>
            <View style={[s.lock, { backgroundColor: c.brandSoft }]}>
              <SymbolView name="lock.fill" size={18} tintColor={c.brand} />
            </View>
          </View>

          <View
            style={[
              s.search,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView
              name="magnifyingglass"
              size={18}
              tintColor={c.textSecondary}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, tag, or last 4 digits"
              placeholderTextColor={c.textSecondary}
              style={[s.searchInput, { color: c.text }]}
            />
            {query ? (
              <Pressable
                accessibilityLabel="Clear search"
                onPress={() => setQuery("")}
                hitSlop={10}
              >
                <SymbolView
                  name="xmark.circle.fill"
                  size={18}
                  tintColor={c.textSecondary}
                />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRow}
          >
            <Pill
              label="Filters"
              icon="slider.horizontal.3"
              active={activeFilters}
              onPress={() => setFilterOpen(true)}
              colors={c}
            />
            <Pill
              label="Favourites"
              icon="star.fill"
              active={Boolean(filters.favorites)}
              onPress={() => updateFilters({ favorites: !filters.favorites })}
              colors={c}
            />
            <Pill
              label="Expiring soon"
              icon="exclamationmark.triangle.fill"
              active={filters.expiry === "upcoming"}
              onPress={() =>
                updateFilters({
                  expiry: filters.expiry === "upcoming" ? null : "upcoming",
                })
              }
              colors={c}
            />
            <Pill
              label="PDFs"
              icon="doc.fill"
              active={filters.kind === "PDF"}
              onPress={() =>
                updateFilters({ kind: filters.kind === "PDF" ? null : "PDF" })
              }
              colors={c}
            />
          </ScrollView>

          {category ? (
            <View style={[s.activeFilter, { backgroundColor: c.brandSoft }]}>
              <Text style={[s.activeFilterText, { color: c.brand }]}>
                Showing {category[1]}
              </Text>
              <Pressable onPress={() => updateFilters({ category: null })}>
                <SymbolView name="xmark" size={13} tintColor={c.brand} />
              </Pressable>
            </View>
          ) : null}

          <View style={s.captureRow}>
            <Pressable
              onPress={() => void scanWithCamera()}
              disabled={uploading}
              style={({ pressed }) => [
                s.primaryCapture,
                {
                  backgroundColor: c.brand,
                  opacity: pressed || uploading ? 0.72 : 1,
                },
              ]}
            >
              {uploading ? (
                <KasaSpinner size={18} color="#FFFFFF" />
              ) : (
                <>
                  <SymbolView
                    name="camera.fill"
                    size={18}
                    tintColor="#FFFFFF"
                  />
                  <Text style={s.primaryCaptureText}>Scan</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={() => void choosePhoto()}
              disabled={uploading}
              style={({ pressed }) => [
                s.secondaryCapture,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  opacity: pressed || uploading ? 0.72 : 1,
                },
              ]}
            >
              <SymbolView
                name="photo.on.rectangle"
                size={17}
                tintColor={c.text}
              />
              <Text style={[s.secondaryCaptureText, { color: c.text }]}>
                Photos
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void chooseFile()}
              disabled={uploading}
              style={({ pressed }) => [
                s.iconCapture,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  opacity: pressed || uploading ? 0.72 : 1,
                },
              ]}
              accessibilityLabel="Upload PDF or file"
            >
              <SymbolView name="doc.badge.plus" size={17} tintColor={c.text} />
            </Pressable>
          </View>
          {message ? (
            <View
              style={[
                s.message,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="sparkles" size={14} tintColor={c.brand} />
              <Text style={[s.messageText, { color: c.textSecondary }]}>
                {message}
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View style={s.loading}>
              <KasaSpinner size={28} />
              <Text style={[s.loadingText, { color: c.textSecondary }]}>
                Loading your vault…
              </Text>
            </View>
          ) : filteredEmpty ? (
            <EmptyState
              title="Nothing matches yet"
              detail="Try a different word or clear one of your filters."
              action="Clear filters"
              onPress={() => {
                setQuery("");
                setFilters(emptyFilters);
              }}
              colors={c}
            />
          ) : documents.length === 0 ? (
            <EmptyState
              title="Your vault is ready"
              detail="Scan your Aadhaar, PAN, passport, insurance or any important record. KASA will organize it for you."
              action="Scan first document"
              onPress={() => void scanWithCamera()}
              colors={c}
            />
          ) : (
            <>
              <View style={s.sectionHead}>
                <View>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    {activeFilters || query ? "Results" : "Your documents"}
                  </Text>
                  <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                    {documents.length} document
                    {documents.length === 1 ? "" : "s"} · tap to preview
                  </Text>
                </View>
                <View style={[s.count, { backgroundColor: c.brandSoft }]}>
                  <Text style={[s.countText, { color: c.brand }]}>
                    {documents.length}
                  </Text>
                </View>
              </View>
              <View style={s.documentList}>
                {documents.map((document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                    colors={c}
                    onOpen={() => void openDocument(document)}
                    onFavorite={() => void toggleFavorite(document)}
                    deleting={deletingId === document.id}
                    onDelete={() => setDeleteTarget(document)}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <CompactNavDock />

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        update={updateFilters}
        clear={() => setFilters(emptyFilters)}
        colors={c}
      />
      <UploadReviewSheet
        pending={cropOpen ? null : pendingUpload}
        uploading={uploading}
        close={() => setPendingUpload(null)}
        onRotate={() => void rotatePendingUpload()}
        onCrop={() => setCropOpen(true)}
        onReplace={() => {
          setPendingUpload(null);
          void (pendingUpload?.source === "scan"
            ? scanWithCamera()
            : pendingUpload?.source === "file"
              ? chooseFile()
              : choosePhoto());
        }}
        onSave={() => {
          if (!pendingUpload) return;
          void saveFile(pendingUpload).then((saved) => {
            if (saved) setPendingUpload(null);
          });
        }}
        colors={c}
      />
      <CropEditor
        pending={cropOpen ? pendingUpload : null}
        close={() => setCropOpen(false)}
        onApply={(crop) => void cropPendingUpload(crop)}
        colors={c}
      />
      <PreviewSheet
        preview={preview}
        sharing={sharing}
        close={() => setPreview(null)}
        onShare={() => void sharePreview()}
        onOpen={() => {
          if (!preview?.url) return;
          void WebBrowser.openBrowserAsync(preview.url, {
            presentationStyle:
              WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          });
        }}
        colors={c}
      />
      <DeleteConfirmSheet
        document={deleteTarget}
        deleting={deletingId === deleteTarget?.id}
        close={() => !deletingId && setDeleteTarget(null)}
        onDelete={() => deleteTarget && void deleteDocument(deleteTarget)}
        colors={c}
      />
    </View>
  );
}

function Pill({
  label,
  icon,
  active,
  onPress,
  colors,
}: {
  label: string;
  icon: ComponentProps<typeof SymbolView>["name"];
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.pill,
        {
          backgroundColor: active ? colors.brand : colors.surface,
          borderColor: active ? colors.brand : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <SymbolView
        name={icon}
        size={13}
        tintColor={active ? "#FFFFFF" : colors.textSecondary}
      />
      <Text style={[s.pillText, { color: active ? "#FFFFFF" : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DocumentRow({
  document,
  colors,
  onOpen,
  onFavorite,
  onDelete,
  deleting,
}: {
  document: VaultDocument;
  colors: ReturnType<typeof useTheme>;
  onOpen: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [, label, icon, accent] = categoryFor(document.categorySlug);
  const expiry = expiryLabel(document);
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        s.document,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={[s.documentIcon, { backgroundColor: `${accent}18` }]}>
        <SymbolView
          name={document.kind === "PDF" ? "doc.text.fill" : icon}
          size={18}
          tintColor={accent}
        />
      </View>
      <View style={s.documentCopy}>
        <View style={s.documentTitleRow}>
          <Text
            numberOfLines={1}
            style={[s.documentTitle, { color: colors.text }]}
          >
            {document.title}
          </Text>
          {document.favorite ? (
            <SymbolView name="star.fill" size={12} tintColor={colors.warning} />
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={[s.documentMeta, { color: colors.textSecondary }]}
        >
          {label}
          {document.idNumberMasked ? ` · ${document.idNumberMasked}` : ""}
        </Text>
        <Text style={[s.documentAddedAt, { color: colors.textSecondary }]}>
          Added {addedLabel(document.createdAt)}
        </Text>
        {expiry ? (
          <View
            style={[
              s.expiry,
              {
                backgroundColor:
                  expiry === "Expired" ? "#FDE8EA" : colors.brandSoft,
              },
            ]}
          >
            <SymbolView
              name="exclamationmark.triangle.fill"
              size={10}
              tintColor={expiry === "Expired" ? "#D44857" : colors.warning}
            />
            <Text
              style={[
                s.expiryText,
                { color: expiry === "Expired" ? "#D44857" : colors.warning },
              ]}
            >
              {expiry}
            </Text>
          </View>
        ) : (
          <Text
            style={[s.documentPreviewHint, { color: colors.textSecondary }]}
          >
            Tap to preview
          </Text>
        )}
      </View>
      <View style={s.rowActions}>
        <Pressable
          accessibilityLabel={
            document.favorite ? "Remove favourite" : "Add favourite"
          }
          onPress={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
          hitSlop={8}
          style={s.rowButton}
        >
          <SymbolView
            name={document.favorite ? "star.fill" : "star"}
            size={17}
            tintColor={
              document.favorite ? colors.warning : colors.textSecondary
            }
          />
        </Pressable>
        <Pressable
          accessibilityLabel="Delete document"
          disabled={deleting}
          onPress={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          hitSlop={8}
          style={s.rowButton}
        >
          {deleting ? (
            <KasaSpinner size={15} />
          ) : (
            <SymbolView
              name="trash"
              size={15}
              tintColor={colors.textSecondary}
            />
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

function EmptyState({
  title,
  detail,
  action,
  onPress,
  colors,
}: {
  title: string;
  detail: string;
  action: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={[
        s.empty,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[s.emptyIcon, { backgroundColor: colors.brandSoft }]}>
        <SymbolView name="lock.doc.fill" size={24} tintColor={colors.brand} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[s.emptyDetail, { color: colors.textSecondary }]}>
        {detail}
      </Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.emptyButton,
          { backgroundColor: colors.brand, opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <Text style={s.emptyButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  filters,
  update,
  clear,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  filters: VaultFilters;
  update: (change: Partial<VaultFilters>) => void;
  clear: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        <Pressable
          style={[s.sheet, { backgroundColor: colors.background }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={s.sheetHead}>
            <View>
              <Text style={[s.sheetTitle, { color: colors.text }]}>
                Filter documents
              </Text>
              <Text style={[s.sheetSub, { color: colors.textSecondary }]}>
                Narrow down your vault instantly
              </Text>
            </View>
            <Pressable onPress={clear}>
              <Text style={[s.clearText, { color: colors.brand }]}>Reset</Text>
            </Pressable>
          </View>
          <Text style={[s.filterLabel, { color: colors.textSecondary }]}>
            CATEGORY
          </Text>
          <View style={s.categoryGrid}>
            {categories.map(([slug, label, icon, accent]) => (
              <Pressable
                key={slug}
                onPress={() =>
                  update({ category: filters.category === slug ? null : slug })
                }
                style={[
                  s.categoryButton,
                  {
                    backgroundColor:
                      filters.category === slug
                        ? `${accent}18`
                        : colors.surface,
                    borderColor:
                      filters.category === slug ? accent : colors.border,
                  },
                ]}
              >
                <SymbolView name={icon} size={16} tintColor={accent} />
                <Text style={[s.categoryText, { color: colors.text }]}>
                  {label}
                </Text>
                {filters.category === slug ? (
                  <SymbolView
                    name="checkmark.circle.fill"
                    size={14}
                    tintColor={accent}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
          <Text style={[s.filterLabel, { color: colors.textSecondary }]}>
            SHOW
          </Text>
          <View style={s.sheetOptions}>
            <SheetOption
              label="Favourites only"
              selected={Boolean(filters.favorites)}
              onPress={() => update({ favorites: !filters.favorites })}
              colors={colors}
            />
            <SheetOption
              label="Images only"
              selected={filters.kind === "IMAGE"}
              onPress={() =>
                update({ kind: filters.kind === "IMAGE" ? null : "IMAGE" })
              }
              colors={colors}
            />
            <SheetOption
              label="PDFs only"
              selected={filters.kind === "PDF"}
              onPress={() =>
                update({ kind: filters.kind === "PDF" ? null : "PDF" })
              }
              colors={colors}
            />
            <SheetOption
              label="Expiring in 90 days"
              selected={filters.expiry === "upcoming"}
              onPress={() =>
                update({
                  expiry: filters.expiry === "upcoming" ? null : "upcoming",
                })
              }
              colors={colors}
            />
          </View>
          <Text style={[s.filterLabel, { color: colors.textSecondary }]}>
            SORT BY
          </Text>
          <View style={s.sortRow}>
            {(
              [
                ["updated", "Recent"],
                ["created", "Added"],
                ["title", "A–Z"],
                ["expiry", "Expiry"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => update({ sort: value })}
                style={[
                  s.sortButton,
                  {
                    backgroundColor:
                      filters.sort === value ? colors.brand : colors.surface,
                    borderColor:
                      filters.sort === value ? colors.brand : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.sortText,
                    { color: filters.sort === value ? "#FFFFFF" : colors.text },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={onClose}
            style={[s.doneButton, { backgroundColor: colors.brand }]}
          >
            <Text style={s.doneText}>Show documents</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetOption({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.sheetOption, { borderColor: colors.border }]}
    >
      <Text style={[s.sheetOptionText, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          s.checkbox,
          {
            borderColor: selected ? colors.brand : colors.border,
            backgroundColor: selected ? colors.brand : "transparent",
          },
        ]}
      >
        {selected ? (
          <SymbolView name="checkmark" size={10} tintColor="#FFFFFF" />
        ) : null}
      </View>
    </Pressable>
  );
}

function UploadReviewSheet({
  pending,
  uploading,
  close,
  onRotate,
  onCrop,
  onReplace,
  onSave,
  colors,
}: {
  pending: PendingUpload | null;
  uploading: boolean;
  close: () => void;
  onRotate: () => void;
  onCrop: () => void;
  onReplace: () => void;
  onSave: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  if (!pending) return null;
  const image = pending.mimeType.startsWith("image/");
  const isScan = pending.source === "scan";
  return (
    <Modal transparent visible animationType="slide" onRequestClose={close}>
      <View style={s.sheetBackdrop}>
        <View style={[s.reviewSheet, { backgroundColor: colors.surface }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={s.reviewHead}>
            <View style={s.previewTitleWrap}>
              <Text style={[s.reviewTitle, { color: colors.text }]}>
                {isScan ? "Review your scan" : "Review before saving"}
              </Text>
              <Text style={[s.reviewSub, { color: colors.textSecondary }]}>
                {image
                  ? "Crop was applied. Rotate or replace it, then save."
                  : "This file is ready. You can save it securely now."}
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={8} style={s.reviewClose}>
              <SymbolView
                name="xmark"
                size={16}
                tintColor={colors.textSecondary}
              />
            </Pressable>
          </View>
          <View
            style={[
              s.reviewPreview,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            {image ? (
              <Image
                source={pending.uri}
                contentFit="contain"
                style={s.reviewImage}
                alt="Document ready to save"
              />
            ) : (
              <PdfCard
                name={pending.name}
                detail="PDF · ready to save"
                colors={colors}
              />
            )}
          </View>
          <View style={s.reviewTools}>
            {image ? (
              <>
                <Pressable
                  onPress={onCrop}
                  style={[s.reviewTool, { borderColor: colors.border }]}
                >
                  <SymbolView name="crop" size={16} tintColor={colors.text} />
                  <Text style={[s.reviewToolText, { color: colors.text }]}>
                    Crop
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onRotate}
                  style={[s.reviewTool, { borderColor: colors.border }]}
                >
                  <SymbolView
                    name="rotate.right"
                    size={16}
                    tintColor={colors.text}
                  />
                  <Text style={[s.reviewToolText, { color: colors.text }]}>
                    Rotate
                  </Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={onReplace}
              style={[s.reviewTool, { borderColor: colors.border }]}
            >
              <SymbolView
                name={isScan ? "camera.rotate" : "photo.on.rectangle"}
                size={16}
                tintColor={colors.text}
              />
              <Text style={[s.reviewToolText, { color: colors.text }]}>
                {isScan ? "Retake" : "Replace"}
              </Text>
            </Pressable>
          </View>
          <Pressable
            disabled={uploading}
            onPress={onSave}
            style={({ pressed }) => [
              s.saveReview,
              {
                backgroundColor: colors.brand,
                opacity: pressed || uploading ? 0.72 : 1,
              },
            ]}
          >
            {uploading ? (
              <KasaSpinner size={18} color="#FFFFFF" />
            ) : (
              <>
                <SymbolView name="lock.fill" size={14} tintColor="#FFFFFF" />
                <Text style={s.saveReviewText}>Save to Life Vault</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CropEditor({
  pending,
  close,
  onApply,
  colors,
}: {
  pending: PendingUpload | null;
  close: () => void;
  onApply: (crop: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  }) => void;
  colors: ReturnType<typeof useTheme>;
}) {
  const frameWidth = 312;
  const frameHeight = 238;
  const sourceWidth = pending?.width ?? 1200;
  const sourceHeight = pending?.height ?? 1600;
  const baseScale = Math.max(
    frameWidth / sourceWidth,
    frameHeight / sourceHeight,
  );
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1,
        onPanResponderMove: (_, gesture) => {
          const imageWidth = sourceWidth * baseScale * zoom;
          const imageHeight = sourceHeight * baseScale * zoom;
          const next = {
            x: Math.max(
              -(imageWidth - frameWidth) / 2,
              Math.min((imageWidth - frameWidth) / 2, position.x + gesture.dx),
            ),
            y: Math.max(
              -(imageHeight - frameHeight) / 2,
              Math.min(
                (imageHeight - frameHeight) / 2,
                position.y + gesture.dy,
              ),
            ),
          };
          setPosition(next);
        },
      }),
    [baseScale, sourceHeight, sourceWidth, zoom, position],
  );

  if (!pending || !pending.mimeType.startsWith("image/")) return null;
  const imageWidth = sourceWidth * baseScale * zoom;
  const imageHeight = sourceHeight * baseScale * zoom;
  const adjustZoom = (change: number) => {
    setZoom((current) => {
      const nextZoom = Math.max(
        1,
        Math.min(3, Number((current + change).toFixed(2))),
      );
      const nextImageWidth = sourceWidth * baseScale * nextZoom;
      const nextImageHeight = sourceHeight * baseScale * nextZoom;
      const nextPosition = {
        x: Math.max(
          -(nextImageWidth - frameWidth) / 2,
          Math.min((nextImageWidth - frameWidth) / 2, position.x),
        ),
        y: Math.max(
          -(nextImageHeight - frameHeight) / 2,
          Math.min((nextImageHeight - frameHeight) / 2, position.y),
        ),
      };
      setPosition(nextPosition);
      return nextZoom;
    });
  };
  const apply = () => {
    const displayScale = baseScale * zoom;
    const cropWidth = Math.min(
      sourceWidth,
      Math.round(frameWidth / displayScale),
    );
    const cropHeight = Math.min(
      sourceHeight,
      Math.round(frameHeight / displayScale),
    );
    onApply({
      originX: Math.max(
        0,
        Math.min(
          sourceWidth - cropWidth,
          Math.round((sourceWidth - cropWidth) / 2 - position.x / displayScale),
        ),
      ),
      originY: Math.max(
        0,
        Math.min(
          sourceHeight - cropHeight,
          Math.round(
            (sourceHeight - cropHeight) / 2 - position.y / displayScale,
          ),
        ),
      ),
      width: cropWidth,
      height: cropHeight,
    });
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={close}>
      <View style={s.cropBackdrop}>
        <View style={[s.cropSheet, { backgroundColor: colors.surface }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={s.reviewHead}>
            <View style={s.previewTitleWrap}>
              <Text style={[s.reviewTitle, { color: colors.text }]}>
                Adjust crop
              </Text>
              <Text style={[s.reviewSub, { color: colors.textSecondary }]}>
                Drag the document to position it. Use + and − to zoom.
              </Text>
            </View>
            <Pressable onPress={close} style={s.reviewClose}>
              <SymbolView
                name="xmark"
                size={16}
                tintColor={colors.textSecondary}
              />
            </Pressable>
          </View>
          <View style={s.cropStage} {...panResponder.panHandlers}>
            <Image
              source={pending.uri}
              contentFit="fill"
              style={[
                s.cropImage,
                {
                  width: imageWidth,
                  height: imageHeight,
                  transform: [
                    { translateX: position.x },
                    { translateY: position.y },
                  ],
                },
              ]}
              alt="Crop document"
            />
            <View pointerEvents="none" style={s.cropFrame}>
              <View style={s.cropRuleVertical} />
              <View style={s.cropRuleHorizontal} />
            </View>
          </View>
          <View style={s.cropControls}>
            <Pressable
              onPress={() => adjustZoom(-0.2)}
              disabled={zoom <= 1}
              style={[
                s.zoomButton,
                { borderColor: colors.border, opacity: zoom <= 1 ? 0.45 : 1 },
              ]}
            >
              <SymbolView name="minus" size={16} tintColor={colors.text} />
            </Pressable>
            <Text style={[s.zoomText, { color: colors.textSecondary }]}>
              Zoom {Math.round(zoom * 100)}%
            </Text>
            <Pressable
              onPress={() => adjustZoom(0.2)}
              disabled={zoom >= 3}
              style={[
                s.zoomButton,
                { borderColor: colors.border, opacity: zoom >= 3 ? 0.45 : 1 },
              ]}
            >
              <SymbolView name="plus" size={16} tintColor={colors.text} />
            </Pressable>
          </View>
          <Pressable
            onPress={apply}
            style={[s.saveReview, { backgroundColor: colors.brand }]}
          >
            <SymbolView name="checkmark" size={15} tintColor="#FFFFFF" />
            <Text style={s.saveReviewText}>Apply crop</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function DeleteConfirmSheet({
  document,
  deleting,
  close,
  onDelete,
  colors,
}: {
  document: VaultDocument | null;
  deleting: boolean;
  close: () => void;
  onDelete: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  if (!document) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={s.deleteBackdrop}>
        <View style={[s.deleteDialog, { backgroundColor: colors.surface }]}>
          <View style={s.deleteIcon}>
            <SymbolView name="trash.fill" size={21} tintColor="#D44857" />
          </View>
          <Text style={[s.deleteTitle, { color: colors.text }]}>
            Delete document?
          </Text>
          <Text style={[s.deleteCopy, { color: colors.textSecondary }]}>
            “{document.title}” will be permanently removed from your Life Vault.
          </Text>
          <View style={s.deleteActions}>
            <Pressable
              disabled={deleting}
              onPress={close}
              style={[
                s.deleteCancel,
                { borderColor: colors.border, opacity: deleting ? 0.55 : 1 },
              ]}
            >
              <Text style={[s.deleteCancelText, { color: colors.text }]}>
                Keep it
              </Text>
            </Pressable>
            <Pressable
              disabled={deleting}
              onPress={onDelete}
              style={({ pressed }) => [
                s.deleteConfirm,
                { opacity: pressed || deleting ? 0.72 : 1 },
              ]}
            >
              {deleting ? (
                <KasaSpinner size={17} color="#FFFFFF" />
              ) : (
                <SymbolView name="trash.fill" size={14} tintColor="#FFFFFF" />
              )}
              <Text style={s.deleteConfirmText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PdfCard({
  name,
  detail,
  colors,
}: {
  name: string;
  detail: string;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={s.pdfPreview}>
      <SymbolView name="doc.richtext.fill" size={40} tintColor="#D44857" />
      <Text style={[s.pdfName, { color: colors.text }]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={[s.pdfMeta, { color: colors.textSecondary }]}>{detail}</Text>
    </View>
  );
}

function PreviewSheet({
  preview,
  sharing,
  close,
  onShare,
  onOpen,
  colors,
}: {
  preview: { document: VaultDocument; url: string | null } | null;
  sharing: boolean;
  close: () => void;
  onShare: () => void;
  onOpen: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  if (!preview) return null;
  const isPdf = preview.document.mimeType === "application/pdf";
  return (
    <Modal transparent visible animationType="slide" onRequestClose={close}>
      <View style={s.sheetBackdrop}>
        <View style={[s.previewSheet, { backgroundColor: colors.surface }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={s.reviewHead}>
            <View style={s.previewTitleWrap}>
              <Text
                numberOfLines={1}
                style={[s.previewTitle, { color: colors.text }]}
              >
                {preview.document.title}
              </Text>
              <Text style={[s.previewMeta, { color: colors.textSecondary }]}>
                {isPdf ? "PDF document" : "Secure image preview"}
              </Text>
            </View>
            <Pressable
              onPress={close}
              accessibilityLabel="Close preview"
              style={s.reviewClose}
            >
              <SymbolView
                name="xmark"
                size={16}
                tintColor={colors.textSecondary}
              />
            </Pressable>
          </View>
          <View
            style={[
              s.compactPreview,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            {preview.url ? (
              isPdf ? (
                <PdfCard
                  name={preview.document.title}
                  detail="Tap open to read this PDF"
                  colors={colors}
                />
              ) : (
                <Image
                  source={preview.url}
                  contentFit="contain"
                  transition={160}
                  style={s.previewImage}
                  alt={preview.document.title}
                  accessibilityLabel={preview.document.title}
                />
              )
            ) : (
              <View style={s.previewLoading}>
                <KasaSpinner size={30} />
                <Text
                  style={[
                    s.previewLoadingText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Opening secure preview…
                </Text>
              </View>
            )}
          </View>
          <View style={s.previewActions}>
            <Pressable
              disabled={!preview.url || sharing}
              onPress={onShare}
              style={[
                s.previewActionSecondary,
                {
                  borderColor: colors.border,
                  opacity: !preview.url || sharing ? 0.55 : 1,
                },
              ]}
            >
              <SymbolView
                name="square.and.arrow.up"
                size={16}
                tintColor={colors.text}
              />
              <Text
                style={[s.previewActionSecondaryText, { color: colors.text }]}
              >
                {sharing ? "Preparing…" : "Share"}
              </Text>
            </Pressable>
            <Pressable
              disabled={!preview.url}
              onPress={onOpen}
              style={[
                s.previewActionPrimary,
                {
                  backgroundColor: colors.brand,
                  opacity: !preview.url ? 0.55 : 1,
                },
              ]}
            >
              <SymbolView
                name={
                  isPdf
                    ? "arrow.up.right.square"
                    : "arrow.up.left.and.arrow.down.right"
                }
                size={15}
                tintColor="#FFFFFF"
              />
              <Text style={s.previewActionPrimaryText}>
                {isPdf ? "Open PDF" : "View larger"}
              </Text>
            </Pressable>
          </View>
          <Text style={[s.previewHint, { color: colors.textSecondary }]}>
            Private by default · share only when you choose
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 132 },
  headingRow: { flexDirection: "row", gap: 14 },
  headingCopy: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.25 },
  devBuild: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.9,
    marginTop: 4,
  },
  title: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.25,
    marginTop: 6,
  },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 7 },
  lock: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  search: {
    height: 54,
    borderRadius: 19,
    borderWidth: 1,
    marginTop: 19,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 10, paddingVertical: 0 },
  filterRow: { paddingTop: 11, gap: 8, paddingRight: 20 },
  pill: {
    height: 35,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
  },
  pillText: { fontSize: 11, fontWeight: "800" },
  activeFilter: {
    alignSelf: "flex-start",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeFilterText: { fontSize: 11, fontWeight: "800" },
  captureRow: { flexDirection: "row", gap: 8, marginTop: 17 },
  primaryCapture: {
    height: 48,
    borderRadius: 17,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryCaptureText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  secondaryCapture: {
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryCaptureText: { fontSize: 12, fontWeight: "800" },
  iconCapture: {
    width: 48,
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  messageText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  loading: { paddingTop: 76, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 12, fontWeight: "700" },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 25,
    marginBottom: 11,
  },
  sectionTitle: { fontSize: 19, fontWeight: "900", letterSpacing: -0.5 },
  sectionMeta: { fontSize: 10, marginTop: 3 },
  count: {
    minWidth: 31,
    height: 31,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: { fontSize: 11, fontWeight: "900" },
  documentList: { gap: 9 },
  document: {
    minHeight: 87,
    borderRadius: 22,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  documentIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 1,
  },
  documentCopy: { flex: 1, minWidth: 0 },
  documentTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  documentTitle: { flexShrink: 1, fontSize: 13, fontWeight: "900" },
  documentMeta: { fontSize: 10, marginTop: 3 },
  documentAddedAt: { fontSize: 9, marginTop: 5, fontWeight: "600" },
  documentPreviewHint: { fontSize: 9, marginTop: 8, fontWeight: "700" },
  expiry: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    marginTop: 7,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  expiryText: { fontSize: 9, fontWeight: "900" },
  rowActions: { alignSelf: "stretch", justifyContent: "space-around" },
  rowButton: {
    width: 29,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    borderWidth: 1,
    borderRadius: 28,
    marginTop: 26,
    paddingHorizontal: 28,
    paddingVertical: 34,
    alignItems: "center",
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 16,
  },
  emptyDetail: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    textAlign: "center",
  },
  emptyButton: {
    height: 43,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 19,
  },
  emptyButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 8, 5, 0.48)",
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: Platform.select({ ios: 34, android: 24, default: 24 }),
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 4,
    alignSelf: "center",
    marginTop: 10,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  sheetTitle: { fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  sheetSub: { fontSize: 11, marginTop: 3 },
  clearText: { fontSize: 12, fontWeight: "900" },
  filterLabel: {
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "900",
    marginTop: 21,
    marginBottom: 9,
  },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  categoryButton: {
    height: 37,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  categoryText: { fontSize: 10, fontWeight: "800" },
  sheetOptions: { borderTopWidth: 1, borderTopColor: "transparent" },
  sheetOption: {
    minHeight: 45,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetOptionText: { fontSize: 13, fontWeight: "700" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sortRow: { flexDirection: "row", gap: 7 },
  sortButton: {
    height: 35,
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sortText: { fontSize: 10, fontWeight: "900" },
  doneButton: {
    height: 48,
    borderRadius: 16,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  reviewSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: Platform.select({ ios: 34, android: 24, default: 24 }),
  },
  previewSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: Platform.select({ ios: 34, android: 24, default: 24 }),
  },
  reviewHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 17,
  },
  reviewTitle: { fontSize: 19, fontWeight: "900", letterSpacing: -0.45 },
  reviewSub: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  reviewClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTitleWrap: { flex: 1, minWidth: 0 },
  previewTitle: { fontSize: 15, fontWeight: "900" },
  previewMeta: { fontSize: 10, marginTop: 3 },
  reviewPreview: {
    height: 230,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 16,
  },
  compactPreview: {
    height: 245,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 16,
  },
  reviewImage: { width: "100%", height: "100%" },
  previewImage: { width: "100%", height: "100%" },
  pdfPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  pdfName: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 12,
  },
  pdfMeta: { fontSize: 10, marginTop: 5 },
  previewLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  previewLoadingText: {
    fontSize: 12,
    fontWeight: "700",
  },
  reviewTools: { flexDirection: "row", gap: 8, marginTop: 11 },
  reviewTool: {
    flex: 1,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  reviewToolText: { fontSize: 11, fontWeight: "900" },
  saveReview: {
    height: 51,
    borderRadius: 17,
    marginTop: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveReviewText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  previewActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  previewActionSecondary: {
    flex: 1,
    height: 47,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  previewActionSecondaryText: { fontSize: 12, fontWeight: "900" },
  previewActionPrimary: {
    flex: 1,
    height: 47,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  previewActionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  previewHint: { textAlign: "center", fontSize: 10, marginTop: 11 },
  cropBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 8, 5, 0.72)",
  },
  cropSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: Platform.select({ ios: 34, android: 24, default: 24 }),
  },
  cropStage: {
    width: 312,
    height: 238,
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 18,
    marginTop: 17,
    backgroundColor: "#11100F",
    alignItems: "center",
    justifyContent: "center",
  },
  cropImage: { position: "absolute" },
  cropFrame: {
    position: "absolute",
    inset: 0,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 18,
  },
  cropRuleVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  cropRuleHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  cropControls: {
    height: 47,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    marginTop: 12,
  },
  zoomButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomText: {
    minWidth: 87,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
  },
  deleteBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
    backgroundColor: "rgba(17, 8, 5, 0.56)",
  },
  deleteDialog: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 28,
    padding: 23,
    alignItems: "center",
  },
  deleteIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#FDE8EA",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTitle: { fontSize: 18, fontWeight: "900", marginTop: 14 },
  deleteCopy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 7,
  },
  deleteActions: { flexDirection: "row", gap: 9, width: "100%", marginTop: 21 },
  deleteCancel: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelText: { fontSize: 12, fontWeight: "900" },
  deleteConfirm: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#D44857",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  deleteConfirmText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
