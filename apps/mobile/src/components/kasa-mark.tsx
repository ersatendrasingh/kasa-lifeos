import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export function KasaMark({ size = 42 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: theme.brand,
        },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.58 }]}>K</Text>
      <View style={styles.dot} />
    </View>
  );
}
const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
  letter: { color: "#fff", fontWeight: "800", letterSpacing: -2 },
  dot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 4,
    right: 6,
    top: 8,
    backgroundColor: "#FFD1C2",
  },
});
