import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import {
  deletePerson,
  getPerson,
  updatePerson,
  type PersonDetail,
} from "@/lib/people";

const categories = [
  "FAMILY",
  "FRIEND",
  "WORK",
  "DOCTOR",
  "HOME_SERVICE",
  "OTHER",
];

export default function PersonScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("FRIEND");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setPerson(await getPerson(id));
    } catch (cause) {
      Alert.alert(
        "Could not open person",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openEditor() {
    if (!person) return;
    setName(person.name);
    setPhone(person.phone ?? "");
    setEmail(person.email ?? "");
    setCategory(person.category);
    setEditing(true);
  }

  async function saveProfile() {
    if (!person || name.trim().length < 2)
      return Alert.alert(
        "Add a name",
        "Enter at least two letters for this person.",
      );
    setSaving(true);
    try {
      const updated = await updatePerson(person.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        category,
      });
      setPerson((current) => (current ? { ...current, ...updated } : current));
      setEditing(false);
    } catch (cause) {
      Alert.alert(
        "Could not save profile",
        cause instanceof Error
          ? cause.message
          : "Please check the contact details.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function openContact(kind: "phone" | "message" | "email") {
    if (!person) return;
    const value = kind === "email" ? person.email : person.phone;
    if (!value)
      return Alert.alert(
        "Missing detail",
        `Add a ${kind === "email" ? "valid email address" : "phone number"} first.`,
      );
    const url =
      kind === "phone"
        ? `tel:${value}`
        : kind === "message"
          ? `sms:${value}`
          : `mailto:${encodeURIComponent(value)}`;
    try {
      if (!(await Linking.canOpenURL(url)))
        throw new Error("This action is not available on this device.");
      await Linking.openURL(url);
    } catch (cause) {
      Alert.alert(
        "Could not open contact",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  }

  async function updateFlag(input: {
    favorite?: boolean;
    emergency?: boolean;
  }) {
    if (!person || savingFavorite) return;
    setSavingFavorite(true);
    try {
      const updated = await updatePerson(person.id, input);
      setPerson((current) => (current ? { ...current, ...updated } : current));
    } catch (cause) {
      Alert.alert(
        "Could not update contact",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setSavingFavorite(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      `Remove ${person?.name ?? "this person"}?`,
      "This permanently removes the person and their linked Khata entries.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            if (!person) return;
            setDeleting(true);
            void deletePerson(person.id)
              .then(() => router.replace("/people"))
              .catch((cause) => {
                setDeleting(false);
                Alert.alert(
                  "Could not remove person",
                  cause instanceof Error ? cause.message : "Please try again.",
                );
              });
          },
        },
      ],
    );
  }

  if (!person)
    return (
      <View style={[s.loading, { backgroundColor: c.background }]}>
        <KasaSpinner size={28} />
        <Text style={[s.loadingText, { color: c.textSecondary }]}>
          Loading contact…
        </Text>
      </View>
    );
  const actions: Array<{ icon: string; label: string; onPress: () => void }> = [
    {
      icon: "phone.fill",
      label: "Call",
      onPress: () => void openContact("phone"),
    },
    {
      icon: "message.fill",
      label: "Message",
      onPress: () => void openContact("message"),
    },
    {
      icon: "envelope.fill",
      label: "Email",
      onPress: () => void openContact("email"),
    },
    { icon: "pencil", label: "Edit", onPress: openEditor },
  ];

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <SafeAreaView style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.nav}>
            <Pressable
              onPress={() => router.back()}
              style={[
                s.iconButton,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="chevron.left" size={16} tintColor={c.text} />
            </Pressable>
            <View style={s.navActions}>
              <Pressable
                disabled={savingFavorite}
                onPress={() => void updateFlag({ favorite: !person.favorite })}
                style={[
                  s.iconButton,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                {savingFavorite ? (
                  <KasaSpinner size={14} />
                ) : (
                  <SymbolView
                    name={person.favorite ? "star.fill" : "star"}
                    size={15}
                    tintColor={person.favorite ? c.brand : c.textSecondary}
                  />
                )}
              </Pressable>
              <Pressable
                disabled={deleting}
                onPress={confirmDelete}
                style={[
                  s.iconButton,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                {deleting ? (
                  <KasaSpinner size={14} />
                ) : (
                  <SymbolView name="trash" size={14} tintColor="#E5484D" />
                )}
              </Pressable>
            </View>
          </View>
          <View style={[s.hero, { backgroundColor: c.brand }]}>
            <Text style={s.heroEyebrow}>
              {person.category.replaceAll("_", " ")}
              {person.emergency ? " · EMERGENCY" : ""}
            </Text>
            <Text style={s.heroName}>{person.name}</Text>
            <Text style={s.heroDetail}>
              {person.phone ||
                person.email ||
                "Add a phone number to call or message."}
            </Text>
          </View>
          <View
            style={[
              s.actions,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={s.action}
              >
                <View style={[s.actionIcon, { backgroundColor: c.brandSoft }]}>
                  <SymbolView
                    name={action.icon as never}
                    size={14}
                    tintColor={c.brand}
                  />
                </View>
                <Text style={[s.actionText, { color: c.textSecondary }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View
            style={[
              s.infoCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.infoLabel, { color: c.textSecondary }]}>
              CONTACT DETAILS
            </Text>
            <Text style={[s.infoName, { color: c.text }]}>{person.name}</Text>
            {person.phone ? (
              <Text style={[s.infoValue, { color: c.textSecondary }]}>
                {person.phone}
              </Text>
            ) : null}
            {person.email ? (
              <Text style={[s.infoValue, { color: c.textSecondary }]}>
                {person.email}
              </Text>
            ) : null}
            <Pressable
              disabled={savingFavorite}
              onPress={() => void updateFlag({ emergency: !person.emergency })}
              style={[
                s.emergencyToggle,
                { backgroundColor: person.emergency ? "#FEE2E2" : c.brandSoft },
              ]}
            >
              <SymbolView
                name="exclamationmark.shield.fill"
                size={14}
                tintColor={person.emergency ? "#E5484D" : c.brand}
              />
              <Text
                style={[
                  s.emergencyText,
                  { color: person.emergency ? "#B42318" : c.brand },
                ]}
              >
                {person.emergency
                  ? "Emergency contact"
                  : "Mark as emergency contact"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
      <Modal visible={editing} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modal}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setEditing(false)}
          />
          <View style={[s.sheet, { backgroundColor: c.background }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.sheetScroll}
            >
              <Text style={[s.sheetTitle, { color: c.text }]}>
                Edit contact
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={c.textSecondary}
                style={[
                  s.input,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Phone number"
                placeholderTextColor={c.textSecondary}
                style={[
                  s.input,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Email address"
                placeholderTextColor={c.textSecondary}
                style={[
                  s.input,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
              />
              <View style={s.chips}>
                {categories.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setCategory(item)}
                    style={[
                      s.chip,
                      {
                        backgroundColor:
                          category === item ? c.brand : c.surface,
                        borderColor: category === item ? c.brand : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.chipText,
                        { color: category === item ? "#fff" : c.textSecondary },
                      ]}
                    >
                      {item.replaceAll("_", " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                disabled={saving}
                onPress={() => void saveProfile()}
                style={[
                  s.save,
                  { backgroundColor: c.brand, opacity: saving ? 0.7 : 1 },
                ]}
              >
                {saving ? (
                  <KasaSpinner size={18} color="#fff" />
                ) : (
                  <Text style={s.saveText}>Save contact</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: 20, paddingTop: 12, paddingBottom: 70 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 11 },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { borderRadius: 28, padding: 20, marginTop: 18 },
  heroEyebrow: {
    color: "rgba(255,255,255,.72)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroName: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 8,
  },
  heroDetail: { color: "rgba(255,255,255,.82)", fontSize: 11, marginTop: 5 },
  actions: {
    borderWidth: 1,
    borderRadius: 23,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  action: { width: "24%", alignItems: "center", gap: 5 },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 7, fontWeight: "900" },
  infoCard: { borderWidth: 1, borderRadius: 25, padding: 17, marginTop: 16 },
  infoLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  infoName: { fontSize: 17, fontWeight: "900", marginTop: 9 },
  infoValue: { fontSize: 11, marginTop: 4 },
  emergencyToggle: {
    height: 43,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emergencyText: { fontSize: 10, fontWeight: "900" },
  modal: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,9,5,.48)",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 11,
  },
  sheetScroll: { padding: 20, paddingTop: 14, paddingBottom: 34 },
  sheetTitle: { fontSize: 21, fontWeight: "900" },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 13,
    fontSize: 12,
    marginTop: 11,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 },
  chip: {
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 8, fontWeight: "900" },
  save: {
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  saveText: { color: "#fff", fontSize: 11, fontWeight: "900" },
});
