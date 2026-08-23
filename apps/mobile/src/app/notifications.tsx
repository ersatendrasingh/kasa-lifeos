import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  clearNotifications,
  createTestNotification,
  deleteNotification,
  type KasaNotification,
  listNotifications,
  markAllNotificationsRead,
  NOTIFICATION_CHANGED_EVENT,
  setNotificationRead,
  syncLocalNotifications,
} from "@/lib/notifications";

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function categoryIcon(item: KasaNotification) {
  const category = String(
    (item.metadata as { category?: string } | null)?.category ?? item.channel,
  ).toLowerCase();
  if (category.includes("bill") || category.includes("finance"))
    return "indianrupeesign.circle.fill" as const;
  if (category.includes("health") || category.includes("medicine"))
    return "heart.fill" as const;
  if (category.includes("birthday") || category.includes("people"))
    return "person.2.fill" as const;
  if (category.includes("document") || category.includes("expiry"))
    return "doc.text.fill" as const;
  return "sparkles" as const;
}

export default function NotificationCenterScreen() {
  const c = useTheme();
  const [items, setItems] = useState<KasaNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const today: KasaNotification[] = [];
    const earlier: KasaNotification[] = [];
    for (const item of items) {
      (new Date(item.scheduledAt) >= start ? today : earlier).push(item);
    }
    return [
      { title: "TODAY", items: today },
      { title: "EARLIER", items: earlier },
    ].filter((section) => section.items.length > 0);
  }, [items]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      await syncLocalNotifications().catch(() => undefined);
      const result = await listNotifications();
      setItems(
        [...result.notifications].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      );
      setUnreadCount(result.unreadCount);
      await Notifications.setBadgeCountAsync(result.unreadCount).catch(
        () => false,
      );
      DeviceEventEmitter.emit(NOTIFICATION_CHANGED_EVENT, result.unreadCount);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load alerts.",
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

  async function toggleRead(item: KasaNotification) {
    const read = !item.readAt;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, readAt: read ? new Date().toISOString() : null }
          : entry,
      ),
    );
    setUnreadCount((count) => Math.max(0, count + (read ? -1 : 1)));
    try {
      await setNotificationRead(item.id, read);
      await load(true);
    } catch {
      await load(true);
    }
  }

  async function removeNotification(item: KasaNotification) {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    if (!item.readAt) setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await deleteNotification(item.id);
      DeviceEventEmitter.emit(NOTIFICATION_CHANGED_EVENT);
    } catch (cause) {
      await load(true);
      Alert.alert(
        "Could not delete notification",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  }

  function notificationActions(
    item: KasaNotification,
    controls: SwipeableMethods,
  ) {
    const unread = !item.readAt;
    return (
      <View style={s.swipeActions}>
        <Pressable
          accessibilityLabel={unread ? "Mark notification read" : "Mark unread"}
          onPress={() => {
            controls.close();
            void toggleRead(item);
          }}
          style={[s.swipeAction, { backgroundColor: c.brand }]}
        >
          <SymbolView
            name={unread ? "checkmark.circle.fill" : "envelope.badge.fill"}
            size={20}
            tintColor="#FFFFFF"
          />
          <Text style={s.swipeActionText}>{unread ? "Read" : "Unread"}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Delete notification"
          onPress={() => {
            controls.close();
            void removeNotification(item);
          }}
          style={[s.swipeAction, { backgroundColor: "#E5484D" }]}
        >
          <SymbolView name="trash.fill" size={19} tintColor="#FFFFFF" />
          <Text style={s.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      await load(true);
    } catch (cause) {
      Alert.alert(
        "Could not update notifications",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    }
  }

  function confirmClear(scope: "read" | "all") {
    Alert.alert(
      scope === "all"
        ? "Clear every notification?"
        : "Clear read notifications?",
      scope === "all"
        ? "This removes your complete notification history."
        : "Unread reminders will stay in your inbox.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearNotifications(scope);
              await load(true);
            } catch (cause) {
              Alert.alert(
                "Could not clear notifications",
                cause instanceof Error ? cause.message : "Please try again.",
              );
            }
          },
        },
      ],
    );
  }

  function showNotificationOptions() {
    Alert.alert("Manage notifications", undefined, [
      {
        text: "Test KASA alert",
        onPress: async () => {
          try {
            await createTestNotification();
            await load(true);
          } catch (cause) {
            Alert.alert(
              "Could not send test alert",
              cause instanceof Error ? cause.message : "Please try again.",
            );
          }
        },
      },
      { text: "Mark all as read", onPress: () => void markAllRead() },
      {
        text: "Clear read notifications",
        style: "destructive",
        onPress: () => confirmClear("read"),
      },
      {
        text: "Clear all notifications",
        style: "destructive",
        onPress: () => confirmClear("all"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

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
          <View style={s.navCopy}>
            <Text style={[s.navTitle, { color: c.text }]}>Notifications</Text>
            <Text style={[s.navMeta, { color: c.textSecondary }]}>
              {unreadCount
                ? `${unreadCount} need your attention`
                : "You’re all caught up"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Notification options"
            onPress={showNotificationOptions}
            style={[
              s.navButton,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <SymbolView name="ellipsis" size={18} tintColor={c.text} />
          </Pressable>
        </View>

        <View style={s.actions}>
          <Pressable
            disabled={!unreadCount}
            onPress={() => void markAllRead()}
            style={[
              s.action,
              { backgroundColor: c.brandSoft, opacity: unreadCount ? 1 : 0.5 },
            ]}
          >
            <SymbolView
              name="checkmark.circle.fill"
              size={14}
              tintColor={c.brand}
            />
            <Text style={[s.actionText, { color: c.brand }]}>
              Mark all read
            </Text>
          </Pressable>
          <Text style={[s.actionHint, { color: c.textSecondary }]}>
            Latest first
          </Text>
        </View>

        {loading ? (
          <View style={s.center}>
            <KasaSpinner size={28} />
          </View>
        ) : error ? (
          <View style={s.center}>
            <SymbolView
              name="wifi.exclamationmark"
              size={30}
              tintColor={c.brand}
            />
            <Text style={[s.errorTitle, { color: c.text }]}>
              Couldn’t refresh alerts
            </Text>
            <Text style={[s.errorText, { color: c.textSecondary }]}>
              {error}
            </Text>
            <Pressable
              onPress={() => void load()}
              style={[s.retry, { backgroundColor: c.brand }]}
            >
              <Text style={s.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={s.center}>
            <View style={[s.emptyIcon, { backgroundColor: c.brandSoft }]}>
              <SymbolView
                name="bell.slash.fill"
                size={29}
                tintColor={c.brand}
              />
            </View>
            <Text style={[s.emptyTitle, { color: c.text }]}>Quiet for now</Text>
            <Text style={[s.emptyText, { color: c.textSecondary }]}>
              Bills, renewals and smart reminders will appear here when KASA
              finds something important.
            </Text>
          </View>
        ) : (
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
            {sections.map((section) => (
              <View key={section.title}>
                <Text style={[s.sectionLabel, { color: c.textSecondary }]}>
                  {section.title}
                </Text>
                <View
                  style={[
                    s.list,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  {section.items.map((item, index) => {
                    const unread = !item.readAt;
                    return (
                      <ReanimatedSwipeable
                        containerStyle={[
                          s.swipeContainer,
                          index > 0 && {
                            borderTopWidth: 1,
                            borderTopColor: c.border,
                          },
                        ]}
                        friction={1.6}
                        key={item.id}
                        overshootRight={false}
                        renderRightActions={(
                          _progress,
                          _translation,
                          controls,
                        ) => notificationActions(item, controls)}
                        rightThreshold={54}
                      >
                        <Pressable
                          accessibilityHint="Marks this notification read or unread"
                          onPress={() => void toggleRead(item)}
                          style={[
                            s.row,
                            { backgroundColor: c.surface },
                            unread && { backgroundColor: c.brandSoft },
                          ]}
                        >
                          <View
                            style={[
                              s.itemIcon,
                              {
                                backgroundColor: unread
                                  ? c.brand
                                  : c.backgroundElement,
                              },
                            ]}
                          >
                            <SymbolView
                              name={categoryIcon(item)}
                              size={17}
                              tintColor={unread ? "#FFFFFF" : c.brand}
                            />
                          </View>
                          <View style={s.itemCopy}>
                            <View style={s.itemHeading}>
                              <Text
                                numberOfLines={1}
                                style={[s.itemTitle, { color: c.text }]}
                              >
                                {item.title}
                              </Text>
                              <Text
                                style={[s.time, { color: c.textSecondary }]}
                              >
                                {relativeTime(item.scheduledAt)}
                              </Text>
                            </View>
                            {!!item.body && (
                              <Text
                                numberOfLines={2}
                                style={[s.itemBody, { color: c.textSecondary }]}
                              >
                                {item.body}
                              </Text>
                            )}
                            <Text
                              style={[
                                s.itemHint,
                                { color: unread ? c.brand : c.textSecondary },
                              ]}
                            >
                              {unread
                                ? "Tap to mark read · Swipe for options"
                                : "Read · Swipe for options"}
                            </Text>
                          </View>
                          {unread && (
                            <View
                              style={[
                                s.unreadDot,
                                { backgroundColor: c.brand },
                              ]}
                            />
                          )}
                        </Pressable>
                      </ReanimatedSwipeable>
                    );
                  })}
                </View>
              </View>
            ))}
            <Text style={[s.footer, { color: c.textSecondary }]}>
              KASA only alerts you when action matters.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  safe: { flex: 1 },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 280,
    opacity: 0.08,
    top: -160,
    right: -100,
  },
  nav: {
    height: 66,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navCopy: { flex: 1 },
  navTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.6 },
  navMeta: { fontSize: 9, marginTop: 2 },
  actions: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  action: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actionText: { fontSize: 10, fontWeight: "900" },
  actionHint: { fontSize: 9, fontWeight: "700" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 42,
  },
  content: { paddingHorizontal: 20, paddingTop: 5, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.25,
    marginTop: 17,
    marginBottom: 8,
    marginLeft: 4,
  },
  list: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  swipeContainer: { overflow: "hidden" },
  swipeActions: { width: 142, flexDirection: "row" },
  swipeAction: {
    width: 71,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  swipeActionText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  row: {
    minHeight: 91,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
  },
  itemIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCopy: { flex: 1, marginLeft: 11 },
  itemHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemTitle: { flex: 1, fontSize: 12, fontWeight: "800" },
  itemBody: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  itemHint: { fontSize: 8, fontWeight: "700", marginTop: 6 },
  time: { fontSize: 8, fontWeight: "800" },
  unreadDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 6,
    right: 8,
    top: 8,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 20, fontWeight: "900" },
  emptyText: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 7,
  },
  errorTitle: { fontSize: 17, fontWeight: "900", marginTop: 15 },
  errorText: { fontSize: 10, textAlign: "center", marginTop: 6 },
  retry: {
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 17,
  },
  retryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  footer: { textAlign: "center", fontSize: 8, marginTop: 20 },
});
