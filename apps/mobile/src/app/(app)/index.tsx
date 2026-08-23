import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";

const focus = [
  ["Drink water", "6 of 8 glasses", true, "drop.fill"],
  ["Office standup", "Completed at 10:15", true, "checkmark"],
  ["Electricity bill", "Due today", false, "bolt.fill"],
  ["Call parents", "This evening", false, "phone.fill"],
] as const;

const pulse = [
  ["Health", "74%", "heart.fill", "#FF5C71"],
  ["Money", "On track", "chart.line.uptrend.xyaxis", "#22A06B"],
  ["Learning", "32 min", "book.fill", "#7A5AF8"],
] as const;

export default function TodayScreen() {
  const c = useTheme();
  const { data: session } = authClient.useSession();
  const firstName = session?.user.name?.trim().split(/\s+/)[0] || "there";
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader label={date} />

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
              <View>
                <Text style={s.heroEyebrow}>TODAY&apos;S LIFE SCORE</Text>
                <Text style={s.score}>
                  82<Text style={s.percent}>%</Text>
                </Text>
              </View>
              <View style={s.streakPill}>
                <Text style={s.streakEmoji}>🔥</Text>
                <View>
                  <Text style={s.streakValue}>15 days</Text>
                  <Text style={s.streakLabel}>CURRENT STREAK</Text>
                </View>
              </View>
            </View>
            <View style={s.heroTrack}>
              <View style={s.heroFill} />
            </View>
            <Text style={s.heroMessage}>
              A strong day. Two priorities left to close.
            </Text>
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
            {pulse.map(([label, value, icon, color]) => (
              <Pressable
                key={label}
                onPress={() => router.push("/life")}
                style={[
                  s.pulseCard,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View style={[s.pulseIcon, { backgroundColor: `${color}18` }]}>
                  <SymbolView name={icon} size={16} tintColor={color} />
                </View>
                <Text style={[s.pulseValue, { color: c.text }]}>{value}</Text>
                <Text style={[s.pulseLabel, { color: c.textSecondary }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={s.sectionHeader}>
            <View>
              <Text style={[s.sectionTitle, { color: c.text }]}>
                Today&apos;s focus
              </Text>
              <Text style={[s.sectionMeta, { color: c.textSecondary }]}>
                2 of 4 complete
              </Text>
            </View>
            <View style={[s.countPill, { backgroundColor: c.brandSoft }]}>
              <Text style={[s.countText, { color: c.brand }]}>2 LEFT</Text>
            </View>
          </View>
          <View
            style={[
              s.list,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {focus.map(([title, detail, done, icon], i) => (
              <Pressable
                key={title}
                style={[
                  s.focusRow,
                  i > 0 && { borderTopColor: c.border, borderTopWidth: 1 },
                ]}
              >
                <View
                  style={[
                    s.check,
                    { backgroundColor: done ? c.brand : c.backgroundElement },
                  ]}
                >
                  <SymbolView
                    name={done ? "checkmark" : icon}
                    size={14}
                    tintColor={done ? "#FFFFFF" : c.brand}
                  />
                </View>
                <View style={s.focusCopy}>
                  <Text
                    style={[
                      s.focusTitle,
                      { color: done ? c.textSecondary : c.text },
                    ]}
                  >
                    {title}
                  </Text>
                  <Text style={[s.focusDetail, { color: c.textSecondary }]}>
                    {detail}
                  </Text>
                </View>
                <SymbolView
                  name="chevron.right"
                  size={11}
                  tintColor={c.textSecondary}
                />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => router.push("/timeline")}
            style={[s.upcoming, { backgroundColor: c.backgroundElement }]}
          >
            <View style={s.upcomingDate}>
              <Text style={[s.upcomingDay, { color: c.brand }]}>28</Text>
              <Text style={[s.upcomingMonth, { color: c.brand }]}>AUG</Text>
            </View>
            <View style={s.upcomingCopy}>
              <Text style={[s.upcomingLabel, { color: c.textSecondary }]}>
                COMING UP
              </Text>
              <Text style={[s.upcomingTitle, { color: c.text }]}>
                Insurance renewal
              </Text>
            </View>
            <SymbolView name="arrow.right" size={14} tintColor={c.brand} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  score: {
    color: "#FFFFFF",
    fontSize: 50,
    lineHeight: 58,
    fontWeight: "900",
    letterSpacing: -2.8,
    marginTop: 7,
  },
  percent: { fontSize: 19, color: "rgba(255,255,255,0.75)" },
  streakPill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  streakEmoji: { fontSize: 17 },
  streakValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  streakLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  heroTrack: {
    height: 6,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.20)",
    marginTop: 14,
  },
  heroFill: {
    width: "82%",
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
  },
  heroMessage: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 10,
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
  pulseRow: { gap: 10 },
  pulseCard: { width: 116, borderWidth: 1, borderRadius: 21, padding: 13 },
  pulseIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseValue: { fontSize: 16, fontWeight: "800", marginTop: 12 },
  pulseLabel: { fontSize: 10, marginTop: 3 },
  countPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  countText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  list: { borderWidth: 1, borderRadius: 25, paddingHorizontal: 14 },
  focusRow: {
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
});
