import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  DeviceEventEmitter,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { loadLifeOverview, type LifeOverview } from "@/lib/life-overview";
import {
  getProfileDetails,
  PROFILE_CHANGED_EVENT,
} from "@/lib/profile-details";

export default function TodayScreen() {
  const c = useTheme();
  const { data: session } = authClient.useSession();
  const [overview, setOverview] = useState<LifeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [preferredName, setPreferredName] = useState("");
  const firstName =
    preferredName.trim() || session?.user.name?.trim().split(/\s+/)[0] || "there";
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const pulseOrder = [
    "health",
    "responsibilities",
    "calendar",
    "vault",
    "captures",
  ];
  const pulseAreas = overview?.areas
    .filter((area) => pulseOrder.includes(area.id))
    .sort((a, b) => pulseOrder.indexOf(a.id) - pulseOrder.indexOf(b.id));
  const heroItem = overview?.focus[0] ?? overview?.upcoming ?? null;
  const focusCount = overview?.focus.length ?? 0;

  async function load(background = false) {
    if (background) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    try {
      setOverview(await loadLifeOverview());
    } catch {
      setOverview(null);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    void loadLifeOverview()
      .then((data) => {
        if (active) {
          setOverview(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (active) {
          setOverview(null);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    const refreshIdentity = () => {
      void getProfileDetails(session.user.id).then((details) => {
        if (active) setPreferredName(details.preferredName);
      });
    };
    refreshIdentity();
    const subscription = DeviceEventEmitter.addListener(
      PROFILE_CHANGED_EVENT,
      refreshIdentity,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [session?.user.id]);

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
          <AppHeader label={date} />

          {loading ? (
            <HomeSkeleton colors={c} />
          ) : loadError || !overview ? (
            <HomeLoadError colors={c} onRetry={() => void load()} />
          ) : (
            <>
              <Text style={[s.greeting, { color: c.text }]}>
                {greeting}, {firstName} 👋
              </Text>
              <Text style={[s.subtitle, { color: c.textSecondary }]}>
                Here&apos;s what matters today.
              </Text>

              <View style={[s.hero, { backgroundColor: c.brand }]}>
                <View style={s.heroOrbOne} />
                <View style={s.heroOrbTwo} />
                <View style={s.heroTop}>
                  <View style={s.heroCopy}>
                    <Text style={s.heroEyebrow}>TODAY&apos;S OVERVIEW</Text>
                    <Text style={s.heroTitle}>
                      {focusCount
                        ? `${focusCount} ${focusCount === 1 ? "thing" : "things"} need you`
                        : "You’re all clear"}
                    </Text>
                    <Text style={s.heroSubtitle}>
                      {focusCount
                        ? "Only real actions that need your attention."
                        : "Nothing urgent is waiting right now."}
                    </Text>
                  </View>
                  <View style={s.syncPill}>
                    <SymbolView
                      name="arrow.triangle.2.circlepath"
                      size={16}
                      tintColor="#FFFFFF"
                    />
                    <View>
                      <Text style={s.syncValue}>
                        {overview.trackedAreas} areas
                      </Text>
                      <Text style={s.syncLabel}>CONNECTED</Text>
                    </View>
                  </View>
                </View>
                {heroItem && (
                  <Pressable
                    onPress={() => router.push(heroItem.href)}
                    style={s.heroNext}
                  >
                    <View style={s.heroNextIcon}>
                      <SymbolView
                        name={heroItem.icon as never}
                        size={14}
                        tintColor="#FFFFFF"
                      />
                    </View>
                    <View style={s.heroNextCopy}>
                      <Text style={s.heroNextLabel}>
                        {focusCount ? "NEXT ACTION" : "COMING UP"}
                      </Text>
                      <Text numberOfLines={1} style={s.heroNextTitle}>
                        {heroItem.title}
                      </Text>
                    </View>
                    <SymbolView
                      name="chevron.right"
                      size={11}
                      tintColor="#FFFFFF"
                    />
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/inbox");
                }}
                style={[
                  s.capture,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View style={[s.captureIcon, { backgroundColor: c.brandSoft }]}>
                  <SymbolView name="sparkles" size={21} tintColor={c.brand} />
                </View>
                <View style={s.captureCopy}>
                  <Text style={[s.captureTitle, { color: c.text }]}>
                    Quick capture
                  </Text>
                  <Text style={[s.captureText, { color: c.textSecondary }]}>
                    Speak or type. KASA organizes the rest.
                  </Text>
                </View>
                <View style={[s.captureAction, { backgroundColor: c.brand }]}>
                  <SymbolView name="plus" size={17} tintColor="#FFFFFF" />
                </View>
              </Pressable>

              <View style={s.sectionHeader}>
                <View>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Life pulse
                  </Text>
                  <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                    A quick look across your world
                  </Text>
                </View>
                <Pressable onPress={() => router.push("/life")}>
                  <Text style={[s.seeAll, { color: c.brand }]}>See all</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.pulseRow}
              >
                {(pulseAreas ?? []).map((area) => (
                  <Pressable
                    key={area.id}
                    onPress={() => router.push(area.href)}
                    style={[
                      s.pulseCard,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <View style={s.pulseTop}>
                      <View
                        style={[s.pulseIcon, { backgroundColor: c.brandSoft }]}
                      >
                        <SymbolView
                          name={area.icon as never}
                          size={17}
                          tintColor={c.brand}
                        />
                      </View>
                      <Text style={[s.pulseLabel, { color: c.textSecondary }]}>
                        {area.label}
                      </Text>
                      <View
                        style={[
                          s.pulseArrow,
                          { backgroundColor: c.backgroundElement },
                        ]}
                      >
                        <SymbolView
                          name="arrow.up.right"
                          size={10}
                          tintColor={c.brand}
                        />
                      </View>
                    </View>
                    <Text style={[s.pulseValue, { color: c.text }]}>
                      {area.value}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.pulseDetail, { color: c.textSecondary }]}
                    >
                      {area.detail}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={s.sectionHeader}>
                <View>
                  <Text style={[s.sectionTitle, { color: c.text }]}>Health snapshot</Text>
                  <Text style={[s.sectionMeta, { color: c.textSecondary }]}>Your latest body signals</Text>
                </View>
                <Pressable onPress={() => router.push("/health")}>
                  <Text style={[s.seeAll, { color: c.brand }]}>Health Hub</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.healthRow}
              >
                {overview.healthHighlights.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      router.push({ pathname: "/health", params: { measure: item.id } })
                    }
                    style={({ pressed }) => [
                      s.healthCard,
                      {
                        backgroundColor: c.surface,
                        borderColor: c.border,
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <View style={s.healthCardTop}>
                      <View style={[s.healthIcon, { backgroundColor: c.brandSoft }]}>
                        <SymbolView name={item.icon as never} size={16} tintColor={c.brand} />
                      </View>
                      <SymbolView name="chevron.right" size={10} tintColor={c.textSecondary} />
                    </View>
                    <Text style={[s.healthLabel, { color: c.textSecondary }]}>{item.label}</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[s.healthValue, { color: c.text }]}>{item.value}</Text>
                    <Text numberOfLines={1} style={[s.healthDetail, { color: item.hasValue ? c.textSecondary : c.brand }]}>{item.detail}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={s.sectionHeader}>
                <View>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Today&apos;s focus
                  </Text>
                  <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                    {overview.focus.length
                      ? `${overview.focus.length} actionable item${overview.focus.length === 1 ? "" : "s"}`
                      : "Nothing pending today"}
                  </Text>
                </View>
                <View style={[s.countPill, { backgroundColor: c.brandSoft }]}>
                  <Text style={[s.countText, { color: c.brand }]}>
                    {overview.focus.length} LEFT
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.list,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                {overview.focus.map((item, i) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(item.href)}
                    style={[
                      s.focusRow,
                      i > 0 && { borderTopColor: c.border, borderTopWidth: 1 },
                    ]}
                  >
                    <View
                      style={[
                        s.check,
                        {
                          backgroundColor: item.done
                            ? c.brand
                            : c.backgroundElement,
                        },
                      ]}
                    >
                      <SymbolView
                        name={(item.done ? "checkmark" : item.icon) as never}
                        size={14}
                        tintColor={item.done ? "#FFFFFF" : c.brand}
                      />
                    </View>
                    <View style={s.focusCopy}>
                      <Text
                        style={[
                          s.focusTitle,
                          { color: item.done ? c.textSecondary : c.text },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={[s.focusDetail, { color: c.textSecondary }]}>
                        {item.detail}
                      </Text>
                    </View>
                    <SymbolView
                      name="chevron.right"
                      size={11}
                      tintColor={c.textSecondary}
                    />
                  </Pressable>
                ))}
                {!loading && !overview?.focus.length && (
                  <View style={s.emptyFocus}>
                    <View style={[s.check, { backgroundColor: c.brandSoft }]}>
                      <SymbolView
                        name="checkmark"
                        size={14}
                        tintColor={c.brand}
                      />
                    </View>
                    <View style={s.focusCopy}>
                      <Text style={[s.focusTitle, { color: c.text }]}>
                        All clear
                      </Text>
                      <Text style={[s.focusDetail, { color: c.textSecondary }]}>
                        Capture something whenever it matters.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {overview?.upcoming && (
                <Pressable
                  onPress={() => router.push(overview.upcoming!.href)}
                  style={[s.upcoming, { backgroundColor: c.backgroundElement }]}
                >
                  <View style={s.upcomingDate}>
                    <Text style={[s.upcomingDay, { color: c.brand }]}>
                      {new Date(overview.upcoming.date!).getDate()}
                    </Text>
                    <Text style={[s.upcomingMonth, { color: c.brand }]}>
                      {new Intl.DateTimeFormat("en-IN", { month: "short" })
                        .format(new Date(overview.upcoming.date!))
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.upcomingCopy}>
                    <Text style={[s.upcomingLabel, { color: c.textSecondary }]}>
                      COMING UP
                    </Text>
                    <Text style={[s.upcomingTitle, { color: c.text }]}>
                      {overview.upcoming.title}
                    </Text>
                  </View>
                  <SymbolView
                    name="arrow.right"
                    size={14}
                    tintColor={c.brand}
                  />
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type Theme = ReturnType<typeof useTheme>;

function HomeSkeleton({ colors: c }: { colors: Theme }) {
  const block = { backgroundColor: c.backgroundElement };
  return (
    <View style={s.skeletonRoot} accessibilityLabel="Loading your day">
      <View style={[s.skeletonGreeting, block]} />
      <View style={[s.skeletonSubtitle, block]} />
      <View style={[s.skeletonHero, block]}>
        <KasaSpinner size={25} />
      </View>
      <View style={[s.skeletonCapture, block]} />
      <View style={s.skeletonSectionRow}>
        <View style={[s.skeletonSectionTitle, block]} />
        <View style={[s.skeletonSectionAction, block]} />
      </View>
      <View style={s.skeletonCards}>
        <View style={[s.skeletonCard, block]} />
        <View style={[s.skeletonCard, block]} />
      </View>
      <View style={[s.skeletonList, block]} />
    </View>
  );
}

function HomeLoadError({
  colors: c,
  onRetry,
}: {
  colors: Theme;
  onRetry: () => void;
}) {
  return (
    <View style={s.loadError}>
      <View style={[s.loadErrorIcon, { backgroundColor: c.brandSoft }]}>
        <SymbolView name="wifi.exclamationmark" size={22} tintColor={c.brand} />
      </View>
      <Text style={[s.loadErrorTitle, { color: c.text }]}>
        Couldn’t load your day
      </Text>
      <Text style={[s.loadErrorText, { color: c.textSecondary }]}>
        Your data is safe. Check the development connection and try again.
      </Text>
      <Pressable
        onPress={onRetry}
        style={[s.retryButton, { backgroundColor: c.brand }]}
      >
        <Text style={s.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130 },
  greeting: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1.35,
  },
  subtitle: { fontSize: 14, marginTop: 5, marginBottom: 20 },
  hero: {
    borderRadius: 30,
    padding: 21,
    overflow: "hidden",
    boxShadow: "0 18px 40px rgba(223, 60, 13, 0.22)",
  },
  heroOrbOne: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.10)",
    right: -50,
    top: -70,
  },
  heroOrbTwo: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 100,
    borderWidth: 20,
    borderColor: "rgba(255,255,255,0.07)",
    left: -42,
    bottom: -62,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroCopy: { flex: 1 },
  heroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 8,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
    maxWidth: 225,
  },
  syncPill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncValue: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  syncLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  heroNext: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 11,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroNextIcon: {
    width: 31,
    height: 31,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroNextCopy: { flex: 1, marginLeft: 10 },
  heroNextLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroNextTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  capture: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 24,
    marginTop: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    boxShadow: "0 8px 26px rgba(55, 23, 11, 0.06)",
  },
  captureIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  captureCopy: { flex: 1, marginLeft: 12 },
  captureTitle: { fontSize: 15, fontWeight: "800" },
  captureText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  captureAction: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.55 },
  sectionMeta: { fontSize: 10, marginTop: 3 },
  seeAll: { fontSize: 11, fontWeight: "800" },
  pulseRow: { gap: 11, paddingRight: 8 },
  pulseCard: {
    width: 258,
    minHeight: 128,
    borderWidth: 1,
    borderRadius: 26,
    padding: 15,
    boxShadow: "0 8px 24px rgba(55,23,11,0.05)",
  },
  pulseTop: { flexDirection: "row", alignItems: "center" },
  pulseIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseLabel: { flex: 1, fontSize: 10, fontWeight: "700", marginLeft: 9 },
  pulseArrow: {
    width: 27,
    height: 27,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 13,
  },
  pulseDetail: { fontSize: 9, marginTop: 4 },
  healthRow: { gap: 11, paddingRight: 8 },
  healthCard: {
    width: 176,
    minHeight: 142,
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
  },
  healthCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  healthIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  healthLabel: { fontSize: 8, fontWeight: "800", marginTop: 13 },
  healthValue: { fontSize: 21, fontWeight: "900", letterSpacing: -0.6, marginTop: 4 },
  healthDetail: { fontSize: 8, fontWeight: "700", marginTop: 5 },
  countPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  countText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  list: { borderWidth: 1, borderRadius: 25, paddingHorizontal: 14 },
  focusRow: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyFocus: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  check: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  focusCopy: { flex: 1 },
  focusTitle: { fontSize: 14, fontWeight: "700" },
  focusDetail: { fontSize: 10, marginTop: 3 },
  upcoming: {
    borderRadius: 23,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  upcomingDate: {
    width: 46,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(255,79,31,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingDay: { fontSize: 17, fontWeight: "900", lineHeight: 18 },
  upcomingMonth: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  upcomingCopy: { flex: 1, marginLeft: 12 },
  upcomingLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.9 },
  upcomingTitle: { fontSize: 13, fontWeight: "800", marginTop: 3 },
  skeletonRoot: { paddingTop: 4 },
  skeletonGreeting: { width: "68%", height: 34, borderRadius: 13 },
  skeletonSubtitle: {
    width: "45%",
    height: 13,
    borderRadius: 7,
    marginTop: 9,
    marginBottom: 20,
  },
  skeletonHero: {
    height: 180,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonCapture: { height: 76, borderRadius: 24, marginTop: 14 },
  skeletonSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  skeletonSectionTitle: { width: 116, height: 24, borderRadius: 10 },
  skeletonSectionAction: { width: 48, height: 18, borderRadius: 9 },
  skeletonCards: { flexDirection: "row", gap: 11 },
  skeletonCard: { width: 210, height: 122, borderRadius: 26 },
  skeletonList: { height: 150, borderRadius: 25, marginTop: 28 },
  loadError: { minHeight: 430, alignItems: "center", justifyContent: "center" },
  loadErrorIcon: {
    width: 52,
    height: 52,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  loadErrorTitle: { fontSize: 19, fontWeight: "900", marginTop: 14 },
  loadErrorText: {
    maxWidth: 280,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
  retryButton: {
    height: 43,
    borderRadius: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
