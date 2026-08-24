import * as LocalAuthentication from "expo-local-authentication";
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";
import {
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from "@/lib/biometric-unlock";

export default function SecurityScreen() {
  const c = useTheme();
  const [enabled, setEnabled] = useState(true);
  const [available, setAvailable] = useState(false);

  const load = useCallback(() => {
    void Promise.all([
      isBiometricLockEnabled(),
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]).then(([value, hardware, enrolled]) => {
      setEnabled(value);
      setAvailable(hardware && enrolled);
    });
  }, []);

  useFocusEffect(load);

  async function toggle(value: boolean) {
    if (value && !available) return;
    await setBiometricLockEnabled(value);
    setEnabled(value);
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
          <Text style={[s.navTitle, { color: c.text }]}>App security</Text>
          <View style={s.back} />
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={[s.hero, { backgroundColor: c.brand }]}>
            <View style={s.heroIcon}>
              <SymbolView name="faceid" size={30} tintColor="#FFFFFF" />
            </View>
            <Text style={s.heroTitle}>Your LifeOS, kept private.</Text>
            <Text style={s.heroText}>
              Use your device&apos;s Face ID or passcode before opening KASA.
            </Text>
          </View>
          <Text style={[s.eyebrow, { color: c.textSecondary }]}>
            DEVICE PROTECTION
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={[s.icon, { backgroundColor: c.brandSoft }]}>
              <SymbolView name="faceid" size={19} tintColor={c.brand} />
            </View>
            <View style={s.copy}>
              <Text style={[s.title, { color: c.text }]}>Face ID app lock</Text>
              <Text style={[s.detail, { color: c.textSecondary }]}>
                {available
                  ? "Ask every time you return to KASA."
                  : "Set up Face ID in iPhone Settings first."}
              </Text>
            </View>
            <Switch
              value={enabled && available}
              disabled={!available}
              onValueChange={(value) => void toggle(value)}
              trackColor={{ false: c.border, true: c.brand }}
            />
          </View>
          <View style={[s.note, { backgroundColor: c.backgroundElement }]}>
            <SymbolView name="lock.fill" size={14} tintColor={c.brand} />
            <Text style={[s.noteText, { color: c.textSecondary }]}>
              KASA never receives your Face ID data. Authentication stays on
              this iPhone.
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
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  heroTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 17,
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
  card: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 82,
    padding: 14,
  },
  icon: {
    alignItems: "center",
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  copy: { flex: 1, marginHorizontal: 12 },
  title: { fontSize: 13, fontWeight: "800" },
  detail: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  note: {
    alignItems: "flex-start",
    borderRadius: 17,
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
    padding: 14,
  },
  noteText: { flex: 1, fontSize: 10, lineHeight: 14 },
});
