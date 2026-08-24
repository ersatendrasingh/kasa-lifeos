import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  hasPhoneContactsPermission,
  shouldAutoSyncPhoneContacts,
  syncPhoneContacts,
} from "@/lib/contacts";
import {
  createPerson,
  deletePerson,
  listPeople,
  type Person,
} from "@/lib/people";

const categories = [
  "FAMILY",
  "FRIEND",
  "WORK",
  "DOCTOR",
  "HOME_SERVICE",
  "OTHER",
];
const alphabetIndex = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

export default function PeopleScreen() {
  const c = useTheme();
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("FRIEND");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [contactsAllowed, setContactsAllowed] = useState(false);
  const autoSyncStarted = useRef(false);
  const listScroll = useRef<ScrollView>(null);
  const [letterOffsets, setLetterOffsets] = useState<Record<string, number>>(
    {},
  );

  const groups = useMemo(() => {
    const byLetter = new Map<string, Person[]>();
    for (const person of [...people].sort((left, right) =>
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
    )) {
      const initial = person.name.trim().charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(initial) ? initial : "#";
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), person]);
    }
    return [...byLetter.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [people]);

  const load = useCallback(async () => {
    try {
      setPeople(await listPeople(query));
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const syncContacts = useCallback(
    async (requestAccess: boolean, showResult: boolean, silent = false) => {
      if (!silent) {
        setImporting(true);
        setImportProgress(4);
      }
      try {
        const result = await syncPhoneContacts(
          requestAccess,
          silent ? undefined : setImportProgress,
        );
        setContactsAllowed(true);
        await load();
        if (showResult)
          Alert.alert(
            "Contacts synced",
            `${result.imported} contacts added. ${result.skipped} already existed.`,
          );
      } catch (cause) {
        if (showResult)
          Alert.alert(
            "Contacts sync",
            cause instanceof Error ? cause.message : "Could not sync contacts.",
          );
      } finally {
        if (!silent) {
          setImporting(false);
          setImportProgress(0);
        }
      }
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      void (async () => {
        try {
          const granted = await hasPhoneContactsPermission();
          setContactsAllowed(granted);
          if (
            granted &&
            !autoSyncStarted.current &&
            (await shouldAutoSyncPhoneContacts())
          ) {
            autoSyncStarted.current = true;
            await syncContacts(false, false, true);
          }
        } catch {
          setContactsAllowed(false);
        }
      })();
    }, [load, syncContacts]),
  );

  async function add() {
    if (name.trim().length < 2)
      return Alert.alert(
        "Add a name",
        "Enter at least two letters for this person.",
      );
    setSaving(true);
    try {
      const person = await createPerson({
        name: name.trim(),
        category,
        phone: phone.trim() || undefined,
      });
      setPeople((current) => [
        person,
        ...current.filter((item) => item.id !== person.id),
      ]);
      setName("");
      setPhone("");
      setAdding(false);
      router.push(`/person/${person.id}`);
    } catch (cause) {
      Alert.alert(
        "Could not save person",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(person: Person, controls?: SwipeableMethods) {
    controls?.close();
    Alert.alert(
      `Remove ${person.name}?`,
      "This permanently removes their relationship memories and any Khata entries linked to them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setPeople((current) =>
              current.filter((item) => item.id !== person.id),
            );
            void deletePerson(person.id).catch((cause) => {
              void load();
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

  function swipeActions(person: Person, controls: SwipeableMethods) {
    return (
      <View style={s.swipeActions}>
        <Pressable
          accessibilityLabel={`Remove ${person.name}`}
          onPress={() => confirmDelete(person, controls)}
          style={s.swipeDelete}
        >
          <SymbolView name="trash.fill" size={17} tintColor="#fff" />
          <Text style={s.swipeText}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          ref={listScroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader label="People" />
          <Text style={[s.eyebrow, { color: c.brand }]}>
            RELATIONSHIP MEMORY
          </Text>
          <Text style={[s.title, { color: c.text }]}>People, remembered.</Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            Contacts, shared context and the details that matter.
          </Text>
          <View
            style={[
              s.search,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView
              name="magnifyingglass"
              size={16}
              tintColor={c.textSecondary}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search people, notes or work…"
              placeholderTextColor={c.textSecondary}
              style={[s.searchInput, { color: c.text }]}
            />
          </View>
          <Pressable
            onPress={() => setAdding(true)}
            style={[s.add, { backgroundColor: c.brand }]}
          >
            <SymbolView name="person.badge.plus" size={16} tintColor="#fff" />
            <Text style={s.addText}>Add a person</Text>
          </Pressable>
          <Pressable
            disabled={importing}
            onPress={() => void syncContacts(true, true)}
            style={[
              s.import,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                opacity: importing ? 0.7 : 1,
              },
            ]}
          >
            {importing ? (
              <KasaSpinner size={16} />
            ) : (
              <SymbolView
                name="person.crop.circle.badge.plus"
                size={15}
                tintColor={c.brand}
              />
            )}
            <Text style={[s.importText, { color: c.brand }]}>
              {importing
                ? `Syncing contacts ${importProgress}%`
                : contactsAllowed
                  ? "Sync phone contacts"
                  : "Allow & sync phone contacts"}
            </Text>
          </Pressable>
          {importing ? (
            <View
              style={[
                s.progressTrack,
                { backgroundColor: c.backgroundElement },
              ]}
            >
              <View
                style={[
                  s.progressFill,
                  { backgroundColor: c.brand, width: `${importProgress}%` },
                ]}
              />
            </View>
          ) : null}
          <Text style={[s.privacy, { color: c.textSecondary }]}>
            {contactsAllowed
              ? "Your phone contacts sync automatically and stay private in KASA. Khata uses this same circle."
              : "Allow contact access once to automatically keep your private KASA circle ready for Khata."}
          </Text>
          <Text style={[s.section, { color: c.text }]}>
            Your circle{" "}
            <Text style={[s.count, { color: c.textSecondary }]}>
              {people.length}
            </Text>
          </Text>
          {loading ? (
            <KasaSpinner size={25} />
          ) : people.length ? (
            groups.map(([letter, entries]) => (
              <View
                key={letter}
                onLayout={(event) => {
                  const y = event?.nativeEvent?.layout?.y;
                  if (typeof y === "number")
                    setLetterOffsets((current) =>
                      current[letter] === y
                        ? current
                        : { ...current, [letter]: y },
                    );
                }}
              >
                <Text style={[s.letterHeading, { color: c.brand }]}>
                  {letter}
                </Text>
                {entries.map((person) => (
                  <ReanimatedSwipeable
                    key={person.id}
                    containerStyle={s.swipeContainer}
                    friction={1.6}
                    overshootRight={false}
                    rightThreshold={56}
                    renderRightActions={(_progress, _translation, controls) =>
                      swipeActions(person, controls)
                    }
                  >
                    <Pressable
                      onPress={() => router.push(`/person/${person.id}`)}
                      style={[
                        s.person,
                        { backgroundColor: c.surface, borderColor: c.border },
                      ]}
                    >
                      <View
                        style={[s.avatar, { backgroundColor: c.brandSoft }]}
                      >
                        <Text style={[s.initial, { color: c.brand }]}>
                          {person.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={s.personCopy}>
                        <Text style={[s.personName, { color: c.text }]}>
                          {person.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[s.personMeta, { color: c.textSecondary }]}
                        >
                          {person.category.replaceAll("_", " ")} ·{" "}
                          {person.phone ||
                            (person.lastContactAt
                              ? `Last contact ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(person.lastContactAt))}`
                              : "Start their shared history")}
                        </Text>
                      </View>
                      {person.favorite ? (
                        <SymbolView
                          name="star.fill"
                          size={13}
                          tintColor={c.brand}
                        />
                      ) : (
                        <SymbolView
                          name="chevron.right"
                          size={10}
                          tintColor={c.textSecondary}
                        />
                      )}
                    </Pressable>
                  </ReanimatedSwipeable>
                ))}
              </View>
            ))
          ) : (
            <View
              style={[
                s.empty,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView
                name="brain.head.profile.fill"
                size={26}
                tintColor={c.brand}
              />
              <Text style={[s.emptyTitle, { color: c.text }]}>
                Start with one person
              </Text>
              <Text style={[s.emptyText, { color: c.textSecondary }]}>
                Import contacts or add Mom, your doctor, a colleague or a
                trusted service person. Khata will use this same private circle.
              </Text>
            </View>
          )}
        </ScrollView>
        {!loading && groups.length ? (
          <View
            style={[
              s.letterRail,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {alphabetIndex.map((letter) => {
              const available = typeof letterOffsets[letter] === "number";
              return (
                <Pressable
                  key={letter}
                  accessibilityLabel={`Jump to ${letter}`}
                  disabled={!available}
                  onPress={() =>
                    listScroll.current?.scrollTo({
                      y: Math.max(0, (letterOffsets[letter] ?? 0) - 10),
                      animated: true,
                    })
                  }
                  hitSlop={5}
                  style={s.letterRailButton}
                >
                  <Text
                    style={[
                      s.letterRailText,
                      {
                        color: available ? c.brand : c.textSecondary,
                        opacity: available ? 1 : 0.3,
                      },
                    ]}
                  >
                    {letter}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </SafeAreaView>
      <Modal visible={adding} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.modal}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAdding(false)}
          />
          <View style={[s.sheet, { backgroundColor: c.background }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>Add a person</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={c.textSecondary}
                style={[
                  s.nameInput,
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
                placeholder="Phone number (optional)"
                placeholderTextColor={c.textSecondary}
                style={[
                  s.nameInput,
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
                onPress={() => void add()}
                style={[
                  s.add,
                  { backgroundColor: c.brand, opacity: saving ? 0.7 : 1 },
                ]}
              >
                {saving ? (
                  <KasaSpinner size={18} color="#fff" />
                ) : (
                  <>
                    <Text style={s.addText}>Create relationship profile</Text>
                    <SymbolView name="arrow.right" size={14} tintColor="#fff" />
                  </>
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
  content: { padding: 20, paddingTop: 8, paddingRight: 39, paddingBottom: 120 },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -1.3, marginTop: 8 },
  subtitle: { fontSize: 12, marginTop: 4 },
  search: {
    height: 52,
    borderWidth: 1,
    borderRadius: 18,
    marginTop: 18,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: { flex: 1, fontSize: 12 },
  add: {
    height: 51,
    borderRadius: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  import: {
    height: 43,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  importText: { fontSize: 10, fontWeight: "900" },
  progressTrack: {
    height: 5,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: { height: 5, borderRadius: 5 },
  privacy: { fontSize: 8, lineHeight: 12, marginTop: 8, paddingHorizontal: 3 },
  section: { fontSize: 18, fontWeight: "900", marginTop: 25, marginBottom: 10 },
  count: { fontSize: 11, fontWeight: "700" },
  letterHeading: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 11,
    marginBottom: 6,
    paddingLeft: 2,
  },
  letterRail: {
    position: "absolute",
    right: 2,
    top: "17%",
    bottom: "6%",
    width: 30,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "space-around",
  },
  letterRailButton: {
    width: 28,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  letterRailText: { fontSize: 8, lineHeight: 10, fontWeight: "900" },
  swipeContainer: { borderRadius: 22, overflow: "hidden", marginBottom: 8 },
  swipeActions: {
    width: 78,
    backgroundColor: "#E5484D",
    alignItems: "center",
    justifyContent: "center",
  },
  swipeDelete: {
    flex: 1,
    width: 78,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  swipeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  person: {
    minHeight: 73,
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 18, fontWeight: "900" },
  personCopy: { flex: 1, marginLeft: 11 },
  personName: { fontSize: 13, fontWeight: "900" },
  personMeta: { fontSize: 8, marginTop: 4 },
  empty: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 15, fontWeight: "900", marginTop: 10 },
  emptyText: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 5,
  },
  modal: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,9,5,0.48)",
  },
  sheet: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    alignSelf: "center",
    marginBottom: 17,
  },
  sheetTitle: { fontSize: 22, fontWeight: "900" },
  nameInput: {
    height: 53,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
    marginTop: 10,
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
});
