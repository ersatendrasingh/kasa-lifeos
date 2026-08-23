import {
  TabList,
  TabSlot,
  Tabs,
  TabTrigger,
  TabTriggerSlotProps,
} from "expo-router/ui";
import { Pressable, StyleSheet, Text, useColorScheme } from "react-native";

import { Colors, MaxContentWidth, Spacing } from "@/constants/theme";

const destinations = [
  { name: "today", href: "/", label: "My Day" },
  { name: "inbox", href: "/inbox", label: "Capture" },
  { name: "calendar", href: "/calendar", label: "Calendar" },
  { name: "life", href: "/life", label: "Life" },
  { name: "timeline", href: "/timeline", label: "Timeline" },
] as const;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList
        style={[
          styles.tabList,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {destinations.map((destination) => (
          <TabTrigger
            key={destination.name}
            name={destination.name}
            href={destination.href}
            asChild
          >
            <TabButton colors={colors}>{destination.label}</TabButton>
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function TabButton({
  children,
  isFocused,
  colors,
  ...props
}: TabTriggerSlotProps & {
  colors: (typeof Colors)["light"] | (typeof Colors)["dark"];
}) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused && { backgroundColor: colors.backgroundSelected },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? colors.brand : colors.textSecondary },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { height: "100%" },
  tabList: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 24,
    borderWidth: 1,
    bottom: Spacing.three,
    boxShadow: "0 14px 40px rgba(64, 26, 10, 0.14)",
    flexDirection: "row",
    gap: Spacing.one,
    justifyContent: "center",
    maxWidth: MaxContentWidth,
    padding: Spacing.two,
    position: "absolute",
    width: "92%",
  },
  tabButton: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  tabLabel: { fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.72 },
});
