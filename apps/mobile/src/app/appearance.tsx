import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";
import {
  getAppearancePreference,
  setAppearancePreference,
  type AppearancePreference,
} from "@/lib/appearance";

const options: Array<{
  value: AppearancePreference;
  icon: "iphone" | "sun.max.fill" | "moon.fill";
  title: string;
  detail: string;
}> = [
  {
    value: "system",
    icon: "iphone",
    title: "System",
    detail: "Follow your iPhone setting",
  },
  {
    value: "light",
    icon: "sun.max.fill",
    title: "Light",
    detail: "Always use the light appearance",
  },
  {
    value: "dark",
    icon: "moon.fill",
    title: "Dark",
    detail: "Always use the dark appearance",
  },
];

export default function AppearanceScreen() {
  const c = useTheme();
  const [selected, setSelected] = useState<AppearancePreference>("system");
  useFocusEffect(
    useCallback(() => {
      void getAppearancePreference().then(setSelected);
    }, []),
  );
  async function choose(value: AppearancePreference) {
    setSelected(value);
    await setAppearancePreference(value);
  }
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
          <Text style={[s.navTitle, { color: c.text }]}>Appearance</Text>
          <View style={s.back} />
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={[s.preview, { backgroundColor: c.brand }]}>
            <Text style={s.previewEyebrow}>KASA APPEARANCE</Text>
            <Text style={s.previewTitle}>Made to feel at home.</Text>
            <View style={s.previewPill}>
              <SymbolView name="sparkles" size={13} tintColor="#FFF" />
              <Text style={s.previewPillText}>
                {selected === "system"
                  ? "Following your iPhone"
                  : `${selected[0].toUpperCase()}${selected.slice(1)} mode`}
              </Text>
            </View>
          </View>
          <Text style={[s.eyebrow, { color: c.textSecondary }]}>
            CHOOSE YOUR LOOK
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {options.map((option, index) => (
              <Pressable
                key={option.value}
                onPress={() => void choose(option.value)}
                style={[
                  s.row,
                  index > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                ]}
              >
                <View
                  style={[
                    s.icon,
                    {
                      backgroundColor:
                        selected === option.value
                          ? c.brandSoft
                          : c.backgroundElement,
                    },
                  ]}
                >
                  <SymbolView
                    name={option.icon}
                    size={18}
                    tintColor={c.brand}
                  />
                </View>
                <View style={s.copy}>
                  <Text style={[s.title, { color: c.text }]}>
                    {option.title}
                  </Text>
                  <Text style={[s.detail, { color: c.textSecondary }]}>
                    {option.detail}
                  </Text>
                </View>
                <View
                  style={[
                    s.radio,
                    {
                      borderColor:
                        selected === option.value ? c.brand : c.border,
                    },
                  ]}
                >
                  {selected === option.value ? (
                    <View style={[s.dot, { backgroundColor: c.brand }]} />
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
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
  preview: { borderRadius: 28, padding: 20 },
  previewEyebrow: {
    color: "rgba(255,255,255,.67)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  previewTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 7,
  },
  previewPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,.16)",
    borderRadius: 99,
    flexDirection: "row",
    gap: 6,
    marginTop: 17,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  previewPillText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 10,
    marginTop: 26,
  },
  card: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 14 },
  row: { alignItems: "center", flexDirection: "row", minHeight: 75 },
  icon: {
    alignItems: "center",
    borderRadius: 13,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  copy: { flex: 1, marginLeft: 11 },
  title: { fontSize: 13, fontWeight: "800" },
  detail: { fontSize: 9, marginTop: 3 },
  radio: {
    alignItems: "center",
    borderRadius: 99,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  dot: { borderRadius: 99, height: 10, width: 10 },
});
