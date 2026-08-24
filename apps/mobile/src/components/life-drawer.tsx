import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";

const sections = [
  {
    title: "TODAY",
    items: [
      ["sun.max.fill", "My Day", "/"],
      ["sparkles", "Smart Capture", "/inbox"],
      ["calendar", "Calendar", "/calendar"],
      ["clock.fill", "Life Timeline", "/timeline"],
    ],
  },
  {
    title: "YOUR LIFE",
    items: [
      ["folder.fill", "Memory Vault", "/life"],
      ["heart.fill", "Health Hub", "/health"],
      ["creditcard.fill", "Money & Bills", "/money"],
      ["graduationcap.fill", "Learning Studio", "/learning"],
      ["person.2.fill", "People & Follow-ups", "/people"],
      ["house.lodge.fill", "Home & Vehicle", "/life"],
      ["flag.checkered", "Growth missions", "/growth"],
    ],
  },
] as const;

export function LifeDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  function navigate(
    href:
      | "/"
      | "/inbox"
      | "/calendar"
      | "/timeline"
      | "/life"
      | "/health"
      | "/money"
      | "/learning"
      | "/people"
      | "/growth",
  ) {
    onClose();
    router.push(href);
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={s.modal}>
        <Pressable
          accessibilityLabel="Close menu"
          onPress={onClose}
          style={s.scrim}
        />
        <View
          style={[
            s.panel,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              paddingTop: insets.top + 10,
              paddingBottom: insets.bottom + 14,
            },
          ]}
        >
          <View style={s.topRow}>
            <View>
              <Text style={[s.kicker, { color: c.brand }]}>KASA LIFE OS</Text>
              <Text style={[s.heading, { color: c.text }]}>Your world</Text>
            </View>
            <Pressable
              accessibilityLabel="Close menu"
              onPress={onClose}
              style={[s.close, { backgroundColor: c.backgroundElement }]}
            >
              <SymbolView name="xmark" size={15} tintColor={c.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <View key={section.title} style={s.section}>
                <Text style={[s.sectionTitle, { color: c.textSecondary }]}>
                  {section.title}
                </Text>
                {section.items.map(([icon, label, href]) => (
                  <Pressable
                    key={label}
                    onPress={() => navigate(href)}
                    style={({ pressed }) => [
                      s.item,
                      pressed && { backgroundColor: c.backgroundElement },
                    ]}
                  >
                    <View
                      style={[s.itemIcon, { backgroundColor: c.brandSoft }]}
                    >
                      <SymbolView name={icon} size={17} tintColor={c.brand} />
                    </View>
                    <Text style={[s.itemText, { color: c.text }]}>{label}</Text>
                    <SymbolView
                      name="chevron.right"
                      size={11}
                      tintColor={c.textSecondary}
                    />
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => navigate("/life")}
            style={[s.allButton, { backgroundColor: c.brand }]}
          >
            <Text style={s.allButtonText}>Explore all life areas</Text>
            <SymbolView name="arrow.right" size={14} tintColor="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modal: { flex: 1, flexDirection: "row" },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(20, 10, 6, 0.52)",
  },
  panel: {
    width: "86%",
    maxWidth: 390,
    borderRightWidth: 1,
    borderTopRightRadius: 34,
    borderBottomRightRadius: 34,
    paddingHorizontal: 20,
    boxShadow: "18px 0 50px rgba(30, 12, 5, 0.24)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  kicker: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  heading: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 3,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { marginTop: 10 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginBottom: 7,
  },
  item: {
    height: 54,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1, fontSize: 14, fontWeight: "700", marginLeft: 12 },
  allButton: {
    height: 52,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 12,
  },
  allButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
