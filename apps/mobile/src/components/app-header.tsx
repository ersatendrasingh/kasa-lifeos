import { router, usePathname } from "expo-router";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import {
  listNotifications,
  NOTIFICATION_CHANGED_EVENT,
} from "@/lib/notifications";
import {
  getProfileDetails,
  PROFILE_CHANGED_EVENT,
} from "@/lib/profile-details";

export function AppHeader({ label }: { label: string }) {
  const c = useTheme();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const displayName = preferredName.trim() || session?.user.name || "K";
  const initials =
    displayName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "K";

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listNotifications()
        .then((result) => {
          if (active) setUnreadCount(result.unreadCount);
        })
        .catch(() => undefined);
    };
    refresh();
    const subscription = DeviceEventEmitter.addListener(
      NOTIFICATION_CHANGED_EVENT,
      refresh,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    const refresh = () => {
      void getProfileDetails(session.user.id).then((details) => {
        if (active) {
          setAvatarUrl(details.avatarUrl);
          setPreferredName(details.preferredName);
        }
      });
    };
    refresh();
    const subscription = DeviceEventEmitter.addListener(
      PROFILE_CHANGED_EVENT,
      refresh,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [session?.user.id]);

  const atHome = pathname === "/";

  return (
    <View style={s.header}>
      {atHome ? (
        <View style={[s.button, { backgroundColor: c.brandSoft }]}>
          <SymbolView name="sparkles" size={18} tintColor={c.brand} />
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Go to home"
          onPress={() => router.replace("/")}
          style={[
            s.button,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <SymbolView name="house.fill" size={16} tintColor={c.brand} />
        </Pressable>
      )}
      <View style={s.labelWrap}>
        <View style={[s.liveDot, { backgroundColor: c.positive }]} />
        <Text numberOfLines={1} style={[s.label, { color: c.textSecondary }]}>
          {label}
        </Text>
      </View>
      <View style={s.rightActions}>
        <Pressable
          accessibilityLabel={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          onPress={() => router.push("/notifications")}
          style={[
            s.bell,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <SymbolView
            name={unreadCount ? "bell.fill" : "bell"}
            size={16}
            tintColor={unreadCount ? c.brand : c.text}
          />
          {unreadCount > 0 && (
            <View style={[s.badge, { backgroundColor: c.brand }]}>
              <Text style={s.badgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel="Open profile"
          onPress={() => router.push("/profile")}
          style={[s.avatar, { backgroundColor: c.text }]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatarImage} alt="" />
          ) : (
            <Text style={[s.avatarText, { color: c.background }]}>
              {initials}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  labelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    maxWidth: "44%",
  },
  liveDot: { width: 6, height: 6, borderRadius: 6 },
  label: { fontSize: 11, fontWeight: "700" },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "900" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 21 },
  rightActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    right: -4,
    top: -4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#FFFFFF", fontSize: 7, fontWeight: "900" },
});
