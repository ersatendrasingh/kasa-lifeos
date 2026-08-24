import { router, useFocusEffect } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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

import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  createLedgerEntry,
  createMoneyTransaction,
  getMoneyWorkspace,
  type LedgerDirection,
  type MoneyPerson,
  type MoneyWorkspace,
} from "@/lib/money";

const emptyWorkspace: MoneyWorkspace = {
  people: [],
  contacts: [],
  ledger: [],
  transactions: [],
  summary: { income: 0, spend: 0 },
};
const ledgerActions: {
  direction: LedgerDirection;
  label: string;
  helper: string;
  icon: SFSymbol;
}[] = [
  {
    direction: "LENT",
    label: "You gave",
    helper: "They need to return",
    icon: "arrow.up.right",
  },
  {
    direction: "BORROWED",
    label: "You took",
    helper: "You need to return",
    icon: "arrow.down.left",
  },
  {
    direction: "RECEIVED",
    label: "Received",
    helper: "They paid you back",
    icon: "checkmark.circle",
  },
  {
    direction: "PAID",
    label: "Paid back",
    helper: "You settled up",
    icon: "checkmark.circle.fill",
  },
];

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function MoneyScreen() {
  const c = useTheme();
  const [workspace, setWorkspace] = useState<MoneyWorkspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"khata" | "cashflow">("khata");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState<"ledger" | "cashflow" | null>(null);
  const [direction, setDirection] = useState<LedgerDirection>("LENT");
  const [selectedPerson, setSelectedPerson] = useState<MoneyPerson | null>(
    null,
  );
  const [personPicker, setPersonPicker] = useState(false);
  const [personQuery, setPersonQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [cashKind, setCashKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      setWorkspace(await getMoneyWorkspace());
    } catch (cause) {
      if (!silent)
        Alert.alert(
          "Money is unavailable",
          cause instanceof Error ? cause.message : "Pull down to try again.",
        );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const receiving = workspace.contacts
    .filter((item) => item.balance > 0)
    .reduce((sum, item) => sum + item.balance, 0);
  const owing = workspace.contacts
    .filter((item) => item.balance < 0)
    .reduce((sum, item) => sum + Math.abs(item.balance), 0);
  const visibleContacts = useMemo(
    () =>
      workspace.contacts.filter((person) =>
        person.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, workspace.contacts],
  );
  const pickerPeople = useMemo(
    () =>
      workspace.people.filter((person) =>
        `${person.name} ${person.phone || ""}`
          .toLowerCase()
          .includes(personQuery.trim().toLowerCase()),
      ),
    [personQuery, workspace.people],
  );

  function openLedger(nextDirection: LedgerDirection, person?: MoneyPerson) {
    setDirection(nextDirection);
    setSelectedPerson(person || null);
    setAmount("");
    setNote("");
    setComposer("ledger");
  }
  function openCashflow(kind: "INCOME" | "EXPENSE") {
    setCashKind(kind);
    setAmount("");
    setTitle("");
    setNote("");
    setComposer("cashflow");
  }
  function closeComposer() {
    if (!saving) setComposer(null);
  }
  async function save() {
    const parsedAmount = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Enter an amount", "Use an amount greater than zero.");
      return;
    }
    if (composer === "ledger" && !selectedPerson) {
      Alert.alert(
        "Choose a person",
        "Every khata entry belongs to a saved contact.",
      );
      return;
    }
    if (composer === "cashflow" && title.trim().length < 2) {
      Alert.alert("Add a title", "For example: Groceries or Salary.");
      return;
    }
    setSaving(true);
    try {
      const next =
        composer === "ledger"
          ? await createLedgerEntry({
              personId: selectedPerson!.id,
              direction,
              amount: parsedAmount,
              note: note.trim() || undefined,
            })
          : await createMoneyTransaction({
              kind: cashKind,
              title: title.trim(),
              amount: parsedAmount,
              note: note.trim() || undefined,
              category: cashKind === "INCOME" ? "Income" : "Everyday",
            });
      setWorkspace(next);
      setComposer(null);
    } catch (cause) {
      Alert.alert(
        "Could not save",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
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
          <AppHeader label="Money" />
          <Text style={[s.eyebrow, { color: c.brand }]}>PRIVATE KHATA</Text>
          <Text style={[s.title, { color: c.text }]}>Know what’s due.</Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            A simple personal ledger for the people you trust. No bank account
            is connected.
          </Text>
          <View style={s.summaryRow}>
            <SummaryCard
              label="YOU’LL RECEIVE"
              amount={receiving}
              icon="arrow.down.left"
              tone="#17A36B"
              surface={c.surface}
              border={c.border}
              text={c.text}
              muted={c.textSecondary}
            />
            <SummaryCard
              label="YOU OWE"
              amount={owing}
              icon="arrow.up.right"
              tone="#D85B45"
              surface={c.surface}
              border={c.border}
              text={c.text}
              muted={c.textSecondary}
            />
          </View>
          <View
            style={[
              s.tabRow,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Tab
              active={tab === "khata"}
              label="Khata"
              onPress={() => setTab("khata")}
              brand={c.brand}
              muted={c.textSecondary}
            />
            <Tab
              active={tab === "cashflow"}
              label="Cashflow"
              onPress={() => setTab("cashflow")}
              brand={c.brand}
              muted={c.textSecondary}
            />
          </View>
          {tab === "khata" ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.actionRow}
              >
                {ledgerActions.map((action) => (
                  <Pressable
                    key={action.direction}
                    onPress={() => openLedger(action.direction)}
                    style={[
                      s.quickAction,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <View
                      style={[s.quickIcon, { backgroundColor: c.brandSoft }]}
                    >
                      <SymbolView
                        name={action.icon}
                        size={15}
                        tintColor={c.brand}
                      />
                    </View>
                    <Text style={[s.quickLabel, { color: c.text }]}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View
                style={[
                  s.search,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <SymbolView
                  name="magnifyingglass"
                  size={15}
                  tintColor={c.textSecondary}
                />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search your khata"
                  placeholderTextColor={c.textSecondary}
                  style={[s.searchInput, { color: c.text }]}
                />
              </View>
              <View style={s.sectionHead}>
                <Text style={[s.heading, { color: c.text }]}>
                  People with a balance
                </Text>
                <Text style={[s.sectionCount, { color: c.brand }]}>
                  {workspace.contacts.length} OPEN
                </Text>
              </View>
              {loading ? (
                <View style={s.loader}>
                  <KasaSpinner size={28} />
                </View>
              ) : visibleContacts.length ? (
                visibleContacts.map((person) => (
                  <ContactBalance
                    key={person.id}
                    person={person}
                    brand={c.brand}
                    surface={c.surface}
                    border={c.border}
                    text={c.text}
                    muted={c.textSecondary}
                    onSettle={() =>
                      openLedger(
                        person.balance > 0 ? "RECEIVED" : "PAID",
                        person,
                      )
                    }
                  />
                ))
              ) : (
                <KhataEmpty
                  hasPeople={workspace.people.length > 0}
                  brand={c.brand}
                  surface={c.surface}
                  border={c.border}
                  text={c.text}
                  muted={c.textSecondary}
                  onAdd={() =>
                    workspace.people.length
                      ? openLedger("LENT")
                      : router.push("/people")
                  }
                />
              )}
              {!!workspace.ledger.length && (
                <>
                  <View style={s.sectionHead}>
                    <Text style={[s.heading, { color: c.text }]}>
                      Recent activity
                    </Text>
                  </View>
                  {workspace.ledger.slice(0, 6).map((entry) => (
                    <LedgerRow
                      key={entry.id}
                      entry={entry}
                      text={c.text}
                      muted={c.textSecondary}
                      surface={c.surface}
                      border={c.border}
                    />
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              <View
                style={[
                  s.cashHero,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Text style={[s.cashKicker, { color: c.textSecondary }]}>
                  THIS MONTH
                </Text>
                <Text style={[s.cashNet, { color: c.text }]}>
                  {money(workspace.summary.income - workspace.summary.spend)}
                </Text>
                <View style={s.cashNumbers}>
                  <Text style={[s.cashNumber, { color: "#17A36B" }]}>
                    + {money(workspace.summary.income)}
                  </Text>
                  <Text style={[s.cashNumber, { color: "#D85B45" }]}>
                    − {money(workspace.summary.spend)}
                  </Text>
                </View>
              </View>
              <View style={s.cashActions}>
                <Pressable
                  onPress={() => openCashflow("INCOME")}
                  style={[s.cashAction, { backgroundColor: "#17A36B" }]}
                >
                  <SymbolView name="plus" size={15} tintColor="#fff" />
                  <Text style={s.cashActionText}>Income</Text>
                </Pressable>
                <Pressable
                  onPress={() => openCashflow("EXPENSE")}
                  style={[s.cashAction, { backgroundColor: c.brand }]}
                >
                  <SymbolView name="minus" size={15} tintColor="#fff" />
                  <Text style={s.cashActionText}>Expense</Text>
                </Pressable>
              </View>
              <View style={s.sectionHead}>
                <Text style={[s.heading, { color: c.text }]}>
                  Recent cashflow
                </Text>
              </View>
              {loading ? (
                <View style={s.loader}>
                  <KasaSpinner size={28} />
                </View>
              ) : workspace.transactions.length ? (
                workspace.transactions.map((entry) => (
                  <TransactionRow
                    key={entry.id}
                    entry={entry}
                    text={c.text}
                    muted={c.textSecondary}
                    surface={c.surface}
                    border={c.border}
                  />
                ))
              ) : (
                <View
                  style={[
                    s.empty,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <SymbolView
                    name="chart.line.uptrend.xyaxis"
                    size={27}
                    tintColor={c.brand}
                  />
                  <Text style={[s.emptyTitle, { color: c.text }]}>
                    Start with one entry
                  </Text>
                  <Text style={[s.emptyCopy, { color: c.textSecondary }]}>
                    Log income and everyday spending without sharing your bank
                    data.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <Modal
        transparent
        visible={composer !== null}
        animationType="slide"
        onRequestClose={closeComposer}
      >
        <View style={s.modal}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeComposer} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView bounces={false} contentContainerStyle={s.sheetScroll}>
              <View style={[s.sheet, { backgroundColor: c.background }]}>
                <View style={[s.handle, { backgroundColor: c.border }]} />
                {composer === "ledger" ? (
                  <>
                    <Text style={[s.sheetTitle, { color: c.text }]}>
                      Add to khata
                    </Text>
                    <Text style={[s.sheetCopy, { color: c.textSecondary }]}>
                      Keep the record clear for both of you.
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.directionRow}
                    >
                      {ledgerActions.map((action) => (
                        <Pressable
                          key={action.direction}
                          onPress={() => setDirection(action.direction)}
                          style={[
                            s.direction,
                            {
                              backgroundColor:
                                direction === action.direction
                                  ? c.brand
                                  : c.surface,
                              borderColor:
                                direction === action.direction
                                  ? c.brand
                                  : c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.directionText,
                              {
                                color:
                                  direction === action.direction
                                    ? "#fff"
                                    : c.text,
                              },
                            ]}
                          >
                            {action.label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Pressable
                      onPress={() => setPersonPicker(true)}
                      style={[
                        s.personInput,
                        { backgroundColor: c.surface, borderColor: c.border },
                      ]}
                    >
                      <View
                        style={[s.avatar, { backgroundColor: c.brandSoft }]}
                      >
                        <Text style={[s.avatarText, { color: c.brand }]}>
                          {selectedPerson ? initials(selectedPerson.name) : "+"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[s.personLabel, { color: c.textSecondary }]}
                        >
                          PERSON
                        </Text>
                        <Text
                          style={[
                            s.personName,
                            {
                              color: selectedPerson ? c.text : c.textSecondary,
                            },
                          ]}
                        >
                          {selectedPerson?.name || "Choose from your People"}
                        </Text>
                      </View>
                      <SymbolView
                        name="chevron.right"
                        size={13}
                        tintColor={c.textSecondary}
                      />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={[s.sheetTitle, { color: c.text }]}>
                      {cashKind === "INCOME" ? "Add income" : "Add expense"}
                    </Text>
                    <View style={s.kindRow}>
                      <Tab
                        active={cashKind === "INCOME"}
                        label="Income"
                        onPress={() => setCashKind("INCOME")}
                        brand="#17A36B"
                        muted={c.textSecondary}
                      />
                      <Tab
                        active={cashKind === "EXPENSE"}
                        label="Expense"
                        onPress={() => setCashKind("EXPENSE")}
                        brand={c.brand}
                        muted={c.textSecondary}
                      />
                    </View>
                    <TextInput
                      autoFocus
                      value={title}
                      onChangeText={setTitle}
                      placeholder="What was this for?"
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
                  </>
                )}
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="₹ Amount"
                  placeholderTextColor={c.textSecondary}
                  style={[
                    s.amountInput,
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
                  placeholder="Note (optional)"
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
                <Pressable
                  disabled={saving}
                  onPress={() => void save()}
                  style={[
                    s.saveButton,
                    { backgroundColor: c.brand, opacity: saving ? 0.65 : 1 },
                  ]}
                >
                  {saving ? (
                    <KasaSpinner size={18} color="#fff" />
                  ) : (
                    <Text style={s.saveText}>Save entry</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <Modal
        transparent
        visible={personPicker}
        animationType="slide"
        onRequestClose={() => setPersonPicker(false)}
      >
        <View style={s.modal}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPersonPicker(false)}
          />
          <View style={[s.picker, { backgroundColor: c.background }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>
              Choose a person
            </Text>
            <View
              style={[
                s.search,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView
                name="magnifyingglass"
                size={15}
                tintColor={c.textSecondary}
              />
              <TextInput
                value={personQuery}
                onChangeText={setPersonQuery}
                placeholder="Search contacts"
                placeholderTextColor={c.textSecondary}
                style={[s.searchInput, { color: c.text }]}
              />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={s.pickerList}
            >
              {pickerPeople.map((person) => (
                <Pressable
                  key={person.id}
                  onPress={() => {
                    setSelectedPerson({ ...person, balance: 0 });
                    setPersonPicker(false);
                    setPersonQuery("");
                  }}
                  style={[s.pickerPerson, { borderColor: c.border }]}
                >
                  <View style={[s.avatar, { backgroundColor: c.brandSoft }]}>
                    <Text style={[s.avatarText, { color: c.brand }]}>
                      {initials(person.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.pickerName, { color: c.text }]}>
                      {person.name}
                    </Text>
                    <Text style={[s.pickerPhone, { color: c.textSecondary }]}>
                      {person.phone || person.category || "Saved contact"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            {!pickerPeople.length && (
              <Pressable
                onPress={() => {
                  setPersonPicker(false);
                  setComposer(null);
                  router.push("/people");
                }}
                style={[s.addPeople, { borderColor: c.border }]}
              >
                <Text style={[s.addPeopleText, { color: c.brand }]}>
                  Add a person first →
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryCard({
  label,
  amount,
  icon,
  tone,
  surface,
  border,
  text,
  muted,
}: {
  label: string;
  amount: number;
  icon: SFSymbol;
  tone: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
}) {
  return (
    <View
      style={[s.summaryCard, { backgroundColor: surface, borderColor: border }]}
    >
      <View style={[s.summaryIcon, { backgroundColor: `${tone}1C` }]}>
        <SymbolView name={icon} size={14} tintColor={tone} />
      </View>
      <Text style={[s.summaryLabel, { color: muted }]}>{label}</Text>
      <Text style={[s.summaryAmount, { color: text }]}>{money(amount)}</Text>
    </View>
  );
}
function Tab({
  active,
  label,
  onPress,
  brand,
  muted,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  brand: string;
  muted: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.tab, { backgroundColor: active ? brand : "transparent" }]}
    >
      <Text style={[s.tabText, { color: active ? "#fff" : muted }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function ContactBalance({
  person,
  brand,
  surface,
  border,
  text,
  muted,
  onSettle,
}: {
  person: MoneyPerson;
  brand: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  onSettle: () => void;
}) {
  const receive = person.balance > 0;
  return (
    <View
      style={[s.contact, { backgroundColor: surface, borderColor: border }]}
    >
      <View style={[s.avatar, { backgroundColor: brand + "1A" }]}>
        <Text style={[s.avatarText, { color: brand }]}>
          {initials(person.name)}
        </Text>
      </View>
      <View style={s.contactCopy}>
        <Text style={[s.contactName, { color: text }]}>{person.name}</Text>
        <Text style={[s.contactState, { color: muted }]}>
          {receive ? "They need to return" : "You need to return"}
        </Text>
      </View>
      <View style={s.contactRight}>
        <Text
          style={[s.contactAmount, { color: receive ? "#17A36B" : "#D85B45" }]}
        >
          {receive ? "+" : "−"}
          {money(Math.abs(person.balance))}
        </Text>
        <Pressable onPress={onSettle}>
          <Text style={[s.settle, { color: brand }]}>SETTLE</Text>
        </Pressable>
      </View>
    </View>
  );
}
function LedgerRow({
  entry,
  text,
  muted,
  surface,
  border,
}: {
  entry: MoneyWorkspace["ledger"][number];
  text: string;
  muted: string;
  surface: string;
  border: string;
}) {
  const isPlus = entry.direction === "LENT" || entry.direction === "PAID";
  const label = (
    {
      LENT: "You gave",
      BORROWED: "You took",
      RECEIVED: "Received",
      PAID: "Paid back",
    } as const
  )[entry.direction];
  return (
    <View
      style={[s.history, { backgroundColor: surface, borderColor: border }]}
    >
      <View
        style={[
          s.historyDot,
          { backgroundColor: isPlus ? "#17A36B1F" : "#D85B451F" },
        ]}
      >
        <SymbolView
          name={isPlus ? "arrow.down.left" : "arrow.up.right"}
          size={13}
          tintColor={isPlus ? "#17A36B" : "#D85B45"}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.historyTitle, { color: text }]}>
          {entry.person.name}
        </Text>
        <Text style={[s.historySub, { color: muted }]}>
          {label} · {shortDate(entry.occurredAt)}
        </Text>
      </View>
      <Text
        style={[s.historyAmount, { color: isPlus ? "#17A36B" : "#D85B45" }]}
      >
        {money(entry.amount)}
      </Text>
    </View>
  );
}
function TransactionRow({
  entry,
  text,
  muted,
  surface,
  border,
}: {
  entry: MoneyWorkspace["transactions"][number];
  text: string;
  muted: string;
  surface: string;
  border: string;
}) {
  const income = entry.kind === "INCOME";
  return (
    <View
      style={[s.history, { backgroundColor: surface, borderColor: border }]}
    >
      <View
        style={[
          s.historyDot,
          { backgroundColor: income ? "#17A36B1F" : "#D85B451F" },
        ]}
      >
        <SymbolView
          name={income ? "arrow.down.left" : "arrow.up.right"}
          size={13}
          tintColor={income ? "#17A36B" : "#D85B45"}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.historyTitle, { color: text }]}>{entry.title}</Text>
        <Text style={[s.historySub, { color: muted }]}>
          {entry.category || "Personal"} · {shortDate(entry.occurredAt)}
        </Text>
      </View>
      <Text
        style={[s.historyAmount, { color: income ? "#17A36B" : "#D85B45" }]}
      >
        {income ? "+" : "−"}
        {money(entry.amount)}
      </Text>
    </View>
  );
}
function KhataEmpty({
  hasPeople,
  brand,
  surface,
  border,
  text,
  muted,
  onAdd,
}: {
  hasPeople: boolean;
  brand: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  onAdd: () => void;
}) {
  return (
    <View style={[s.empty, { backgroundColor: surface, borderColor: border }]}>
      <SymbolView name="person.2.fill" size={27} tintColor={brand} />
      <Text style={[s.emptyTitle, { color: text }]}>
        {hasPeople ? "No open balances" : "Start with your people"}
      </Text>
      <Text style={[s.emptyCopy, { color: muted }]}>
        {hasPeople
          ? "Everyone is settled. Add a new entry whenever money changes hands."
          : "Import or add contacts first, then create a clear personal khata."}
      </Text>
      <Pressable onPress={onAdd}>
        <Text style={[s.emptyAction, { color: brand }]}>
          {hasPeople ? "Add first entry →" : "Go to People →"}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 115 },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1.5, marginTop: 9 },
  title: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1.35,
    marginTop: 7,
  },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 330 },
  summaryRow: { flexDirection: "row", gap: 9, marginTop: 18 },
  summaryCard: { flex: 1, borderWidth: 1, borderRadius: 22, padding: 13 },
  summaryIcon: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 10,
  },
  summaryAmount: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 3,
  },
  tabRow: {
    height: 47,
    borderRadius: 17,
    borderWidth: 1,
    padding: 4,
    flexDirection: "row",
    marginTop: 14,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  tabText: { fontSize: 11, fontWeight: "900" },
  actionRow: { gap: 8, paddingTop: 14, paddingBottom: 3 },
  quickAction: { borderWidth: 1, width: 92, borderRadius: 17, padding: 10 },
  quickIcon: {
    width: 27,
    height: 27,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 10, fontWeight: "900", marginTop: 8 },
  search: {
    height: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
  },
  searchInput: { flex: 1, fontSize: 12, height: "100%" },
  sectionHead: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  sectionCount: { fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  loader: { height: 150, alignItems: "center", justifyContent: "center" },
  contact: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 11, fontWeight: "900" },
  contactCopy: { flex: 1, marginLeft: 10 },
  contactName: { fontSize: 13, fontWeight: "900" },
  contactState: { fontSize: 9, marginTop: 3 },
  contactRight: { alignItems: "flex-end" },
  contactAmount: { fontSize: 12, fontWeight: "900" },
  settle: { fontSize: 8, fontWeight: "900", letterSpacing: 0.7, marginTop: 6 },
  history: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 18,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 7,
  },
  historyDot: {
    width: 33,
    height: 33,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  historyTitle: { fontSize: 12, fontWeight: "900" },
  historySub: { fontSize: 9, marginTop: 3 },
  historyAmount: { fontSize: 11, fontWeight: "900" },
  cashHero: { borderWidth: 1, borderRadius: 25, padding: 19, marginTop: 15 },
  cashKicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  cashNet: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.1,
    marginTop: 6,
  },
  cashNumbers: { flexDirection: "row", gap: 17, marginTop: 10 },
  cashNumber: { fontSize: 11, fontWeight: "900" },
  cashActions: { flexDirection: "row", gap: 9, marginTop: 10 },
  cashAction: {
    flex: 1,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  cashActionText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  empty: {
    borderWidth: 1,
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", marginTop: 9 },
  emptyCopy: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280,
  },
  emptyAction: { fontSize: 10, fontWeight: "900", marginTop: 16 },
  modal: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(12,7,4,.58)",
  },
  sheetScroll: { justifyContent: "flex-end", flexGrow: 1 },
  sheet: {
    borderTopLeftRadius: 31,
    borderTopRightRadius: 31,
    padding: 20,
    paddingBottom: 32,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 5,
    alignSelf: "center",
    marginBottom: 15,
  },
  sheetTitle: { fontSize: 23, fontWeight: "900", letterSpacing: -0.8 },
  sheetCopy: { fontSize: 11, marginTop: 4 },
  directionRow: { gap: 7, marginTop: 16 },
  direction: {
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  directionText: { fontSize: 9, fontWeight: "900" },
  personInput: {
    height: 64,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    marginTop: 15,
  },
  personLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  personName: { fontSize: 12, fontWeight: "800", marginTop: 3 },
  kindRow: { flexDirection: "row", marginTop: 15, gap: 7 },
  input: {
    height: 53,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    fontSize: 12,
    marginTop: 12,
  },
  amountInput: {
    height: 60,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
  },
  saveButton: {
    height: 53,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  saveText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  picker: {
    maxHeight: "75%",
    minHeight: "45%",
    borderTopLeftRadius: 31,
    borderTopRightRadius: 31,
    padding: 20,
    paddingBottom: 25,
  },
  pickerList: { marginTop: 7 },
  pickerPerson: {
    minHeight: 61,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pickerName: { fontSize: 13, fontWeight: "900" },
  pickerPhone: { fontSize: 9, marginTop: 3 },
  addPeople: {
    height: 49,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 12,
  },
  addPeopleText: { fontSize: 11, fontWeight: "900" },
});
