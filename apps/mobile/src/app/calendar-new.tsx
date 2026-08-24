// This screen stays a sibling route because Expo Router cannot register both
// `calendar.tsx` and a nested `calendar/new.tsx` route at the same time.
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { createCalendarEvent } from "@/lib/automation";
import { syncLocalNotifications } from "@/lib/notifications";

const kinds = ["PLAN", "MEETING", "BIRTHDAY", "OTHER"] as const;
const weekdayOptions = [
  [1, "M"],
  [2, "T"],
  [3, "W"],
  [4, "T"],
  [5, "F"],
  [6, "S"],
  [0, "S"],
] as const;

function getInitialDate(value: string | string[] | undefined) {
  const date = Array.isArray(value) ? value[0] : value;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Date();
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function NewCalendarEventScreen() {
  const c = useTheme();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const initialDate = useMemo(() => getInitialDate(dateParam), [dateParam]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof kinds)[number]>("PLAN");
  const [date, setDate] = useState(initialDate);
  const [allDay, setAllDay] = useState(false);
  const [duration, setDuration] = useState("60");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const meeting = kind === "MEETING";
  const birthday = kind === "BIRTHDAY";
  const titlePlaceholder = birthday
    ? "e.g. Aisha's birthday"
    : meeting
      ? "e.g. Team stand-up"
      : kind === "OTHER"
        ? "e.g. Passport renewal"
        : "e.g. Dinner with friends";

  function chooseKind(next: (typeof kinds)[number]) {
    setKind(next);
    setRepeatDays([]);
    if (next === "BIRTHDAY") setAllDay(true);
  }
  function updateDate(value: Date, mode: "date" | "time") {
    setDate((current) => {
      const next = new Date(current);
      if (mode === "date")
        next.setFullYear(
          value.getFullYear(),
          value.getMonth(),
          value.getDate(),
        );
      else next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      return next;
    });
  }
  function toggleDay(day: number) {
    setRepeatDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort(),
    );
  }
  async function submit() {
    if (title.trim().length < 2)
      return Alert.alert(
        "Add a title",
        "Give this calendar item a clear name.",
      );
    if (meeting && link.trim() && !/^https?:\/\//i.test(link.trim()))
      return Alert.alert(
        "Check meeting link",
        "Use a full link starting with https://",
      );
    setSaving(true);
    try {
      const result = await createCalendarEvent({
        title: title.trim(),
        kind,
        startsAt: date.toISOString(),
        durationMinutes: Number(duration) || 60,
        allDay,
        notes: notes.trim() || undefined,
        meetingUrl: meeting ? link.trim() || undefined : undefined,
        weekdays: meeting ? repeatDays : [],
      });
      await syncLocalNotifications().catch(() => undefined);
      Alert.alert(
        "Saved",
        result?.occurrences && result.occurrences > 1
          ? `${result.occurrences} meeting occurrences are ready with 30-minute reminders.`
          : "Added to your calendar.",
        [{ text: "Done", onPress: () => router.replace("/calendar") }],
      );
    } catch (error) {
      Alert.alert(
        "Could not save event",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.topBar}>
            <Pressable
              accessibilityLabel="Back to calendar"
              onPress={() => router.back()}
              style={[
                s.back,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="chevron.left" size={17} tintColor={c.text} />
            </Pressable>
            <Text style={[s.topTitle, { color: c.text }]}>New event</Text>
            <View style={s.topSpacer} />
          </View>
          <Text style={[s.selectedDate, { color: c.brand }]}>
            {new Intl.DateTimeFormat("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(date)}
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <TextInput
              autoFocus
              value={title}
              onChangeText={setTitle}
              placeholder={titlePlaceholder}
              placeholderTextColor={c.textSecondary}
              style={[s.titleInput, { color: c.text }]}
              returnKeyType="done"
            />
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.kindRow}>
              {kinds.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => chooseKind(item)}
                  style={[
                    s.kind,
                    {
                      backgroundColor:
                        kind === item ? c.brand : c.backgroundElement,
                      borderColor: kind === item ? c.brand : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.kindText,
                      { color: kind === item ? "#fff" : c.textSecondary },
                    ]}
                  >
                    {item.charAt(0) + item.slice(1).toLowerCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Text style={[s.sectionLabel, { color: c.textSecondary }]}>WHEN</Text>
          <View
            style={[
              s.card,
              s.rows,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <PickerRow icon="calendar" label="Date" color={c.text}>
              <DateTimePicker
                value={date}
                mode="date"
                display="compact"
                accentColor={c.brand}
                onChange={(_, value) => value && updateDate(value, "date")}
              />
            </PickerRow>
            <View style={[s.rowDivider, { backgroundColor: c.border }]} />
            <PickerRow icon="clock" label="All-day" color={c.text}>
              <Switch
                value={allDay}
                disabled={birthday}
                onValueChange={setAllDay}
                trackColor={{ false: c.border, true: c.brand }}
              />
            </PickerRow>
            {!allDay && (
              <>
                <View style={[s.rowDivider, { backgroundColor: c.border }]} />
                <PickerRow icon="clock" label="Time" color={c.text}>
                  <DateTimePicker
                    value={date}
                    mode="time"
                    display="compact"
                    accentColor={c.brand}
                    onChange={(_, value) => value && updateDate(value, "time")}
                  />
                </PickerRow>
                <View style={[s.rowDivider, { backgroundColor: c.border }]} />
                <View style={s.row}>
                  <View style={s.rowLabel}>
                    <SymbolView
                      name="hourglass"
                      size={16}
                      tintColor={c.textSecondary}
                    />
                    <Text style={[s.rowText, { color: c.text }]}>Duration</Text>
                  </View>
                  <View style={s.duration}>
                    <TextInput
                      value={duration}
                      onChangeText={setDuration}
                      keyboardType="number-pad"
                      maxLength={3}
                      style={[s.durationInput, { color: c.brand }]}
                    />
                    <Text style={[s.minuteLabel, { color: c.textSecondary }]}>
                      min
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
          {meeting && (
            <>
              <Text style={[s.sectionLabel, { color: c.textSecondary }]}>
                MEETING
              </Text>
              <View
                style={[
                  s.card,
                  s.rows,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View style={s.linkRow}>
                  <SymbolView
                    name="video.fill"
                    size={16}
                    tintColor={c.textSecondary}
                  />
                  <TextInput
                    value={link}
                    onChangeText={setLink}
                    autoCapitalize="none"
                    keyboardType="url"
                    placeholder="Paste meeting link"
                    placeholderTextColor={c.textSecondary}
                    style={[s.linkInput, { color: c.text }]}
                  />
                </View>
              </View>
              <Text style={[s.sectionLabel, { color: c.textSecondary }]}>
                REPEAT
              </Text>
              <View
                style={[
                  s.card,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Text style={[s.repeatHint, { color: c.textSecondary }]}>
                  Only for a recurring meeting
                </Text>
                <View style={s.days}>
                  {weekdayOptions.map(([day, label]) => {
                    const active = repeatDays.includes(day);
                    return (
                      <Pressable
                        key={`${day}-${label}`}
                        onPress={() => toggleDay(day)}
                        style={[
                          s.day,
                          {
                            backgroundColor: active
                              ? c.brand
                              : c.backgroundElement,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.dayText,
                            { color: active ? "#fff" : c.textSecondary },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}
          <Text style={[s.sectionLabel, { color: c.textSecondary }]}>NOTE</Text>
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Add a note (optional)"
              placeholderTextColor={c.textSecondary}
              style={[s.notes, { color: c.text }]}
            />
          </View>
          <Text style={[s.reminder, { color: c.textSecondary }]}>
            {meeting
              ? "KASA will remind you 30 minutes before and show Join when a link is added."
              : birthday
                ? "Birthday greetings are scheduled at 9:00 AM."
                : "KASA will remind you 30 minutes before."}
          </Text>
          <Pressable
            onPress={() => void submit()}
            disabled={saving}
            style={[
              s.save,
              { backgroundColor: c.brand, opacity: saving ? 0.62 : 1 },
            ]}
          >
            {saving ? (
              <KasaSpinner size={18} color="#fff" />
            ) : (
              <Text style={s.saveText}>Save event</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PickerRow({
  icon,
  label,
  color,
  children,
}: {
  icon: "calendar" | "clock";
  label: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowLabel}>
        <SymbolView name={icon} size={16} tintColor={color} />
        <Text style={[s.rowText, { color }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 44 },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  back: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  topTitle: { fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  topSpacer: { width: 40 },
  selectedDate: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 25,
    textTransform: "uppercase",
  },
  card: { borderRadius: 20, borderWidth: 1, marginTop: 9, overflow: "hidden" },
  titleInput: {
    fontSize: 19,
    fontWeight: "800",
    height: 60,
    paddingHorizontal: 16,
  },
  divider: { height: StyleSheet.hairlineWidth },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, padding: 12 },
  kind: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 11,
  },
  kindText: { fontSize: 11, fontWeight: "800" },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginLeft: 5,
    marginTop: 23,
  },
  rows: { paddingHorizontal: 15 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
  },
  rowLabel: { alignItems: "center", flexDirection: "row", gap: 10 },
  rowText: { fontSize: 14, fontWeight: "700" },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 26 },
  duration: { alignItems: "center", flexDirection: "row" },
  durationInput: {
    fontSize: 14,
    fontWeight: "800",
    minWidth: 34,
    textAlign: "right",
  },
  minuteLabel: { fontSize: 13, marginLeft: 6 },
  linkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
  },
  linkInput: { flex: 1, fontSize: 14, height: 54 },
  repeatHint: { fontSize: 12, paddingHorizontal: 14, paddingTop: 14 },
  days: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    paddingTop: 12,
  },
  day: {
    alignItems: "center",
    borderRadius: 15,
    height: 35,
    justifyContent: "center",
    width: 35,
  },
  dayText: { fontSize: 12, fontWeight: "900" },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 88,
    padding: 14,
    paddingTop: 13,
    textAlignVertical: "top",
  },
  reminder: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 16,
    paddingHorizontal: 5,
  },
  save: {
    alignItems: "center",
    borderRadius: 17,
    height: 54,
    justifyContent: "center",
    marginTop: 17,
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
