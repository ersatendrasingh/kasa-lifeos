import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";

const controls = [
  [
    "person.crop.circle",
    "Profile details",
    "You decide what personal information to add.",
  ],
  [
    "lock.doc.fill",
    "Life Vault",
    "Documents remain in your private KASA account.",
  ],
  [
    "link",
    "Connected sources",
    "Manage calendar, health and other connections.",
  ],
] as const;

export default function PrivacyDataScreen() {
  const c = useTheme();
  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <Pressable
            onPress={() => router.back()}
            style={[
              s.back,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="chevron.left" size={17} tintColor={c.text} />
          </Pressable>
          <Text style={[s.navTitle, { color: c.text }]}>Privacy & data</Text>
          <View style={s.back} />
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={[s.hero, { backgroundColor: c.brand }]}>
            <SymbolView name="hand.raised.fill" size={28} tintColor="#FFF" />
            <Text style={s.heroTitle}>Your life. Your control.</Text>
            <Text style={s.heroText}>
              KASA uses your data only to power the features you choose.
            </Text>
          </View>
          <Text style={[s.eyebrow, { color: c.textSecondary }]}>
            YOUR CONTROLS
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {controls.map(([icon, title, detail], index) => (
              <Pressable
                key={title}
                onPress={() =>
                  title === "Profile details"
                    ? router.push("/edit-profile")
                    : title === "Life Vault"
                      ? router.push("/life-vault")
                      : router.push("/integrations")
                }
                style={[
                  s.row,
                  index > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                ]}
              >
                <View style={[s.icon, { backgroundColor: c.brandSoft }]}>
                  <SymbolView name={icon} size={16} tintColor={c.brand} />
                </View>
                <View style={s.copy}>
                  <Text style={[s.title, { color: c.text }]}>{title}</Text>
                  <Text style={[s.detail, { color: c.textSecondary }]}>
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
          <Text style={[s.foot, { color: c.textSecondary }]}>
            For sensitive details like PAN and Aadhaar, leave the field blank
            unless you want it saved to your private profile.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: 20, paddingTop: 8 },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    height: 60,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  back: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  navTitle: { fontSize: 16, fontWeight: "900" },
  hero: { borderRadius: 28, padding: 20 },
  heroTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 15,
  },
  heroText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 10,
    marginTop: 26,
  },
  card: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 14 },
  row: { alignItems: "center", flexDirection: "row", minHeight: 74 },
  icon: {
    alignItems: "center",
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  copy: { flex: 1, marginLeft: 11 },
  title: { fontSize: 13, fontWeight: "800" },
  detail: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  foot: { fontSize: 10, lineHeight: 15, marginTop: 15, paddingHorizontal: 3 },
});
