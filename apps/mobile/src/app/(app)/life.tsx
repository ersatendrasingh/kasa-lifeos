import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { useTheme } from "@/hooks/use-theme";

const areas = [
  [
    "folder.fill",
    "Life Vault",
    "Your private documents",
    "#5B7CFA",
    "/life-vault",
  ],
  ["heart.fill", "Health", "3 goals active", "#FF5C71"],
  ["chart.line.uptrend.xyaxis", "Money", "On track", "#20A06A"],
  ["person.2.fill", "People", "2 follow-ups", "#8B5CF6"],
  ["house.fill", "Home", "1 bill due", "#E58A00"],
  ["car.fill", "Vehicle", "Service in 12d", "#1484C8"],
  ["book.fill", "Learning", "32 min today", "#7C55D9"],
  ["target", "Goals", "4 in progress", "#E8527A"],
] as const;

const attention = [
  ["bolt.fill", "Electricity bill", "Due today", "Pay now"],
  ["doc.text.fill", "Insurance renewal", "6 days left", "Review"],
  [
    "person.crop.circle.badge.clock",
    "Follow up with HR",
    "Waiting 2 days",
    "Remind",
  ],
] as const;

export default function LifeScreen() {
  const c = useTheme();
  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
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
              placeholder="Search documents, people, bills…"
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
              <Text style={s.overviewTitle}>You&apos;re moving well.</Text>
              <Text style={s.overviewText}>
                5 of 7 life areas are on track this week.
              </Text>
            </View>
            <View style={s.ring}>
              <Text style={s.ringValue}>78</Text>
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
              <Text style={[s.alertCountText, { color: c.brand }]}>3</Text>
            </View>
          </View>
          <View
            style={[
              s.attentionCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {attention.map(([icon, title, detail, action], index) => (
              <Pressable
                key={title}
                style={[
                  s.attentionRow,
                  index > 0 && { borderTopColor: c.border, borderTopWidth: 1 },
                ]}
              >
                <View
                  style={[s.attentionIcon, { backgroundColor: c.brandSoft }]}
                >
                  <SymbolView name={icon} size={15} tintColor={c.brand} />
                </View>
                <View style={s.attentionCopy}>
                  <Text style={[s.attentionTitle, { color: c.text }]}>
                    {title}
                  </Text>
                  <Text style={[s.attentionDetail, { color: c.textSecondary }]}>
                    {detail}
                  </Text>
                </View>
                <Text style={[s.action, { color: c.brand }]}>{action}</Text>
              </Pressable>
            ))}
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
          <View style={s.grid}>
            {areas.map(([icon, label, detail, color, href]) => (
              <Pressable
                key={label}
                onPress={() => href && router.push(href)}
                style={({ pressed }) => [
                  s.areaCard,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <View style={[s.areaIcon, { backgroundColor: `${color}18` }]}>
                  <SymbolView name={icon} size={19} tintColor={color} />
                </View>
                <Text style={[s.areaTitle, { color: c.text }]}>{label}</Text>
                <Text style={[s.areaDetail, { color: c.textSecondary }]}>
                  {detail}
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
          <Pressable style={[s.addArea, { borderColor: c.border }]}>
            <View style={[s.addIcon, { backgroundColor: c.brandSoft }]}>
              <SymbolView name="plus" size={15} tintColor={c.brand} />
            </View>
            <View style={s.addCopy}>
              <Text style={[s.addTitle, { color: c.text }]}>
                Personalize your LifeOS
              </Text>
              <Text style={[s.addText, { color: c.textSecondary }]}>
                Choose what appears here and how it is organized.
              </Text>
            </View>
            <SymbolView
              name="chevron.right"
              size={11}
              tintColor={c.textSecondary}
            />
          </Pressable>
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
