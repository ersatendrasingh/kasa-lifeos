import { Redirect, router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { getProfileDetails, type ProfileDetails } from "@/lib/profile-details";

const quickActions = [
  ["lock.shield.fill", "Security"],
  ["folder.fill", "Life Vault"],
  ["questionmark.circle.fill", "Support"],
] as const;

const settings = [
  ["person.text.rectangle", "Personal details", "Name, birthday & location"],
  [
    "bolt.horizontal.circle.fill",
    "Automation & sources",
    "Email, calendar, health and more",
  ],
  ["faceid", "Face ID", "Enabled"],
  ["bell.fill", "Notifications", "Smart reminders on"],
  ["circle.lefthalf.filled", "Appearance", "System"],
  ["hand.raised.fill", "Privacy & data", "Your controls"],
] as const;

export default function ProfileScreen() {
  const c = useTheme();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const userId = session?.user.id;
  const displayName = details?.preferredName.trim() || session?.user.name || "K";
  const initials =
    displayName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "K";

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      getProfileDetails(userId).then((profile) => {
        if (active) setDetails(profile);
      });
      return () => {
        active = false;
      };
    }, [userId]),
  );

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/sign-in");
  }

  function confirmSignOut() {
    Alert.alert(
      "Sign out of KASA?",
      "Your private data will remain safely stored.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void signOut(),
        },
      ],
    );
  }

  if (isPending) {
    return (
      <View style={[s.center, { backgroundColor: c.background }]}>
        <KasaSpinner size={28} />
      </View>
    );
  }
  if (!session?.user) return <Redirect href="/sign-in" />;

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <View style={[s.glow, { backgroundColor: c.brand }]} />
      <SafeAreaView style={s.safe}>
        <View style={s.nav}>
          <Pressable
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={[
              s.navButton,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="chevron.left" size={17} tintColor={c.text} />
          </Pressable>
          <Text style={[s.navTitle, { color: c.text }]}>Profile</Text>
          <View style={s.navSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.identity}>
            <View style={[s.avatar, { backgroundColor: c.brand }]}>
              {details?.avatarUrl ? (
                <Image
                  source={{ uri: details.avatarUrl }}
                  style={s.avatarImage}
                  alt=""
                />
              ) : (
                <Text style={s.avatarText}>{initials}</Text>
              )}
            </View>
            <View style={s.identityCopy}>
              <Text style={[s.name, { color: c.text }]}>
                {displayName}
              </Text>
              <Text style={[s.email, { color: c.textSecondary }]}>
                {details?.phone || session.user.email}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Edit profile"
              onPress={() => router.push("/edit-profile")}
              style={[s.edit, { backgroundColor: c.brandSoft }]}
            >
              <SymbolView name="pencil" size={14} tintColor={c.brand} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/edit-profile")}
            style={[s.completeCard, { backgroundColor: c.brand }]}
          >
            <View style={s.completeIcon}>
              <SymbolView
                name="person.crop.circle.badge.plus"
                size={26}
                tintColor="#FFFFFF"
              />
            </View>
            <View style={s.completeCopy}>
              <Text style={s.completeEyebrow}>PERSONALIZE YOUR LIFE OS</Text>
              <Text style={s.completeTitle}>
                {details?.birthday
                  ? "Your profile is personalized"
                  : "Complete your profile"}
              </Text>
              <Text style={s.completeText}>
                {details?.birthday
                  ? `Birthday ${details.birthday} · KASA will plan ahead.`
                  : "Add birthday and goals for smarter guidance."}
              </Text>
            </View>
            <SymbolView name="chevron.right" size={13} tintColor="#FFFFFF" />
          </Pressable>

          <View style={s.quickRow}>
            {quickActions.map(([icon, label]) => (
              <Pressable
                key={label}
                style={[
                  s.quickCard,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View
                  style={[
                    s.quickIcon,
                    { backgroundColor: c.backgroundElement },
                  ]}
                >
                  <SymbolView name={icon} size={20} tintColor={c.text} />
                </View>
                <Text style={[s.quickLabel, { color: c.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.sectionLabel, { color: c.textSecondary }]}>
            YOUR KASA
          </Text>
          <View
            style={[
              s.settings,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {settings.map(([icon, label, value], index) => (
              <Pressable
                key={label}
                onPress={() => {
                  if (label === "Personal details")
                    router.push("/edit-profile");
                  if (label === "Automation & sources")
                    router.push("/integrations");
                  if (label === "Notifications") router.push("/notifications");
                }}
                style={[
                  s.settingRow,
                  index > 0 && { borderTopColor: c.border, borderTopWidth: 1 },
                ]}
              >
                <View
                  style={[
                    s.settingIcon,
                    { backgroundColor: c.backgroundElement },
                  ]}
                >
                  <SymbolView name={icon} size={16} tintColor={c.brand} />
                </View>
                <View style={s.settingCopy}>
                  <Text style={[s.settingTitle, { color: c.text }]}>
                    {label}
                  </Text>
                  <Text style={[s.settingValue, { color: c.textSecondary }]}>
                    {value}
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

          <Text style={[s.sectionLabel, { color: c.textSecondary }]}>
            ACCOUNT
          </Text>
          <View
            style={[
              s.settings,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Pressable style={s.settingRow}>
              <View
                style={[
                  s.settingIcon,
                  { backgroundColor: c.backgroundElement },
                ]}
              >
                <SymbolView name="icloud.fill" size={16} tintColor={c.brand} />
              </View>
              <View style={s.settingCopy}>
                <Text style={[s.settingTitle, { color: c.text }]}>
                  Sync & backup
                </Text>
                <Text style={[s.settingValue, { color: c.textSecondary }]}>
                  Your data is up to date
                </Text>
              </View>
              <View style={[s.synced, { backgroundColor: c.brandSoft }]}>
                <Text style={[s.syncedText, { color: c.brand }]}>SYNCED</Text>
              </View>
            </Pressable>
          </View>

          <Pressable
            disabled={signingOut}
            onPress={confirmSignOut}
            style={[
              s.logout,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {signingOut ? (
              <KasaSpinner size={19} color="#D43C32" />
            ) : (
              <SymbolView
                name="rectangle.portrait.and.arrow.right"
                size={17}
                tintColor="#D43C32"
              />
            )}
            <Text style={s.logoutText}>Sign out</Text>
          </Pressable>
          <Text style={[s.version, { color: c.textSecondary }]}>
            KASA LifeOS · Version 1.0.0
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 260,
    opacity: 0.07,
    top: -130,
    right: -110,
  },
  nav: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: { fontSize: 16, fontWeight: "800" },
  navSpacer: { width: 40 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36 },
  identity: { flexDirection: "row", alignItems: "center", marginVertical: 13 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(255,79,31,0.24)",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 22 },
  identityCopy: { flex: 1, marginLeft: 14 },
  name: { fontSize: 22, fontWeight: "900", letterSpacing: -0.7 },
  email: { fontSize: 11, marginTop: 4 },
  edit: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  completeCard: {
    minHeight: 112,
    borderRadius: 26,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
    overflow: "hidden",
  },
  completeIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  completeCopy: { flex: 1, marginLeft: 12 },
  completeEyebrow: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  completeTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  completeText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 9,
    lineHeight: 13,
    marginTop: 4,
  },
  quickRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  quickCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 10, fontWeight: "800", marginTop: 9 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.25,
    marginTop: 28,
    marginBottom: 10,
  },
  settings: { borderWidth: 1, borderRadius: 24, paddingHorizontal: 13 },
  settingRow: { minHeight: 67, flexDirection: "row", alignItems: "center" },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingCopy: { flex: 1, marginLeft: 11 },
  settingTitle: { fontSize: 13, fontWeight: "700" },
  settingValue: { fontSize: 9, marginTop: 3 },
  synced: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 6 },
  syncedText: { fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  logout: {
    height: 54,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 24,
  },
  logoutText: { color: "#D43C32", fontSize: 14, fontWeight: "800" },
  version: { textAlign: "center", fontSize: 9, marginTop: 14 },
});
