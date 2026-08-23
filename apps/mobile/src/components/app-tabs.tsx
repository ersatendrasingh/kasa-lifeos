import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SmartInboxScreen from "../app/(app)/inbox";
import TodayScreen from "../app/(app)/index";
import LifeScreen from "../app/(app)/life";
import TimelineScreen from "../app/(app)/timeline";
import CalendarScreen from "../app/calendar";
import { useTheme } from "@/hooks/use-theme";

const tabs = [
  ["/", "My Day", "sun.max", "sun.max.fill"],
  ["/inbox", "Capture", "sparkles", "sparkles"],
  ["/calendar", "Calendar", "calendar", "calendar"],
  ["/life", "Life", "square.grid.2x2", "square.grid.2x2.fill"],
  ["/timeline", "Timeline", "clock", "clock.fill"],
] as const;

export default function AppTabs() {
  const c = useTheme();
  const dark = useColorScheme() === "dark";
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const pager = useRef<PagerView>(null);
  const previousPathname = useRef(pathname);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      tabs.findIndex(([path]) => path === pathname),
    ),
  );
  const liquidGlass = isGlassEffectAPIAvailable();
  const pathIndex = tabs.findIndex(([path]) => path === pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (pathIndex < 0) return;
    pager.current?.setPageWithoutAnimation(pathIndex);
  }, [pathIndex, pathname]);

  function openTab(index: number) {
    pager.current?.setPage(index);
  }

  const dockContent = (
    <View style={s.dockContent}>
      {tabs.map(([path, label, icon, selectedIcon], index) => {
        const selected = index === activeIndex;
        return (
          <Pressable
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={path}
            onPress={() => openTab(index)}
            style={({ pressed }) => [
              s.tab,
              selected && {
                backgroundColor: dark
                  ? "rgba(255, 99, 56, 0.18)"
                  : "rgba(255, 79, 31, 0.11)",
              },
              pressed && { opacity: 0.68 },
            ]}
          >
            <SymbolView
              name={selected ? selectedIcon : icon}
              size={19}
              tintColor={selected ? c.brand : c.textSecondary}
            />
            <Text
              style={[s.label, { color: selected ? c.brand : c.textSecondary }]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <PagerView
        initialPage={activeIndex}
        onPageSelected={(event) => {
          setActiveIndex(event.nativeEvent.position);
        }}
        overdrag
        ref={pager}
        style={s.pager}
      >
        <View key="my-day" style={s.page}>
          <TodayScreen />
        </View>
        <View key="capture" style={s.page}>
          <SmartInboxScreen />
        </View>
        <View key="calendar" style={s.page}>
          <CalendarScreen compactNavigation={false} />
        </View>
        <View key="life" style={s.page}>
          <LifeScreen />
        </View>
        <View key="timeline" style={s.page}>
          <TimelineScreen />
        </View>
      </PagerView>

      <View style={[s.dockPosition, { bottom: Math.max(insets.bottom, 10) }]}>
        {liquidGlass ? (
          <GlassView
            colorScheme="auto"
            glassEffectStyle="regular"
            isInteractive
            style={s.dock}
            tintColor={dark ? "#2A1510A3" : "#FFF8F0A8"}
          >
            {dockContent}
          </GlassView>
        ) : (
          <BlurView
            intensity={Platform.OS === "ios" ? 76 : 58}
            style={[
              s.dock,
              {
                backgroundColor: dark
                  ? "rgba(29, 18, 14, 0.68)"
                  : "rgba(255, 250, 246, 0.7)",
              },
            ]}
            tint={dark ? "dark" : "light"}
          >
            {dockContent}
          </BlurView>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
  dockPosition: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dock: {
    width: 360,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    boxShadow: "0 12px 34px rgba(20, 7, 2, 0.28)",
  },
  dockContent: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
  },
  tab: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: { fontSize: 7.5, fontWeight: "800", letterSpacing: 0.05 },
});
