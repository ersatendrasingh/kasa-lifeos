import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  getAutomationIntegrations,
  setAutomationPolicy,
  type AutomationPolicyMode,
} from "@/lib/automation";

const sources = [
  ["envelope.fill", "Email", "Gmail receipts, bookings and documents", "EMAIL"],
  [
    "calendar",
    "Calendar",
    "Meetings, birthdays, travel and appointments",
    "CALENDAR",
  ],
  [
    "message.fill",
    "Messages",
    "Bills, transactions and recharge signals",
    "SMS",
  ],
  ["heart.fill", "Health", "Steps, sleep, workouts and wellness", "HEALTH"],
  [
    "location.fill",
    "Places",
    "Optional meaningful place detection",
    "LOCATION",
  ],
  [
    "person.2.fill",
    "People",
    "Important contacts and relationship context",
    "CONTACTS",
  ],
  [
    "bell.fill",
    "Notifications",
    "Useful confirmations from other apps",
    "NOTIFICATION",
  ],
  [
    "safari.fill",
    "Browser",
    "Future shopping and research extension",
    "BROWSER",
  ],
] as const;

const modeLabel: Record<AutomationPolicyMode, string> = {
  REVIEW_FIRST: "Review first",
  AUTO_SAFE: "Auto-safe",
  PAUSED: "Paused",
};

export default function IntegrationsScreen() {
  const c = useTheme();
  const [policies, setPolicies] = useState<
    Record<string, AutomationPolicyMode>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getAutomationIntegrations()
      .then((result) => {
        setPolicies(
          Object.fromEntries(
            result.policies.map((policy) => [policy.source, policy.mode]),
          ),
        );
      })
      .catch((cause) => {
        Alert.alert(
          "Automation unavailable",
          cause instanceof Error
            ? cause.message
            : "Could not load automation settings.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCount = useMemo(
    () =>
      sources.filter(
        ([, , , source]) => (policies[source] ?? "AUTO_SAFE") !== "PAUSED",
      ).length,
    [policies],
  );

  async function cycleMode(source: string) {
    const current = policies[source] ?? "AUTO_SAFE";
    const next: AutomationPolicyMode =
      current === "REVIEW_FIRST"
        ? "AUTO_SAFE"
        : current === "AUTO_SAFE"
          ? "PAUSED"
          : "REVIEW_FIRST";
    setSaving(source);
    try {
      await setAutomationPolicy(source, next);
      setPolicies((items) => ({ ...items, [source]: next }));
    } catch (cause) {
      Alert.alert(
        "Could not update automation",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <Pressable
            onPress={() => router.back()}
            style={[
              s.back,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="chevron.left" size={16} tintColor={c.text} />
          </Pressable>
          <Text style={[s.navTitle, { color: c.text }]}>Automation Hub</Text>
          <View style={s.back} />
        </View>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient colors={[c.brand, c.brandStrong]} style={s.hero}>
            <View style={s.heroIcon}>
              <SymbolView name="wand.and.stars" size={25} tintColor="#FFFFFF" />
            </View>
            <Text style={s.eyebrow}>YOUR LIFE, WITHOUT THE DATA ENTRY</Text>
            <Text style={s.title}>KASA connects the dots.</Text>
            <Text style={s.subtitle}>
              Every source is private, optional and controlled by you.
            </Text>
            <View style={s.heroStats}>
              <Text style={s.heroStat}>
                {activeCount} automation policies active
              </Text>
              <Text style={s.heroStat}>•</Text>
              <Text style={s.heroStat}>0 data sold</Text>
            </View>
          </LinearGradient>

          <View
            style={[
              s.ready,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={[s.readyIcon, { backgroundColor: c.brandSoft }]}>
              <SymbolView
                name="checkmark.seal.fill"
                size={20}
                tintColor={c.brand}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.readyTitle, { color: c.text }]}>Ready now</Text>
              <Text style={[s.readyText, { color: c.textSecondary }]}>
                Voice, camera receipts, photos, PDFs and natural text
              </Text>
            </View>
          </View>

          <Text style={[s.section, { color: c.textSecondary }]}>
            CONNECTED LIFE SOURCES
          </Text>
          {loading ? (
            <View style={s.loader}>
              <KasaSpinner size={26} />
            </View>
          ) : (
            <View
              style={[
                s.list,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {sources.map(([icon, title, detail, source], index) => {
                const mode = policies[source] ?? "AUTO_SAFE";
                return (
                  <View
                    key={source}
                    style={[
                      s.row,
                      index > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: c.border,
                      },
                    ]}
                  >
                    <View
                      style={[s.icon, { backgroundColor: c.backgroundElement }]}
                    >
                      <SymbolView name={icon} size={18} tintColor={c.brand} />
                    </View>
                    <View style={s.copy}>
                      <Text style={[s.rowTitle, { color: c.text }]}>
                        {title}
                      </Text>
                      <Text style={[s.rowDetail, { color: c.textSecondary }]}>
                        {detail}
                      </Text>
                    </View>
                    <Pressable
                      disabled={saving === source}
                      onPress={() => void cycleMode(source)}
                      style={[
                        s.mode,
                        {
                          backgroundColor:
                            mode === "AUTO_SAFE"
                              ? c.brandSoft
                              : c.backgroundElement,
                        },
                      ]}
                    >
                      {saving === source ? (
                        <KasaSpinner size={14} />
                      ) : (
                        <Text
                          style={[
                            s.modeText,
                            {
                              color:
                                mode === "AUTO_SAFE"
                                  ? c.brand
                                  : c.textSecondary,
                            },
                          ]}
                        >
                          {modeLabel[mode]}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
          <View style={[s.privacy, { backgroundColor: c.backgroundElement }]}>
            <SymbolView
              name="hand.raised.fill"
              size={18}
              tintColor={c.positive}
            />
            <Text style={[s.privacyText, { color: c.textSecondary }]}>
              Auto-safe is the default. It performs only additive, reversible
              actions above KASA’s confidence threshold. Uncertain actions wait
              for your review.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  nav: {
    height: 56,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: { fontSize: 16, fontWeight: "800" },
  content: { padding: 20, paddingBottom: 48 },
  hero: { borderRadius: 28, padding: 21, overflow: "hidden" },
  heroIcon: {
    width: 45,
    height: 45,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  eyebrow: {
    color: "rgba(255,255,255,.8)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1.1,
    marginTop: 5,
  },
  subtitle: {
    color: "rgba(255,255,255,.83)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 280,
  },
  heroStats: { flexDirection: "row", gap: 7, marginTop: 20 },
  heroStat: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  ready: {
    borderWidth: 1,
    borderRadius: 21,
    padding: 15,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  readyIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  readyTitle: { fontSize: 14, fontWeight: "800" },
  readyText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  section: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.25,
    marginTop: 27,
    marginBottom: 10,
  },
  loader: { height: 180, alignItems: "center", justifyContent: "center" },
  list: { borderWidth: 1, borderRadius: 24, overflow: "hidden" },
  row: {
    minHeight: 76,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: "800" },
  rowDetail: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  mode: {
    minWidth: 70,
    height: 30,
    borderRadius: 11,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modeText: { fontSize: 8, fontWeight: "900" },
  privacy: {
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  privacyText: { flex: 1, fontSize: 10, lineHeight: 15 },
});
