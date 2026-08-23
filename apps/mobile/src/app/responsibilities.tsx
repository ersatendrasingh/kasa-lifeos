import { SymbolView } from "expo-symbols";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import {
  DeviceEventEmitter,
  Keyboard,
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
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CompactNavDock } from "@/components/compact-nav-dock";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  createResponsibility,
  listResponsibilities,
  payResponsibility,
  updateResponsibility,
  type Responsibility,
} from "@/lib/responsibilities";

const areas = [
  ["HOME", "Home", "house.fill"],
  ["FINANCE", "Finance", "indianrupeesign.circle.fill"],
  ["VEHICLE", "Vehicle", "car.fill"],
  ["HEALTH", "Health", "heart.fill"],
  ["FAMILY", "Family", "person.2.fill"],
  ["DOCUMENTS", "Documents", "doc.text.fill"],
  ["SUBSCRIPTIONS", "Subscriptions", "rectangle.stack.fill"],
] as const;
const leadOptions = [7, 3, 1];
const providerSuggestions: Record<string, string[]> = {
  HOME: ["BSES", "Tata Power", "UPPCL"],
  FINANCE: ["Bank", "NBFC", "Credit card"],
  VEHICLE: ["Service centre", "Insurance provider"],
  HEALTH: ["Pharmacy", "Clinic"],
  FAMILY: ["School", "Care provider"],
  DOCUMENTS: ["Government portal", "Agency"],
  SUBSCRIPTIONS: ["Netflix", "ChatGPT", "GitHub Copilot"],
};
const dateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

export default function ResponsibilitiesScreen() {
  const c = useTheme();
  const [items, setItems] = useState<Responsibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Responsibility | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [title, setTitle] = useState("Electricity bill");
  const [provider, setProvider] = useState("");
  const [area, setArea] = useState<(typeof areas)[number][0]>("HOME");
  const [cadence, setCadence] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">(
    "MONTHLY",
  );
  const [dueDate, setDueDate] = useState(() => {
    const value = new Date();
    value.setMonth(value.getMonth() + 1);
    value.setDate(15);
    return dateKey(value);
  });
  const [leads, setLeads] = useState<number[]>([7, 3, 1]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    void listResponsibilities()
      .then((values) => {
        if (active) setItems(values);
      })
      .catch(() => {
        if (active)
          setError("Could not load responsibilities. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const dueSoon = useMemo(
    () =>
      items.filter(
        (item) =>
          new Date(item.nextDueAt).getTime() - referenceNow < 8 * 86_400_000,
      ),
    [items, referenceNow],
  );

  async function save() {
    Keyboard.dismiss();
    if (
      !title.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
      !leads.length
    ) {
      setError("Add a name, due date and at least one notification.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = {
        title: title.trim(),
        area,
        provider: provider.trim() || null,
        cadence,
        dueDate,
        notificationDays: leads,
      };
      const created = editingId
        ? await updateResponsibility(editingId, input)
        : await createResponsibility(input);
      setItems((current) =>
        (editingId
          ? current.map((item) => (item.id === created.id ? created : item))
          : [...current, created]
        ).sort((a, b) => +new Date(a.nextDueAt) - +new Date(b.nextDueAt)),
      );
      setAdding(false);
      setEditingId(null);
      setShowDatePicker(false);
      DeviceEventEmitter.emit("kasa:notifications-changed");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this responsibility.",
      );
    } finally {
      setSaving(false);
    }
  }
  function openEdit(item: Responsibility) {
    setTitle(item.title);
    setProvider(item.provider ?? "");
    setArea(item.area as (typeof areas)[number][0]);
    setCadence(item.cadence);
    setDueDate(dateKey(new Date(item.nextDueAt)));
    setLeads(item.notificationDays);
    setEditingId(item.id);
    setSelected(null);
    setAdding(true);
  }
  async function markPaid(item: Responsibility) {
    setPaying(item.id);
    try {
      const updated = await payResponsibility(item.id);
      setItems((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setSelected((current) =>
        current?.id === updated.id ? updated : current,
      );
      DeviceEventEmitter.emit("kasa:notifications-changed");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not mark this as paid.",
      );
    } finally {
      setPaying(null);
    }
  }
  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader label="Responsibilities" />
          <Text style={[s.eyebrow, { color: c.brand }]}>
            RECURRING, MADE CALM
          </Text>
          <Text style={[s.title, { color: c.text }]}>
            The things that keep life moving.
          </Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            Set each responsibility once. KASA remembers the due cycle and only
            alerts you when it is useful.
          </Text>
          <View
            style={[
              s.summary,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View>
              <Text style={[s.summaryValue, { color: c.text }]}>
                {items.length}
              </Text>
              <Text style={[s.summaryLabel, { color: c.textSecondary }]}>
                Active
              </Text>
            </View>
            <View style={s.summaryDivider} />
            <View>
              <Text style={[s.summaryValue, { color: c.brand }]}>
                {dueSoon.length}
              </Text>
              <Text style={[s.summaryLabel, { color: c.textSecondary }]}>
                Due this week
              </Text>
            </View>
          </View>
          {error && <Text style={[s.error, { color: c.brand }]}>{error}</Text>}
          <Text style={[s.sectionTitle, { color: c.text }]}>
            Your responsibilities
          </Text>
          {loading ? (
            <View style={s.loading}>
              <KasaSpinner size={26} />
            </View>
          ) : items.length ? (
            <View style={s.tileGrid}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setSelected(item)}
                  style={s.tile}
                >
                  <View style={[s.tileIcon, { backgroundColor: c.brandSoft }]}>
                    <SymbolView
                      name={
                        areas.find(([key]) => key === item.area)?.[2] ??
                        "repeat"
                      }
                      size={19}
                      tintColor={c.brand}
                    />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[s.tileTitle, { color: c.text }]}
                  >
                    {item.title}
                  </Text>
                  <Text style={[s.tileDue, { color: c.textSecondary }]}>
                    Due{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                    }).format(new Date(item.nextDueAt))}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setEditingId(null);
                  setTitle("");
                  setProvider("");
                  setAdding(true);
                }}
                style={[s.tile, s.addTile, { borderColor: c.border }]}
              >
                <View style={[s.tileIcon, { backgroundColor: c.surface }]}>
                  <SymbolView name="plus" size={19} tintColor={c.brand} />
                </View>
                <Text style={[s.tileTitle, { color: c.text }]}>Add new</Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={[
                s.empty,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="sparkles" size={24} tintColor={c.brand} />
              <Text style={[s.emptyTitle, { color: c.text }]}>
                Nothing to chase yet.
              </Text>
              <Text style={[s.emptyText, { color: c.textSecondary }]}>
                Add a bill, renewal or subscription and KASA will keep the cycle
                on track.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <CompactNavDock />
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.detailBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelected(null)}
          />
          {selected && (
            <View style={[s.detailSheet, { backgroundColor: c.background }]}>
              <View style={[s.handle, { backgroundColor: c.border }]} />
              <View style={s.detailTop}>
                <View style={[s.detailIcon, { backgroundColor: c.brandSoft }]}>
                  <SymbolView
                    name={
                      areas.find(([key]) => key === selected.area)?.[2] ??
                      "repeat"
                    }
                    size={21}
                    tintColor={c.brand}
                  />
                </View>
                <View style={s.detailCopy}>
                  <Text style={[s.detailTitle, { color: c.text }]}>
                    {selected.title}
                  </Text>
                  <Text style={[s.detailMeta, { color: c.textSecondary }]}>
                    {selected.provider || "Personal responsibility"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => openEdit(selected)}
                  style={[
                    s.editButton,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <SymbolView name="pencil" size={13} tintColor={c.text} />
                  <Text style={[s.editText, { color: c.text }]}>Edit</Text>
                </Pressable>
              </View>
              <View
                style={[
                  s.detailDue,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View>
                  <Text style={[s.detailLabel, { color: c.textSecondary }]}>
                    NEXT DUE
                  </Text>
                  <Text style={[s.detailDate, { color: c.text }]}>
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(selected.nextDueAt))}
                  </Text>
                </View>
                <Text style={[s.detailRepeat, { color: c.brand }]}>
                  {selected.cadence.toLowerCase()}
                </Text>
              </View>
              <Text style={[s.detailNotice, { color: c.textSecondary }]}>
                KASA will notify you {selected.notificationDays.join(", ")} days
                before. Mark paid to move this responsibility to its next cycle.
              </Text>
              <Pressable
                onPress={() => void markPaid(selected)}
                disabled={paying === selected.id}
                style={[s.detailPaid, { backgroundColor: c.brand }]}
              >
                {paying === selected.id ? (
                  <KasaSpinner color="#FFFFFF" size={18} />
                ) : (
                  <>
                    <SymbolView
                      name="checkmark"
                      size={16}
                      tintColor="#FFFFFF"
                    />
                    <Text style={s.detailPaidText}>Mark as paid</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
      {adding && (
        <View style={[s.setupScreen, { backgroundColor: c.background }]}>
          <SafeAreaView edges={["top"]} style={s.safe}>
            <KeyboardAvoidingView
              style={s.safe}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                contentContainerStyle={s.setupContent}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={Keyboard.dismiss}
              >
                <View style={s.setupHeader}>
                  <Pressable
                    accessibilityLabel="Close setup"
                    onPress={() => {
                      Keyboard.dismiss();
                      setAdding(false);
                    }}
                    style={[
                      s.closeSetup,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <SymbolView
                      name="chevron.left"
                      size={16}
                      tintColor={c.text}
                    />
                  </Pressable>
                  <Text style={[s.setupProgress, { color: c.textSecondary }]}>
                    SET UP ONCE
                  </Text>
                </View>
                <View style={[s.setupHero, { backgroundColor: c.brandSoft }]}>
                  <SymbolView name="repeat" size={21} tintColor={c.brand} />
                  <View style={s.setupHeroCopy}>
                    <Text style={[s.setupHeroTitle, { color: c.text }]}>
                      A responsibility, not another reminder.
                    </Text>
                    <Text style={[s.setupHeroText, { color: c.textSecondary }]}>
                      Mark it paid each cycle. KASA prepares the next one
                      automatically.
                    </Text>
                  </View>
                </View>
                <Text style={[s.sheetTitle, { color: c.text }]}>
                  Add responsibility
                </Text>
                <Text style={[s.sheetText, { color: c.textSecondary }]}>
                  One setup. KASA handles every following due date.
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What should KASA remember?"
                  placeholderTextColor={c.textSecondary}
                  style={[
                    s.input,
                    {
                      color: c.text,
                      borderColor: c.border,
                      backgroundColor: c.surface,
                    },
                  ]}
                />
                <TextInput
                  value={provider}
                  onChangeText={setProvider}
                  placeholder="Provider (optional)"
                  placeholderTextColor={c.textSecondary}
                  style={[
                    s.input,
                    {
                      color: c.text,
                      borderColor: c.border,
                      backgroundColor: c.surface,
                    },
                  ]}
                />
                <View style={s.providerSuggestions}>
                  {providerSuggestions[area].map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setProvider(value)}
                      style={[
                        s.suggestion,
                        {
                          borderColor: provider === value ? c.brand : c.border,
                          backgroundColor:
                            provider === value ? c.brandSoft : c.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.suggestionText,
                          {
                            color:
                              provider === value ? c.brand : c.textSecondary,
                          },
                        ]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[s.fieldLabel, { color: c.textSecondary }]}>
                  LIFE AREA
                </Text>
                <View style={s.choices}>
                  {areas.map(([key, label, icon]) => (
                    <Pressable
                      key={key}
                      onPress={() => setArea(key)}
                      style={[
                        s.choice,
                        {
                          borderColor: area === key ? c.brand : c.border,
                          backgroundColor:
                            area === key ? c.brandSoft : c.surface,
                        },
                      ]}
                    >
                      <SymbolView
                        name={icon}
                        size={12}
                        tintColor={area === key ? c.brand : c.textSecondary}
                      />
                      <Text
                        style={[
                          s.choiceText,
                          { color: area === key ? c.brand : c.text },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[s.fieldLabel, { color: c.textSecondary }]}>
                  REPEATS
                </Text>
                <View style={s.choices}>
                  {(["MONTHLY", "QUARTERLY", "YEARLY"] as const).map(
                    (value) => (
                      <Pressable
                        key={value}
                        onPress={() => setCadence(value)}
                        style={[
                          s.choice,
                          {
                            borderColor: cadence === value ? c.brand : c.border,
                            backgroundColor:
                              cadence === value ? c.brandSoft : c.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.choiceText,
                            { color: cadence === value ? c.brand : c.text },
                          ]}
                        >
                          {value[0] + value.slice(1).toLowerCase()}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
                <Text style={[s.fieldLabel, { color: c.textSecondary }]}>
                  FIRST DUE DATE
                </Text>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowDatePicker((open) => !open);
                  }}
                  style={[
                    s.dateButton,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <SymbolView name="calendar" size={16} tintColor={c.brand} />
                  <Text style={[s.dateText, { color: c.text }]}>
                    {new Intl.DateTimeFormat("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(`${dueDate}T12:00:00`))}
                  </Text>
                  <SymbolView
                    name={showDatePicker ? "chevron.up" : "chevron.down"}
                    size={12}
                    tintColor={c.textSecondary}
                  />
                </Pressable>
                {showDatePicker && (
                  <View
                    style={[
                      s.datePicker,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <DateTimePicker
                      value={new Date(`${dueDate}T12:00:00`)}
                      mode="date"
                      display="spinner"
                      minimumDate={new Date()}
                      onChange={(_, selectedDate) => {
                        if (selectedDate) setDueDate(dateKey(selectedDate));
                      }}
                    />
                    <Pressable
                      onPress={() => setShowDatePicker(false)}
                      style={[s.dateDone, { backgroundColor: c.brandSoft }]}
                    >
                      <Text style={[s.dateDoneText, { color: c.brand }]}>
                        Done choosing date
                      </Text>
                    </Pressable>
                  </View>
                )}
                <Text style={[s.fieldLabel, { color: c.textSecondary }]}>
                  NOTIFY ME
                </Text>
                <View style={s.choices}>
                  {leadOptions.map((day) => (
                    <Pressable
                      key={day}
                      onPress={() =>
                        setLeads((current) =>
                          current.includes(day)
                            ? current.filter((item) => item !== day)
                            : [...current, day].sort((a, b) => b - a),
                        )
                      }
                      style={[
                        s.choice,
                        {
                          borderColor: leads.includes(day) ? c.brand : c.border,
                          backgroundColor: leads.includes(day)
                            ? c.brandSoft
                            : c.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.choiceText,
                          { color: leads.includes(day) ? c.brand : c.text },
                        ]}
                      >
                        {day} days before
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  disabled={saving}
                  onPress={() => void save()}
                  style={[s.save, { backgroundColor: c.brand }]}
                >
                  {saving ? (
                    <KasaSpinner color="#FFFFFF" size={18} />
                  ) : (
                    <Text style={s.saveText}>Save responsibility</Text>
                  )}
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 18,
  },
  title: {
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -1.4,
    marginTop: 6,
    maxWidth: 330,
  },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 8 },
  summary: {
    borderWidth: 1,
    borderRadius: 22,
    marginTop: 22,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  summaryValue: { fontSize: 21, fontWeight: "900" },
  summaryLabel: { fontSize: 9, fontWeight: "700", marginTop: 2 },
  summaryDivider: { height: 32, width: 1, backgroundColor: "#6D4B3C" },
  addButton: {
    marginLeft: "auto",
    height: 39,
    borderRadius: 14,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  addText: { color: "#FFF", fontSize: 10, fontWeight: "900" },
  error: { fontSize: 12, fontWeight: "700", marginTop: 12 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 27,
    marginBottom: 10,
  },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  tile: {
    alignItems: "center",
    marginBottom: 18,
    paddingHorizontal: 4,
    width: "25%",
  },
  tileIcon: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  tileTitle: {
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 12,
    marginTop: 7,
    textAlign: "center",
  },
  tileDue: { fontSize: 8, marginTop: 2, textAlign: "center" },
  addTile: { opacity: 0.9 },
  loading: { height: 150, justifyContent: "center", alignItems: "center" },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "800" },
  cardMeta: { fontSize: 10, fontWeight: "600", marginTop: 3 },
  cardNotify: { fontSize: 9, marginTop: 5 },
  paid: {
    height: 34,
    borderRadius: 12,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  paidText: { fontSize: 10, fontWeight: "900" },
  empty: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 26,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", marginTop: 10 },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
    maxWidth: 260,
  },
  modalScreen: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.55)",
  },
  detailBackdrop: {
    backgroundColor: "rgba(0,0,0,.56)",
    flex: 1,
    justifyContent: "flex-end",
  },
  detailSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 34,
  },
  detailTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    marginTop: 3,
  },
  detailIcon: {
    alignItems: "center",
    borderRadius: 17,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  detailCopy: { flex: 1 },
  detailTitle: { fontSize: 18, fontWeight: "900" },
  detailMeta: { fontSize: 11, marginTop: 3 },
  editButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 34,
    paddingHorizontal: 9,
  },
  editText: { fontSize: 10, fontWeight: "800" },
  detailDue: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    padding: 14,
  },
  detailLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  detailDate: { fontSize: 15, fontWeight: "900", marginTop: 5 },
  detailRepeat: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  detailNotice: { fontSize: 11, lineHeight: 17, marginTop: 15 },
  detailPaid: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    gap: 7,
    height: 49,
    justifyContent: "center",
    marginTop: 18,
  },
  detailPaidText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  setupScreen: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
  },
  setupContent: { paddingHorizontal: 20, paddingBottom: 42 },
  setupHeader: { alignItems: "center", flexDirection: "row", height: 58 },
  closeSetup: {
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  setupProgress: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.15,
    marginLeft: 13,
  },
  setupHero: {
    alignItems: "flex-start",
    borderRadius: 20,
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    marginBottom: 20,
    padding: 15,
  },
  setupHeroCopy: { flex: 1 },
  setupHeroTitle: { fontSize: 14, fontWeight: "900", lineHeight: 19 },
  setupHeroText: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 34,
    maxHeight: "91%",
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 3,
    marginBottom: 17,
  },
  sheetTitle: { fontSize: 23, fontWeight: "900" },
  sheetText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    height: 46,
    paddingHorizontal: 13,
    fontSize: 13,
    marginTop: 12,
  },
  dateButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 50,
    marginTop: 2,
    paddingHorizontal: 14,
  },
  dateText: { flex: 1, fontSize: 13, fontWeight: "800" },
  datePicker: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
    paddingBottom: 9,
  },
  dateDone: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 11,
    justifyContent: "center",
    minHeight: 33,
    paddingHorizontal: 12,
  },
  dateDoneText: { fontSize: 10, fontWeight: "900" },
  providerSuggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  suggestion: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  suggestionText: { fontSize: 9, fontWeight: "800" },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 16,
    marginBottom: 7,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  choiceText: { fontSize: 10, fontWeight: "800" },
  save: {
    height: 49,
    borderRadius: 16,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
});
