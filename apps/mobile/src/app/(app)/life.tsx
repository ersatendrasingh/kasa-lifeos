import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
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
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { loadLifeOverview, type LifeOverview } from "@/lib/life-overview";

export default function LifeScreen() {
  const c = useTheme();
  const [overview, setOverview] = useState<LifeOverview | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const visibleAreas = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return overview?.areas ?? [];
    return (overview?.areas ?? []).filter((area) =>
      `${area.label} ${area.value} ${area.detail}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [overview, query]);

  async function load(background = false) {
    if (background) setRefreshing(true);
    try {
      setOverview(await loadLifeOverview());
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    void loadLifeOverview()
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch(() => {
        if (active) setOverview(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={c.brand}
              onRefresh={() => void load(true)}
            />
          }
        >
          <AppHeader label="Your LifeOS" />
          <Text style={[s.eyebrow, { color: c.brand }]}>
            EVERYTHING, CONNECTED
          </Text>
          <Text style={[s.title, { color: c.text }]}>
            Your life, in one view.
          </Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            Find anything fast and see what needs you next.
          </Text>

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
              placeholder="Search your life areas…"
              placeholderTextColor={c.textSecondary}
              style={[s.searchInput, { color: c.text }]}
            />
            <View style={[s.voice, { backgroundColor: c.brandSoft }]}>
              <SymbolView name="mic.fill" size={14} tintColor={c.brand} />
            </View>
          </View>

          <View style={[s.overview, { backgroundColor: c.brand }]}>
            <View style={s.overviewCopy}>
              <Text style={s.overviewLabel}>LIFE BALANCE</Text>
              <Text style={s.overviewTitle}>
                {overview?.score === null || !overview
                  ? "Your real picture starts here."
                  : overview.score >= 70
                    ? "You're moving well."
                    : "A few areas need attention."}
              </Text>
              <Text style={s.overviewText}>
                {overview
                  ? `${overview.onTrackAreas} of ${overview.trackedAreas} tracked areas are on track.`
                  : "Loading your connected areas…"}
              </Text>
            </View>
            <View style={s.ring}>
              <Text style={s.ringValue}>{overview?.score ?? "—"}</Text>
              <Text style={s.ringUnit}>SCORE</Text>
            </View>
          </View>

          <View style={s.sectionHead}>
            <View>
              <Text style={[s.sectionTitle, { color: c.text }]}>
                Needs attention
              </Text>
              <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                The important things, surfaced early
              </Text>
            </View>
            <View style={[s.alertCount, { backgroundColor: c.brandSoft }]}>
              <Text style={[s.alertCountText, { color: c.brand }]}>
                {overview?.attention.length ?? 0}
              </Text>
            </View>
          </View>
          <View
            style={[
              s.attentionCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {(overview?.attention ?? []).map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(item.href)}
                style={[
                  s.attentionRow,
                  index > 0 && { borderTopColor: c.border, borderTopWidth: 1 },
                ]}
              >
                <View
                  style={[s.attentionIcon, { backgroundColor: c.brandSoft }]}
                >
                  <SymbolView
                    name={item.icon as never}
                    size={15}
                    tintColor={c.brand}
                  />
                </View>
                <View style={s.attentionCopy}>
                  <Text style={[s.attentionTitle, { color: c.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[s.attentionDetail, { color: c.textSecondary }]}>
                    {item.detail}
                  </Text>
                </View>
                <Text style={[s.action, { color: c.brand }]}>
                  {item.action}
                </Text>
              </Pressable>
            ))}
            {!loading && !overview?.attention.length && (
              <View style={s.emptyAttention}>
                <View
                  style={[s.attentionIcon, { backgroundColor: c.brandSoft }]}
                >
                  <SymbolView name="checkmark" size={15} tintColor={c.brand} />
                </View>
                <View style={s.attentionCopy}>
                  <Text style={[s.attentionTitle, { color: c.text }]}>
                    Nothing needs attention
                  </Text>
                  <Text style={[s.attentionDetail, { color: c.textSecondary }]}>
                    New real signals will appear here automatically.
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={s.sectionHead}>
            <View>
              <Text style={[s.sectionTitle, { color: c.text }]}>
                Life areas
              </Text>
              <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                Built around you, not around folders
              </Text>
            </View>
            <Pressable
              style={[s.customize, { backgroundColor: c.backgroundElement }]}
            >
              <SymbolView
                name="slider.horizontal.3"
                size={13}
                tintColor={c.text}
              />
            </Pressable>
          </View>
          {loading && !overview ? (
            <View style={s.loading}>
              <KasaSpinner size={26} />
            </View>
          ) : (
            <View style={s.grid}>
              {visibleAreas.map((area) => (
                <Pressable
                  key={area.id}
                  onPress={() => router.push(area.href)}
                  style={({ pressed }) => [
                    s.areaCard,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.border,
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <View style={[s.areaIcon, { backgroundColor: c.brandSoft }]}>
                    <SymbolView
                      name={area.icon as never}
                      size={19}
                      tintColor={c.brand}
                    />
                  </View>
                  <Text style={[s.areaTitle, { color: c.text }]}>
                    {area.label}
                  </Text>
                  <Text style={[s.areaDetail, { color: c.textSecondary }]}>
                    {area.detail}
                  </Text>
                  <View
                    style={[
                      s.areaArrow,
                      { backgroundColor: c.backgroundElement },
                    ]}
                  >
                    <SymbolView
                      name="arrow.up.right"
                      size={10}
                      tintColor={c.textSecondary}
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 132 },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1.35 },
  title: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "900",
    letterSpacing: -1.5,
    marginTop: 6,
  },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  search: {
    height: 54,
    borderRadius: 19,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 10 },
  voice: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  overview: {
    minHeight: 126,
    borderRadius: 28,
    marginTop: 13,
    padding: 19,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  overviewCopy: { flex: 1 },
  overviewLabel: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  overviewTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 7,
  },
  overviewText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 5,
    maxWidth: 210,
  },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 7,
    borderColor: "rgba(255,255,255,0.86)",
    alignItems: "center",
    justifyContent: "center",
  },
  ringValue: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 25,
  },
  ringUnit: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 11,
  },
  sectionTitle: { fontSize: 19, fontWeight: "900", letterSpacing: -0.5 },
  sectionMeta: { fontSize: 9, marginTop: 3 },
  alertCount: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  alertCountText: { fontSize: 11, fontWeight: "900" },
  attentionCard: { borderWidth: 1, borderRadius: 24, paddingHorizontal: 13 },
  attentionRow: { minHeight: 66, flexDirection: "row", alignItems: "center" },
  emptyAttention: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
  },
  attentionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  attentionCopy: { flex: 1, marginLeft: 11 },
  attentionTitle: { fontSize: 13, fontWeight: "700" },
  attentionDetail: { fontSize: 9, marginTop: 3 },
  action: { fontSize: 10, fontWeight: "800" },
  customize: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  loading: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  areaCard: {
    width: "48.5%",
    minHeight: 142,
    borderWidth: 1,
    borderRadius: 23,
    padding: 14,
  },
  areaIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  areaTitle: { fontSize: 14, fontWeight: "800", marginTop: 13 },
  areaDetail: { fontSize: 9, marginTop: 4 },
  areaArrow: {
    position: "absolute",
    right: 13,
    top: 14,
    width: 25,
    height: 25,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addArea: {
    minHeight: 72,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 22,
    marginTop: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  addIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addCopy: { flex: 1, marginLeft: 11 },
  addTitle: { fontSize: 12, fontWeight: "800" },
  addText: { fontSize: 8, lineHeight: 12, marginTop: 3 },
});
