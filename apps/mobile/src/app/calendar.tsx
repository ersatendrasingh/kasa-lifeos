import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  getCalendar,
  saveDeviceBirthdays,
  type CalendarItem,
} from "@/lib/automation";
import {
  getDeviceBirthdays,
  scheduleCalendarGreetings,
} from "@/lib/calendar-signals";

const color = {
  EVENT: "#FF6338",
  TASK: "#8358E8",
  EXPIRY: "#E75161",
  MOMENT: "#20A06A",
  MONEY: "#E9A521",
  FESTIVAL: "#A55EEA",
  BIRTHDAY: "#E75161",
} as const;
const typeLabel = {
  EVENT: "PLAN",
  TASK: "TASK",
  EXPIRY: "EXPIRY",
  MOMENT: "MEMORY",
  MONEY: "MONEY",
  FESTIVAL: "FESTIVAL",
  BIRTHDAY: "BIRTHDAY",
} as const;
const dateKey = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function getDeviceBirthdaysWithTimeout(month: Date) {
  return Promise.race([
    getDeviceBirthdays(month),
    new Promise<{ items: CalendarItem[]; allowed: boolean }>((resolve) => {
      setTimeout(() => resolve({ items: [], allowed: false }), 8_000);
    }),
  ]);
}

export default function CalendarScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState(dateKey(new Date()));
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [birthdays, setBirthdays] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingBirthdays, setSyncingBirthdays] = useState(false);
  useEffect(() => {
    let active = true;
    // iOS Calendar can occasionally stall while its database wakes up. The
    // KASA calendar must remain usable even if the device-calendar lookup is
    // delayed or unavailable.
    Promise.allSettled([
      getCalendar(month),
      getDeviceBirthdaysWithTimeout(month),
    ])
      .then(([calendar, device]) => {
        if (!active) return;
        const items =
          calendar.status === "fulfilled" ? calendar.value.items : [];
        const birthdays =
          device.status === "fulfilled" ? device.value.items : [];
        setItems(items);
        setBirthdays(birthdays);
        void scheduleCalendarGreetings([...items, ...birthdays]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month]);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      "kasa:calendar-updated",
      () => {
        void getCalendar(month)
          .then((data) => setItems(data.items))
          .catch(() => undefined);
      },
    );
    return () => subscription.remove();
  }, [month]);
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);
  const visibleItems = [...items, ...birthdays];
  const daily = visibleItems.filter((item) => dateKey(item.date) === selected);
  const today = dateKey(new Date());
  async function syncBirthdaysAndGreetings() {
    setSyncingBirthdays(true);
    try {
      const device = await getDeviceBirthdays(month, true);
      if (!device.allowed) {
        Alert.alert(
          "Calendar access needed",
          "Allow Calendar access in Settings to show birthdays from your device.",
        );
        return;
      }
      setBirthdays(device.items);
      await saveDeviceBirthdays(month, device.items);
      const saved = await getCalendar(month);
      setItems(saved.items);
      setBirthdays([]);
      const remindersReady = await scheduleCalendarGreetings(
        [...saved.items, ...device.items],
        true,
      ).catch(() => false);
      Alert.alert(
        "Dates are ready",
        `${device.items.length} birthday${device.items.length === 1 ? "" : "s"} saved to KASA.${remindersReady ? " Upcoming greetings are scheduled." : " Enable Notifications to schedule greetings."}`,
      );
    } catch (error) {
      Alert.alert(
        "Could not sync birthdays",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setSyncingBirthdays(false);
    }
  }
  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={[
            s.content,
            {
              paddingBottom: Math.max(insets.bottom + 34, 48),
            },
          ]}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[9]}
        >
          <AppHeader label="Calendar" />
          <Text style={[s.kicker, { color: c.brand }]}>
            YOUR TIME, CONNECTED
          </Text>
          <Text numberOfLines={1} style={[s.title, { color: c.text }]}>
            Your life, organized.
          </Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            Plans, tasks, renewals and memories—where they belong.
          </Text>
          <View style={s.monthControl}>
            <Pressable
              accessibilityLabel="Previous month"
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
              style={[
                s.arrow,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="chevron.left" size={14} tintColor={c.text} />
            </Pressable>
            <Pressable
              onPress={() => {
                const now = new Date();
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelected(dateKey(now));
              }}
            >
              <Text style={[s.month, { color: c.text }]}>
                {new Intl.DateTimeFormat("en-IN", {
                  month: "long",
                  year: "numeric",
                }).format(month)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Next month"
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
              style={[
                s.arrow,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="chevron.right" size={14} tintColor={c.text} />
            </Pressable>
          </View>
          <View
            style={[
              s.calendar,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={s.week}>
              {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                <Text
                  key={`${day}${index}`}
                  style={[s.weekday, { color: c.textSecondary }]}
                >
                  {day}
                </Text>
              ))}
            </View>
            <View style={s.grid}>
              {days.map((day) => {
                const key = dateKey(day);
                const events = visibleItems.filter(
                  (item) => dateKey(item.date) === key,
                );
                const selectedDay = key === selected;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelected(key)}
                    style={[
                      s.day,
                      selectedDay && { backgroundColor: c.brandSoft },
                      day.getMonth() !== month.getMonth() && s.dim,
                    ]}
                  >
                    <Text
                      style={[
                        s.dayNumber,
                        {
                          color: key === today ? "#FFFFFF" : c.text,
                          backgroundColor:
                            key === today ? c.brand : "transparent",
                        },
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    <View style={s.dots}>
                      {events.slice(0, 3).map((event) => (
                        <View
                          key={event.id}
                          style={[
                            s.dot,
                            { backgroundColor: color[event.type] },
                          ]}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={s.legend}>
            {Object.entries(typeLabel).map(([key, value]) => (
              <View key={key} style={s.legendItem}>
                <View
                  style={[
                    s.legendDot,
                    { backgroundColor: color[key as keyof typeof color] },
                  ]}
                />
                <Text style={[s.legendText, { color: c.textSecondary }]}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
          <Pressable
            disabled={syncingBirthdays}
            onPress={() => void syncBirthdaysAndGreetings()}
            style={[
              s.birthdaySync,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="gift.fill" size={16} tintColor={c.brand} />
            <View style={s.birthdayCopy}>
              <Text style={[s.birthdayTitle, { color: c.text }]}>
                {syncingBirthdays
                  ? "Syncing dates…"
                  : "Sync birthdays & greetings"}
              </Text>
              <Text style={[s.birthdayDetail, { color: c.textSecondary }]}>
                Birthdays stay on your device. Festival reminders are automatic.
              </Text>
            </View>
            {syncingBirthdays ? <KasaSpinner size={16} /> : null}
          </Pressable>
          <View
            style={[
              s.dayHeading,
              s.stickyDayHeading,
              { backgroundColor: c.background },
            ]}
          >
            <View>
              <Text style={[s.dayEyebrow, { color: c.brand }]}>
                {new Intl.DateTimeFormat("en-IN", { weekday: "long" })
                  .format(new Date(`${selected}T12:00:00`))
                  .toUpperCase()}
              </Text>
              <Text style={[s.dayTitle, { color: c.text }]}>
                {new Intl.DateTimeFormat("en-IN", {
                  day: "numeric",
                  month: "long",
                }).format(new Date(`${selected}T12:00:00`))}
              </Text>
            </View>
            <View style={s.dayActions}>
              <View style={[s.count, { backgroundColor: c.brandSoft }]}>
                <Text style={[s.countText, { color: c.brand }]}>
                  {daily.length}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={`Add event on ${selected}`}
                onPress={() =>
                  router.push({
                    pathname: "/calendar-new",
                    params: { date: selected },
                  })
                }
                hitSlop={8}
                style={[s.addForDay, { backgroundColor: c.brand }]}
              >
                <SymbolView name="plus" size={15} tintColor="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          {loading ? (
            <View style={s.loading}>
              <KasaSpinner size={24} />
            </View>
          ) : daily.length ? (
            <View style={s.events}>
              {daily.map((item) => (
                <View
                  key={item.id}
                  style={[
                    s.event,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <View
                    style={[s.eventLine, { backgroundColor: color[item.type] }]}
                  />
                  <View style={s.eventBody}>
                    <View style={s.eventTop}>
                      <Text style={[s.eventKind, { color: color[item.type] }]}>
                        {typeLabel[item.type]}
                      </Text>
                      <Text style={[s.eventTime, { color: c.textSecondary }]}>
                        {item.allDay
                          ? "All day"
                          : new Intl.DateTimeFormat("en-IN", {
                              hour: "numeric",
                              minute: "2-digit",
                            }).format(new Date(item.date))}
                      </Text>
                    </View>
                    <Text style={[s.eventTitle, { color: c.text }]}>
                      {item.title}
                    </Text>
                    {item.detail ? (
                      <Text style={[s.eventDetail, { color: c.textSecondary }]}>
                        {item.detail}
                      </Text>
                    ) : null}
                    {item.meetingUrl ? (
                      <Pressable
                        onPress={() => void Linking.openURL(item.meetingUrl!)}
                        style={[s.join, { backgroundColor: c.brandSoft }]}
                      >
                        <SymbolView
                          name="video.fill"
                          size={13}
                          tintColor={c.brand}
                        />
                        <Text style={[s.joinText, { color: c.brand }]}>
                          Join meeting
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[
                s.empty,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="leaf.fill" size={22} tintColor={c.brand} />
              <Text style={[s.emptyTitle, { color: c.text }]}>
                Nothing demanding today.
              </Text>
              <Text style={[s.emptyText, { color: c.textSecondary }]}>
                A little breathing room is part of a good plan.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  kicker: { fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginTop: 17 },
  title: {
    fontSize: 33,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.6,
    marginTop: 6,
  },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 310 },
  monthControl: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  month: { fontSize: 17, fontWeight: "900", letterSpacing: -0.4 },
  arrow: {
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  calendar: { borderRadius: 25, borderWidth: 1, marginTop: 15, padding: 12 },
  week: { flexDirection: "row", marginBottom: 7 },
  weekday: {
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    width: "14.2857%",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    alignItems: "center",
    borderRadius: 13,
    height: 45,
    justifyContent: "center",
    width: "14.2857%",
  },
  dim: { opacity: 0.32 },
  dayNumber: {
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "800",
    height: 24,
    lineHeight: 24,
    textAlign: "center",
    width: 24,
  },
  dots: { flexDirection: "row", gap: 2, height: 5, marginTop: 1 },
  dot: { borderRadius: 2, height: 4, width: 4 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 4 },
  legendDot: { borderRadius: 3, height: 6, width: 6 },
  legendText: { fontSize: 9, fontWeight: "800" },
  birthdaySync: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
    padding: 13,
  },
  birthdayCopy: { flex: 1 },
  birthdayTitle: { fontSize: 11, fontWeight: "900" },
  birthdayDetail: { fontSize: 9, lineHeight: 13, marginTop: 2 },
  dayHeading: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    width: "100%",
  },
  stickyDayHeading: { paddingBottom: 13, paddingTop: 16 },
  dayEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  dayTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 3,
  },
  count: {
    alignItems: "center",
    borderRadius: 14,
    height: 34,
    justifyContent: "center",
    marginLeft: "auto",
    width: 34,
  },
  countText: { fontSize: 14, fontWeight: "900" },
  dayActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  addForDay: {
    alignItems: "center",
    borderRadius: 14,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  loading: { alignItems: "center", height: 145, justifyContent: "center" },
  events: { gap: 10, marginTop: 15 },
  event: {
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  eventLine: { width: 4 },
  eventBody: { flex: 1, padding: 14 },
  eventTop: { flexDirection: "row", justifyContent: "space-between" },
  eventKind: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  eventTime: { fontSize: 11, fontWeight: "700" },
  eventTitle: { fontSize: 15, fontWeight: "900", marginTop: 6 },
  eventDetail: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  join: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  joinText: { fontSize: 10, fontWeight: "900" },
  empty: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 15,
    padding: 26,
  },
  emptyTitle: { fontSize: 15, fontWeight: "900", marginTop: 10 },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },
});
