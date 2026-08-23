import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState, type ComponentProps } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { getProfileDetails, saveProfileDetails } from "@/lib/profile-details";

function ProfileField({
  label,
  colors,
  ...props
}: {
  label: string;
  colors: ReturnType<typeof useTheme>;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textSecondary}
        style={[
          s.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const c = useTheme();
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    getProfileDetails(session.user.id).then((details) => {
      setName(session.user.name || "");
      setPreferredName(details.preferredName);
      setPhone(details.phone);
      setBirthday(details.birthday);
    });
  }, [session?.user.id, session?.user.name]);

  async function save() {
    if (!session?.user.id || name.trim().length < 2) {
      setMessage("Please enter your full name.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await authClient.updateUser({ name: name.trim() });
      if (result.error) {
        setMessage(result.error.message || "Profile could not be updated.");
        return;
      }
      await saveProfileDetails(session.user.id, {
        birthday: birthday.trim(),
        phone: phone.trim(),
        preferredName: preferredName.trim(),
      });
      router.back();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Profile could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (isPending) {
    return (
      <View style={[s.center, { backgroundColor: c.background }]}>
        <KasaSpinner size={28} />
      </View>
    );
  }
  if (!session?.user) return <Redirect href="/sign-in" />;

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "K";

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
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
          <Text style={[s.navTitle, { color: c.text }]}>Edit profile</Text>
          <Pressable disabled={saving} onPress={save}>
            <Text style={[s.saveTop, { color: c.brand }]}>Save</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.safe}
        >
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[s.avatar, { backgroundColor: c.brand }]}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <Text style={[s.photoHint, { color: c.textSecondary }]}>
              PROFILE IDENTITY
            </Text>

            <ProfileField
              colors={c}
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
            />
            <ProfileField
              colors={c}
              label="What should KASA call you?"
              value={preferredName}
              onChangeText={setPreferredName}
              placeholder="Preferred name"
            />
            <ProfileField
              colors={c}
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
            />
            <ProfileField
              colors={c}
              label="Birthday"
              value={birthday}
              onChangeText={setBirthday}
              placeholder="DD / MM / YYYY"
              keyboardType="numbers-and-punctuation"
            />

            <View
              style={[s.emailCard, { backgroundColor: c.backgroundElement }]}
            >
              <SymbolView name="envelope.fill" size={16} tintColor={c.brand} />
              <View style={s.emailCopy}>
                <Text style={[s.emailLabel, { color: c.textSecondary }]}>
                  SIGNED-IN EMAIL
                </Text>
                <Text style={[s.email, { color: c.text }]}>
                  {session.user.email}
                </Text>
              </View>
              <SymbolView
                name="checkmark.seal.fill"
                size={16}
                tintColor={c.positive}
              />
            </View>
            {message ? <Text style={s.error}>{message}</Text> : null}
            <Pressable
              disabled={saving}
              onPress={save}
              style={[s.saveButton, { backgroundColor: c.brand }]}
            >
              {saving ? (
                <KasaSpinner color="#FFFFFF" size={20} />
              ) : (
                <>
                  <Text style={s.saveText}>Save changes</Text>
                  <SymbolView name="checkmark" size={15} tintColor="#FFFFFF" />
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  saveTop: { fontSize: 13, fontWeight: "800", width: 40, textAlign: "right" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 29,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 28px rgba(255,79,31,0.22)",
  },
  avatarText: { color: "#FFFFFF", fontSize: 25, fontWeight: "900" },
  photoHint: {
    textAlign: "center",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 10,
    marginBottom: 20,
  },
  fieldWrap: { marginBottom: 15 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 7, marginLeft: 2 },
  input: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 15,
    fontSize: 14,
  },
  emailCard: {
    minHeight: 66,
    borderRadius: 20,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  emailCopy: { flex: 1, marginLeft: 11 },
  emailLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  email: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  error: { color: "#D43C32", fontSize: 11, textAlign: "center", marginTop: 13 },
  saveButton: {
    height: 54,
    borderRadius: 18,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
