import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
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
import { useTheme } from "@/hooks/use-theme";
import {
  deleteTimelineEvent,
  listTimelineEvents,
  setTimelineEventHidden,
  type TimelineEvent,
} from "@/lib/automation";

type Filter = "All" | "Milestones" | "Health" | "Money";
const filters: Filter[] = ["All", "Milestones", "Health", "Money"];

type UiEvent = {
  id: string;
  occurredAt: number;
  month: string;
  year: number;
  group: string;
  day: string;
  time: string;
  title: string;
  detail: string;
  category: Exclude<Filter, "All">;
  icon: "indianrupeesign.circle.fill" | "cross.case.fill" | "sparkles";
  color: string;
};

function toUiEvent(event: TimelineEvent): UiEvent {
  const occurredAt = new Date(event.occurredAt);
  const money = event.type === "FINANCE";
  const health = event.type === "HEALTH";
  return {
    id: event.id,
    occurredAt: occurredAt.getTime(),
    month: new Intl.DateTimeFormat("en-IN", { month: "long" })
      .format(occurredAt)
      .toUpperCase(),
    year: occurredAt.getFullYear(),
    group: new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
    })
      .format(occurredAt)
      .toUpperCase(),
    day: new Intl.DateTimeFormat("en-IN", { day: "2-digit" }).format(
      occurredAt,
    ),
    time: new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }).format(occurredAt),
    title: event.title,
    detail: event.summary || "Added by KASA automation",
    category: money ? "Money" : health ? "Health" : "Milestones",
    icon: money
      ? "indianrupeesign.circle.fill"
      : health
        ? "cross.case.fill"
        : "sparkles",
    color: money ? "#20A06A" : health ? "#FF5C71" : "#FF6338",
  };
}

export default function TimelineScreen() {
  const c = useTheme();
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<UiEvent[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      listTimelineEvents()
        .then((result) => {
          if (active) {
            setEvents(result.events.map(toUiEvent));
            setYears(result.years);
          }
        })
        .catch(() => undefined);
    };
    refresh();
    const subscription = DeviceEventEmitter.addListener(
      "kasa:timeline-updated",
      refresh,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          (filter === "All" || event.category === filter) &&
          (selectedYear === null || event.year === selectedYear) &&
          `${event.title} ${event.detail} ${event.category}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [events, filter, query, selectedYear],
  );
  const groups = [...new Set(visibleEvents.map((event) => event.group))];
  const yearMomentCount = events.filter(
    (event) => selectedYear === null || event.year === selectedYear,
  ).length;

  async function hideEvent(event: UiEvent) {
    setEvents((current) => current.filter((item) => item.id !== event.id));
    try {
      await setTimelineEventHidden(event.id, true);
      Alert.alert(
        "Moment hidden",
        "It is removed from your visible timeline.",
        [
          {
            text: "Undo",
            onPress: () => {
              void setTimelineEventHidden(event.id, false)
                .then(() =>
                  setEvents((current) =>
                    [...current, event].sort(
                      (a, b) => b.occurredAt - a.occurredAt,
                    ),
                  ),
                )
                .catch(() => undefined);
            },
          },
          { text: "Done" },
        ],
      );
    } catch (cause) {
      setEvents((current) =>
        [...current, event].sort((a, b) => b.occurredAt - a.occurredAt),
      );
      Alert.alert(
        "Could not hide moment",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  }

  function confirmDelete(event: UiEvent) {
    Alert.alert(
      "Delete this moment?",
      "This permanently removes it from your life history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setEvents((current) =>
              current.filter((item) => item.id !== event.id),
            );
            void deleteTimelineEvent(event.id).catch((cause) => {
              setEvents((current) =>
                [...current, event].sort((a, b) => b.occurredAt - a.occurredAt),
              );
              Alert.alert(
                "Could not delete moment",
                cause instanceof Error ? cause.message : "Please try again.",
              );
            });
          },
        },
      ],
    );
  }

  function timelineActions(event: UiEvent, controls: SwipeableMethods) {
    return (
      <View style={s.swipeActions}>
        <Pressable
          accessibilityLabel="Hide timeline moment"
          onPress={() => {
            controls.close();
            void hideEvent(event);
          }}
          style={[s.swipeAction, { backgroundColor: "#D88A18" }]}
        >
          <SymbolView name="eye.slash.fill" size={19} tintColor="#FFFFFF" />
          <Text style={s.swipeActionText}>Hide</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Delete timeline moment"
          onPress={() => {
            controls.close();
            confirmDelete(event);
          }}
          style={[s.swipeAction, { backgroundColor: "#E5484D" }]}
        >
          <SymbolView name="trash.fill" size={19} tintColor="#FFFFFF" />
          <Text style={s.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader label="Life Timeline" />
          <View style={s.titleRow}>
            <View>
              <Text style={[s.eyebrow, { color: c.brand }]}>
                YOUR STORY, ALWAYS WITH YOU
              </Text>
              <Text style={[s.title, { color: c.text }]}>Life timeline</Text>
            </View>
            <View style={[s.year, { backgroundColor: c.brandSoft }]}>
              <Text style={[s.yearText, { color: c.brand }]}>
                {selectedYear ?? "ALL"}
              </Text>
            </View>
          </View>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            Every meaningful moment, searchable even years later.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.years}
          >
            {[null, ...years].map((year) => {
              const selected = selectedYear === year;
              return (
                <Pressable
                  key={year ?? "all"}
                  onPress={() => setSelectedYear(year)}
                  style={[
                    s.yearChip,
                    {
                      backgroundColor: selected ? c.brand : c.surface,
                      borderColor: selected ? c.brand : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.yearChipText,
                      { color: selected ? "#FFFFFF" : c.textSecondary },
                    ]}
                  >
                    {year ?? "All years"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[s.hero, { backgroundColor: c.brand }]}>
            <View>
              <Text style={s.heroLabel}>
                {selectedYear ? `${selectedYear} STORY` : "YOUR COMPLETE STORY"}
              </Text>
              <Text style={s.heroTitle}>{yearMomentCount} moments</Text>
              <Text style={s.heroText}>
                Your story is taking shape beautifully.
              </Text>
            </View>
            <View style={s.heroIcon}>
              <SymbolView name="sparkles" size={27} tintColor="#FFFFFF" />
            </View>
          </View>

          <View
            style={[
              s.search,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView
              name="magnifyingglass"
              size={17}
              tintColor={c.textSecondary}
            />
            <TextInput
              onChangeText={setQuery}
              placeholder="Search your history…"
              placeholderTextColor={c.textSecondary}
              style={[s.searchInput, { color: c.text }]}
              value={query}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")}>
                <SymbolView
                  name="xmark.circle.fill"
                  size={17}
                  tintColor={c.textSecondary}
                />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filters}
          >
            {filters.map((item) => {
              const selected = item === filter;
              return (
                <Pressable
                  key={item}
                  onPress={() => setFilter(item)}
                  style={[
                    s.filter,
                    {
                      backgroundColor: selected ? c.text : c.surface,
                      borderColor: selected ? c.text : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.filterText,
                      { color: selected ? c.background : c.textSecondary },
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={s.historyHead}>
            <Text style={[s.historyTitle, { color: c.text }]}>
              Your history
            </Text>
            <Text style={[s.resultCount, { color: c.textSecondary }]}>
              {visibleEvents.length} moments
            </Text>
          </View>

          {groups.length ? (
            groups.map((group) => (
              <View key={group} style={s.monthSection}>
                <View style={s.monthHeading}>
                  <Text style={[s.month, { color: c.textSecondary }]}>
                    {selectedYear
                      ? group.replace(` ${selectedYear}`, "")
                      : group}
                  </Text>
                  <View style={[s.monthLine, { backgroundColor: c.border }]} />
                </View>
                {visibleEvents
                  .filter((event) => event.group === group)
                  .map((event) => (
                    <View key={event.id} style={s.eventRow}>
                      <View style={s.dateColumn}>
                        <Text style={[s.day, { color: c.text }]}>
                          {event.day}
                        </Text>
                        <View style={[s.rail, { backgroundColor: c.border }]} />
                      </View>
                      <ReanimatedSwipeable
                        containerStyle={s.eventSwipe}
                        friction={1.6}
                        overshootRight={false}
                        renderRightActions={(
                          _progress,
                          _translation,
                          controls,
                        ) => timelineActions(event, controls)}
                        rightThreshold={52}
                      >
                        <Pressable
                          style={[
                            s.eventCard,
                            {
                              backgroundColor: c.surface,
                              borderColor: c.border,
                            },
                          ]}
                        >
                          <View
                            style={[
                              s.eventIcon,
                              { backgroundColor: `${event.color}18` },
                            ]}
                          >
                            <SymbolView
                              name={event.icon}
                              size={17}
                              tintColor={event.color}
                            />
                          </View>
                          <View style={s.eventCopy}>
                            <View style={s.eventMeta}>
                              <Text
                                style={[s.category, { color: event.color }]}
                              >
                                {event.category.toUpperCase()}
                              </Text>
                              <Text
                                style={[s.time, { color: c.textSecondary }]}
                              >
                                {event.time}
                              </Text>
                            </View>
                            <Text style={[s.eventTitle, { color: c.text }]}>
                              {event.title}
                            </Text>
                            <Text
                              style={[
                                s.eventDetail,
                                { color: c.textSecondary },
                              ]}
                            >
                              {event.detail}
                            </Text>
                          </View>
                          <SymbolView
                            name="ellipsis"
                            size={12}
                            tintColor={c.textSecondary}
                          />
                        </Pressable>
                      </ReanimatedSwipeable>
                    </View>
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
              <View style={[s.emptyIcon, { backgroundColor: c.brandSoft }]}>
                <SymbolView
                  name="magnifyingglass"
                  size={20}
                  tintColor={c.brand}
                />
              </View>
              <Text style={[s.emptyTitle, { color: c.text }]}>
                No moments found
              </Text>
              <Text style={[s.emptyText, { color: c.textSecondary }]}>
                Try another search or category.
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 132 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1.25 },
  title: { fontSize: 31, fontWeight: "900", letterSpacing: -1.5, marginTop: 5 },
  year: { borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8 },
  yearText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  years: { gap: 8, paddingTop: 14 },
  yearChip: {
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  yearChipText: { fontSize: 9, fontWeight: "800" },
  hero: {
    minHeight: 112,
    borderRadius: 27,
    padding: 19,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heroLabel: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 6,
  },
  heroText: { color: "rgba(255,255,255,0.72)", fontSize: 9, marginTop: 4 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 13,
  },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 9 },
  filters: { gap: 8, paddingTop: 12 },
  filter: {
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: { fontSize: 10, fontWeight: "700" },
  historyHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 26,
    marginBottom: 14,
  },
  historyTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  resultCount: { fontSize: 9 },
  monthSection: { marginBottom: 16 },
  monthHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  month: { fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  monthLine: { flex: 1, height: 1 },
  eventRow: { flexDirection: "row", alignItems: "stretch", marginBottom: 10 },
  eventSwipe: { flex: 1, marginLeft: 5, borderRadius: 22, overflow: "hidden" },
  swipeActions: { width: 130, flexDirection: "row" },
  swipeAction: {
    width: 65,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  swipeActionText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  dateColumn: { width: 39, alignItems: "center" },
  day: { fontSize: 17, fontWeight: "900", lineHeight: 25 },
  rail: { width: 1, flex: 1, marginTop: 5 },
  eventCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 22,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  eventIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  eventCopy: { flex: 1, marginLeft: 11 },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  category: { fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  time: { fontSize: 7 },
  eventTitle: { fontSize: 13, fontWeight: "800", marginTop: 5 },
  eventDetail: { fontSize: 9, marginTop: 3 },
  empty: {
    borderWidth: 1,
    borderRadius: 24,
    alignItems: "center",
    padding: 28,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 14, fontWeight: "800", marginTop: 12 },
  emptyText: { fontSize: 10, marginTop: 4 },
});
