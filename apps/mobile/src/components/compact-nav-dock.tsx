import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";

const destinations = [
  ["/", "My Day", "sun.max.fill"],
  ["/inbox", "Capture", "sparkles"],
  ["/calendar", "Calendar", "calendar"],
  ["/life", "Life", "square.grid.2x2.fill"],
  ["/timeline", "Timeline", "clock.fill"],
] as const;

/** Compact details keep the canvas clear; navigation is always one tap away. */
export function CompactNavDock() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <View
      pointerEvents="box-none"
      style={[s.position, { bottom: Math.max(insets.bottom, 14) }]}
    >
      {open ? (
        <View style={[s.expanded, { backgroundColor: c.surface }]}>
          {destinations.map(([href, label, icon]) => (
            <Pressable
              accessibilityLabel={`Open ${label}`}
              key={href}
              onPress={() => {
                setOpen(false);
                router.replace(href);
              }}
              style={({ pressed }) => [
                s.destination,
                pressed && { opacity: 0.62 },
              ]}
            >
              <SymbolView name={icon} size={18} tintColor={c.textSecondary} />
              <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityLabel="Close navigation"
            onPress={() => setOpen(false)}
            style={[s.close, { backgroundColor: c.brand }]}
          >
            <SymbolView name="xmark" size={15} tintColor="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Open navigation"
          onPress={() => setOpen(true)}
          style={[s.trigger, { backgroundColor: c.surface }]}
        >
          <SymbolView
            name="square.grid.2x2.fill"
            size={18}
            tintColor={c.brand}
          />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  position: { alignItems: "center", left: 0, position: "absolute", right: 0 },
  trigger: {
    alignItems: "center",
    borderRadius: 28,
    boxShadow: "0 12px 28px rgba(15, 6, 3, 0.24)",
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  expanded: {
    alignItems: "center",
    borderRadius: 34,
    boxShadow: "0 16px 38px rgba(15, 6, 3, 0.28)",
    flexDirection: "row",
    height: 66,
    padding: 6,
  },
  destination: {
    alignItems: "center",
    borderRadius: 26,
    gap: 3,
    height: 54,
    justifyContent: "center",
    paddingHorizontal: 11,
  },
  label: { fontSize: 8, fontWeight: "800" },
  close: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginLeft: 2,
    width: 48,
  },
});
