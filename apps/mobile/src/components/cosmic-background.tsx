import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { useResolvedAppearanceScheme } from "@/lib/appearance";

export function CosmicBackground() {
  const dark = useResolvedAppearanceScheme() === "dark";

  return (
    <View pointerEvents="none" style={s.background}>
      <LinearGradient
        colors={
          dark
            ? ["#1B0D08", "#090706", "#120B08", "#080706"]
            : ["#FFF5EE", "#FFF9F6", "#FFF1E9", "#FFF9F5"]
        }
        locations={[0, 0.35, 0.68, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={s.fill}
      />
      <View
        style={[s.topGlow, { backgroundColor: dark ? "#FF542B" : "#FF9B78" }]}
      />
      <View
        style={[s.sideGlow, { backgroundColor: dark ? "#9E280D" : "#FFD7C6" }]}
      />
      <LinearGradient
        colors={
          dark
            ? [
                "rgba(255,255,255,0.045)",
                "transparent",
                "rgba(255,92,42,0.035)",
              ]
            : ["rgba(255,255,255,0.75)", "transparent", "rgba(255,94,42,0.045)"]
        }
        locations={[0, 0.44, 1]}
        style={s.fill}
      />
    </View>
  );
}

const s = StyleSheet.create({
  background: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  topGlow: {
    position: "absolute",
    width: 330,
    height: 330,
    borderRadius: 165,
    top: -235,
    right: -95,
    opacity: 0.18,
    transform: [{ scaleX: 1.45 }],
  },
  sideGlow: {
    position: "absolute",
    width: 260,
    height: 410,
    borderRadius: 205,
    top: 270,
    left: -235,
    opacity: 0.09,
    transform: [{ rotate: "-18deg" }],
  },
});
