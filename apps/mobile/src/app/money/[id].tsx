import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  createLedgerEntry,
  getPersonKhata,
  type LedgerDirection,
  type LedgerEntry,
  type PersonKhata,
} from "@/lib/money";

const actionCopy: Record<
  LedgerDirection,
  { label: string; title: string; detail: string; icon: SFSymbol }
> = {
  LENT: {
    label: "I gave",
    title: "You gave them money",
    detail: "They now need to return it.",
    icon: "arrow.up.right",
  },
  BORROWED: {
    label: "I borrowed",
    title: "They gave you money",
    detail: "You now need to return it.",
    icon: "arrow.down.left",
  },
  RECEIVED: {
    label: "They repaid",
    title: "They paid you back",
    detail: "This reduces what they owe you.",
    icon: "arrow.down.left",
  },
  PAID: {
    label: "I repaid",
    title: "You paid them back",
    detail: "This reduces what you owe them.",
    icon: "arrow.up.right",
  },
};
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export default function PersonKhataScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PersonKhata | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [direction, setDirection] = useState<LedgerDirection>("LENT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (silent) setRefreshing(true);
      try {
        setData(await getPersonKhata(id));
      } catch (cause) {
        Alert.alert(
          "Khata is unavailable",
          cause instanceof Error
            ? cause.message
            : "Please pull down to try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const rows: { date: string; items: LedgerEntry[] }[] = [];
    for (const entry of data?.entries || []) {
      const date = dateLabel(entry.occurredAt);
      const last = rows.at(-1);
      if (last?.date === date) last.items.push(entry);
      else rows.push({ date, items: [entry] });
    }
    return rows;
  }, [data?.entries]);
  const positive = (data?.person.balance || 0) > 0;
  const hasBalance = !!data?.person.balance;
  function cycleDirection() {
    const directions = Object.keys(actionCopy) as LedgerDirection[];
    setDirection(
      (current) =>
        directions[(directions.indexOf(current) + 1) % directions.length],
    );
  }

  async function saveEntry() {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert("Enter an amount", "Use an amount greater than zero.");
      return;
    }
    if (!data) return;
    setSaving(true);
    try {
      await createLedgerEntry({
        personId: data.person.id,
        direction,
        amount: value,
        note: note.trim() || undefined,
      });
      setAmount("");
      setNote("");
      await load(true);
    } catch (cause) {
      Alert.alert(
        "Could not save entry",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function openWhatsApp() {
    if (!data?.person.phone) {
      Alert.alert(
        "Add a phone number",
        `Add ${data?.person.name || "this contact"}'s phone number in People before sending a WhatsApp reminder.`,
      );
      return;
    }
    const phone = data.person.phone.replace(/[^0-9]/g, "");
    const balanceText = hasBalance
      ? positive
        ? `Hi ${data.person.name}, a reminder that ₹${Math.abs(data.person.balance).toLocaleString("en-IN")} is pending on our KASA khata. Please let me know when we can settle it.`
        : `Hi ${data.person.name}, I have ₹${Math.abs(data.person.balance).toLocaleString("en-IN")} pending on our KASA khata. I’ll settle it soon—please let me know what works for you.`
      : `Hi ${data.person.name}, our KASA khata is settled. Thanks!`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(balanceText)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Could not open WhatsApp",
        "Please check that WhatsApp is installed and this contact has a valid phone number.",
      );
    }
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <View style={s.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              s.back,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="chevron.left" size={17} tintColor={c.text} />
          </Pressable>
          <Text style={[s.headerLabel, { color: c.textSecondary }]}>
            PERSONAL KHATA
          </Text>
          <Pressable
            onPress={() => void openWhatsApp()}
            style={[s.whatsApp, { backgroundColor: "#25D366" }]}
          >
            <SymbolView name="message.fill" size={15} tintColor="#fff" />
          </Pressable>
        </View>
        {loading ? (
          <View style={s.loader}>
            <KasaSpinner size={30} />
          </View>
        ) : data ? (
          <>
            <>
              <ScrollView
                contentContainerStyle={s.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void load(true)}
                    tintColor={c.brand}
                  />
                }
              >
                <View style={s.profile}>
                  <View style={[s.avatar, { backgroundColor: c.brandSoft }]}>
                    <Text style={[s.avatarText, { color: c.brand }]}>
                      {initials(data.person.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.name, { color: c.text }]}>
                      {data.person.name}
                    </Text>
                    <Text style={[s.category, { color: c.textSecondary }]}>
                      {data.person.category || "Personal contact"}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    s.balance,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <Text style={[s.balanceKicker, { color: c.textSecondary }]}>
                    {hasBalance
                      ? positive
                        ? "THEY NEED TO RETURN"
                        : "YOU NEED TO RETURN"
                      : "ALL SETTLED"}
                  </Text>
                  <Text
                    style={[
                      s.balanceAmount,
                      {
                        color: hasBalance
                          ? positive
                            ? "#179B67"
                            : "#D75B45"
                          : c.text,
                      },
                    ]}
                  >
                    {hasBalance ? money(Math.abs(data.person.balance)) : "₹0"}
                  </Text>
                  <Text style={[s.balanceCopy, { color: c.textSecondary }]}>
                    {hasBalance
                      ? positive
                        ? "A calm reminder is one tap away."
                        : "Keep it clear, settle when ready."
                      : "No money is pending between you."}
                  </Text>
                </View>
                <View style={s.historyHead}>
                  <Text style={[s.historyTitle, { color: c.text }]}>
                    Khata history
                  </Text>
                  <Text style={[s.historyCount, { color: c.textSecondary }]}>
                    {data.entries.length} ENTRIES
                  </Text>
                </View>
                {grouped.length ? (
                  grouped.map((group) => (
                    <View key={group.date}>
                      <Text style={[s.date, { color: c.textSecondary }]}>
                        {group.date}
                      </Text>
                      {group.items.map((entry) => (
                        <Bubble key={entry.id} entry={entry} brand={c.brand} />
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
                      name="bubble.left.and.bubble.right"
                      size={28}
                      tintColor={c.brand}
                    />
                    <Text style={[s.emptyTitle, { color: c.text }]}>
                      A clear start
                    </Text>
                    <Text style={[s.emptyCopy, { color: c.textSecondary }]}>
                      Every amount you add here stays in this one conversation
                      with {data.person.name}.
                    </Text>
                  </View>
                )}
              </ScrollView>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
              >
                <View
                  style={[
                    s.footer,
                    { backgroundColor: c.background, borderColor: c.border },
                  ]}
                >
                  <View style={s.chatComposer}>
                    <Pressable
                      onPress={cycleDirection}
                      style={[
                        s.directionChip,
                        { backgroundColor: c.brandSoft },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[s.directionChipText, { color: c.brand }]}
                      >
                        {actionCopy[direction].label}
                      </Text>
                      <SymbolView
                        name="chevron.up.chevron.down"
                        size={10}
                        tintColor={c.brand}
                      />
                    </Pressable>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      placeholder="₹0"
                      placeholderTextColor={c.textSecondary}
                      style={[
                        s.amount,
                        {
                          backgroundColor: c.surface,
                          borderColor: c.border,
                          color: c.text,
                        },
                      ]}
                    />
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Add note"
                      placeholderTextColor={c.textSecondary}
                      style={[
                        s.note,
                        {
                          backgroundColor: c.surface,
                          borderColor: c.border,
                          color: c.text,
                        },
                      ]}
                    />
                    <Pressable
                      disabled={saving}
                      onPress={() => void saveEntry()}
                      style={[
                        s.save,
                        {
                          backgroundColor: c.brand,
                          opacity: saving ? 0.65 : 1,
                        },
                      ]}
                    >
                      {saving ? (
                        <KasaSpinner size={18} color="#fff" />
                      ) : (
                        <SymbolView
                          name="arrow.up"
                          size={16}
                          tintColor="#fff"
                        />
                      )}
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </>
          </>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

export function EntryEditor({
  c,
  direction,
  setDirection,
  amount,
  setAmount,
  note,
  setNote,
  saving,
  onCancel,
  onSave,
}: {
  c: ReturnType<typeof useTheme>;
  direction: LedgerDirection;
  setDirection: (value: LedgerDirection) => void;
  amount: string;
  setAmount: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.editorScreen}
    >
      <ScrollView
        contentContainerStyle={s.editorContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.editorTop}>
          <Pressable
            disabled={saving}
            onPress={onCancel}
            style={[
              s.editorBack,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="chevron.left" size={17} tintColor={c.text} />
          </Pressable>
          <Text style={[s.editorKicker, { color: c.textSecondary }]}>
            NEW KHATA ENTRY
          </Text>
        </View>
        <Text style={[s.editorTitle, { color: c.text }]}>
          How did money move?
        </Text>
        <Text style={[s.editorCopy, { color: c.textSecondary }]}>
          Choose one clear action, then enter the amount.
        </Text>
        <View
          style={[
            s.amountCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[s.amountPrefix, { color: c.textSecondary }]}>₹</Text>
          <TextInput
            autoFocus
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={c.textSecondary}
            style={[s.editorAmount, { color: c.text }]}
          />
        </View>
        <View style={s.editorChoices}>
          {(Object.keys(actionCopy) as LedgerDirection[]).map((item) => {
            const selected = direction === item;
            const color =
              item === "RECEIVED"
                ? "#179B67"
                : item === "PAID"
                  ? "#D75B45"
                  : c.brand;
            return (
              <Pressable
                key={item}
                onPress={() => setDirection(item)}
                style={[
                  s.editorChoice,
                  {
                    backgroundColor: selected ? color : c.surface,
                    borderColor: selected ? color : c.border,
                  },
                ]}
              >
                <SymbolView
                  name={actionCopy[item].icon}
                  size={15}
                  tintColor={selected ? "#fff" : color}
                />
                <Text
                  style={[
                    s.editorChoiceLabel,
                    { color: selected ? "#fff" : c.text },
                  ]}
                >
                  {actionCopy[item].label}
                </Text>
                <Text
                  style={[
                    s.editorChoiceHint,
                    {
                      color: selected
                        ? "rgba(255,255,255,.82)"
                        : c.textSecondary,
                    },
                  ]}
                >
                  {item === "LENT"
                    ? "They owe you"
                    : item === "BORROWED"
                      ? "You owe them"
                      : item === "RECEIVED"
                        ? "They settled"
                        : "You settled"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          style={[
            s.noteCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <SymbolView
            name="text.alignleft"
            size={15}
            tintColor={c.textSecondary}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note, if useful"
            placeholderTextColor={c.textSecondary}
            style={[s.editorNote, { color: c.text }]}
          />
        </View>
        <Text style={[s.editorExplanation, { color: c.textSecondary }]}>
          {actionCopy[direction].detail}
        </Text>
      </ScrollView>
      <View
        style={[
          s.editorFooter,
          { backgroundColor: c.background, borderColor: c.border },
        ]}
      >
        <Pressable
          disabled={saving}
          onPress={onSave}
          style={[
            s.editorSave,
            { backgroundColor: c.brand, opacity: saving ? 0.65 : 1 },
          ]}
        >
          {saving ? (
            <KasaSpinner size={18} color="#fff" />
          ) : (
            <>
              <Text style={s.editorSaveText}>Save entry</Text>
              <SymbolView name="arrow.right" size={15} tintColor="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
function Bubble({ entry, brand }: { entry: LedgerEntry; brand: string }) {
  const outgoing = entry.direction === "LENT" || entry.direction === "PAID";
  const copy = actionCopy[entry.direction];
  return (
    <View style={[s.bubbleRow, outgoing && s.bubbleRight]}>
      <View
        style={[
          s.bubble,
          { backgroundColor: outgoing ? brand : "rgba(255,255,255,.82)" },
        ]}
      >
        <Text
          style={[
            s.bubbleLabel,
            { color: outgoing ? "rgba(255,255,255,.76)" : "#8B7168" },
          ]}
        >
          {copy.label.toUpperCase()}
        </Text>
        <Text
          style={[s.bubbleAmount, { color: outgoing ? "#fff" : "#2A1A15" }]}
        >
          {money(entry.amount)}
        </Text>
        {entry.note ? (
          <Text
            style={[
              s.bubbleNote,
              { color: outgoing ? "rgba(255,255,255,.88)" : "#654D44" },
            ]}
          >
            {entry.note}
          </Text>
        ) : null}
        <Text
          style={[
            s.bubbleTime,
            { color: outgoing ? "rgba(255,255,255,.72)" : "#8B7168" },
          ]}
        >
          {timeLabel(entry.occurredAt)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  whatsApp: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 104 },
  contentWithComposer: { paddingBottom: 245 },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "900" },
  name: { fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
  category: { fontSize: 10, marginTop: 3 },
  balance: { borderWidth: 1, borderRadius: 26, padding: 19, marginTop: 17 },
  balanceKicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  balanceAmount: {
    fontSize: 33,
    fontWeight: "900",
    letterSpacing: -1.4,
    marginTop: 6,
  },
  balanceCopy: { fontSize: 10, marginTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  action: {
    width: "48.7%",
    height: 62,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    gap: 8,
  },
  actionIcon: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 11, fontWeight: "900" },
  historyHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 11,
  },
  historyTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  historyCount: { fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  date: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 9,
  },
  bubbleRow: { flexDirection: "row", marginBottom: 8 },
  bubbleRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    boxShadow: "0 5px 14px rgba(42,26,21,.08)",
  },
  bubbleLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.9 },
  bubbleAmount: { fontSize: 17, fontWeight: "900", marginTop: 4 },
  bubbleNote: { fontSize: 10, lineHeight: 14, marginTop: 4 },
  bubbleTime: {
    fontSize: 8,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "right",
  },
  empty: {
    borderWidth: 1,
    borderRadius: 25,
    padding: 27,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", marginTop: 9 },
  emptyCopy: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 5,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  chatComposer: { flexDirection: "row", alignItems: "center", gap: 6 },
  directionChip: {
    height: 48,
    maxWidth: 76,
    borderRadius: 15,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  directionChipText: { flex: 1, fontSize: 8, fontWeight: "900" },
  addButton: {
    flex: 1,
    height: 51,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  addText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  composerHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  composerTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  composerDetail: { fontSize: 9, marginTop: 2 },
  choiceRow: { gap: 7, marginTop: 10, paddingBottom: 1 },
  choice: {
    height: 36,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  choiceText: { fontSize: 9, fontWeight: "900" },
  inlineInputs: { flexDirection: "row", gap: 7, marginTop: 9 },
  amount: {
    height: 48,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 11,
    fontSize: 14,
    fontWeight: "900",
    width: 88,
  },
  note: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 11,
    fontSize: 11,
  },
  save: {
    width: 48,
    height: 48,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  editorScreen: { flex: 1 },
  editorContent: { padding: 20, paddingTop: 11, paddingBottom: 28 },
  editorTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  editorBack: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editorKicker: { fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  editorTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 27,
  },
  editorCopy: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  amountCard: {
    height: 104,
    borderWidth: 1,
    borderRadius: 27,
    marginTop: 22,
    paddingHorizontal: 19,
    alignItems: "center",
    flexDirection: "row",
  },
  amountPrefix: { fontSize: 31, fontWeight: "900", marginRight: 7 },
  editorAmount: {
    flex: 1,
    height: "100%",
    fontSize: 43,
    fontWeight: "900",
    letterSpacing: -1.7,
  },
  editorChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 17,
  },
  editorChoice: {
    width: "48.6%",
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 21,
    padding: 13,
  },
  editorChoiceLabel: { fontSize: 12, fontWeight: "900", marginTop: 9 },
  editorChoiceHint: { fontSize: 9, marginTop: 3 },
  noteCard: {
    height: 54,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 17,
  },
  editorNote: { flex: 1, height: "100%", fontSize: 12 },
  editorExplanation: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
    textAlign: "center",
  },
  editorFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 15,
  },
  editorSave: {
    height: 53,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  editorSaveText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});
