import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { createLearningTrack, type LearningTrack } from "@/lib/learning";

const types: LearningTrack["type"][] = [
  "COURSE",
  "BOOK",
  "SKILL",
  "PRACTICE",
  "CERTIFICATION",
];
const nice = (value: string) => value[0] + value.slice(1).toLowerCase();

export default function NewLearningTrackScreen() {
  const c = useTheme();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LearningTrack["type"]>("COURSE");
  const [provider, setProvider] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("180");
  const [lessons, setLessons] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (title.trim().length < 2) {
      Alert.alert(
        "Name your track",
        "For example: React Native or Atomic Habits.",
      );
      return;
    }
    const weeklyGoalMinutes = Number(goal);
    if (!Number.isInteger(weeklyGoalMinutes) || weeklyGoalMinutes < 15) {
      Alert.alert("Set a weekly rhythm", "Enter at least 15 minutes per week.");
      return;
    }
    setSaving(true);
    try {
      await createLearningTrack({
        title: title.trim(),
        type,
        provider: provider.trim() || undefined,
        url: url.trim() || undefined,
        description: description.trim() || undefined,
        weeklyGoalMinutes,
        lessons: lessons
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      router.replace("/learning");
    } catch (error) {
      Alert.alert(
        "Could not create track",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
        <KeyboardAvoidingView
          style={s.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={() => router.back()}
              style={[
                s.back,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="chevron.left" size={17} tintColor={c.text} />
              <Text style={[s.backText, { color: c.text }]}>Learning</Text>
            </Pressable>
            <Text style={[s.kicker, { color: c.brand }]}>
              NEW LEARNING TRACK
            </Text>
            <Text style={[s.title, { color: c.text }]}>
              Make the next step clear.
            </Text>
            <Text style={[s.subtitle, { color: c.textSecondary }]}>
              Add the resource, a realistic rhythm, and only the first few steps
              you will actually finish.
            </Text>

            <View
              style={[
                s.card,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[s.sectionTitle, { color: c.text }]}>Your plan</Text>
              <Field label="WHAT ARE YOU LEARNING?" color={c.textSecondary}>
                <TextInput
                  autoFocus
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. System design fundamentals"
                  placeholderTextColor={c.textSecondary}
                  style={[s.input, { borderColor: c.border, color: c.text }]}
                />
              </Field>
              <Field label="FORMAT" color={c.textSecondary}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.types}
                >
                  {types.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setType(item)}
                      style={[
                        s.type,
                        {
                          backgroundColor:
                            type === item ? c.brand : c.backgroundElement,
                          borderColor: type === item ? c.brand : c.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.typeText,
                          { color: type === item ? "#fff" : c.textSecondary },
                        ]}
                      >
                        {nice(item)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Field>
              <Field
                label="PROVIDER OR AUTHOR (OPTIONAL)"
                color={c.textSecondary}
              >
                <TextInput
                  value={provider}
                  onChangeText={setProvider}
                  placeholder="e.g. Coursera or James Clear"
                  placeholderTextColor={c.textSecondary}
                  style={[s.input, { borderColor: c.border, color: c.text }]}
                />
              </Field>
              <Field label="RESOURCE LINK (OPTIONAL)" color={c.textSecondary}>
                <TextInput
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://…"
                  placeholderTextColor={c.textSecondary}
                  style={[s.input, { borderColor: c.border, color: c.text }]}
                />
              </Field>
              <Field label="WEEKLY FOCUS" color={c.textSecondary}>
                <View style={s.goalRow}>
                  <TextInput
                    value={goal}
                    onChangeText={setGoal}
                    keyboardType="number-pad"
                    style={[s.goal, { borderColor: c.border, color: c.text }]}
                  />
                  <Text style={[s.goalText, { color: c.textSecondary }]}>
                    minutes per week
                  </Text>
                </View>
              </Field>
            </View>
            <View
              style={[
                s.card,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[s.sectionTitle, { color: c.text }]}>
                Make it practical
              </Text>
              <Field label="OUTCOME (OPTIONAL)" color={c.textSecondary}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder="What will this help you do?"
                  placeholderTextColor={c.textSecondary}
                  style={[
                    s.input,
                    s.multiline,
                    { borderColor: c.border, color: c.text },
                  ]}
                />
              </Field>
              <Field
                label="FIRST LESSONS OR MILESTONES"
                color={c.textSecondary}
              >
                <TextInput
                  value={lessons}
                  onChangeText={setLessons}
                  multiline
                  placeholder={
                    "One per line\nCaching and queues\nBuild a small project"
                  }
                  placeholderTextColor={c.textSecondary}
                  style={[
                    s.input,
                    s.lessons,
                    { borderColor: c.border, color: c.text },
                  ]}
                />
              </Field>
            </View>
            <Text style={[s.note, { color: c.textSecondary }]}>
              Starting this track creates a private learning moment in your
              Timeline.
            </Text>
          </ScrollView>
          <View
            style={[
              s.footer,
              { backgroundColor: c.background, borderColor: c.border },
            ]}
          >
            <Pressable
              disabled={saving}
              onPress={() => void submit()}
              style={[
                s.submit,
                { backgroundColor: c.brand, opacity: saving ? 0.65 : 1 },
              ]}
            >
              {saving ? (
                <KasaSpinner size={18} color="#fff" />
              ) : (
                <>
                  <SymbolView name="checkmark" size={15} tintColor="#fff" />
                  <Text style={s.submitText}>Create learning track</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={[s.label, { color }]}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 130 },
  back: {
    alignSelf: "flex-start",
    height: 40,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  backText: { fontSize: 11, fontWeight: "800" },
  kicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1.4, marginTop: 25 },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -1.2, marginTop: 7 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 340 },
  card: { borderWidth: 1, borderRadius: 25, padding: 17, marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "900" },
  field: { marginTop: 19 },
  label: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.05,
    marginBottom: 9,
  },
  input: {
    minHeight: 51,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 12,
  },
  multiline: { minHeight: 78, paddingTop: 12, textAlignVertical: "top" },
  lessons: { minHeight: 124, paddingTop: 12, textAlignVertical: "top" },
  types: { gap: 7 },
  type: {
    height: 35,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: { fontSize: 8, fontWeight: "900" },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  goal: {
    height: 51,
    width: 88,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "900",
  },
  goalText: { fontSize: 11 },
  note: { fontSize: 10, lineHeight: 15, marginTop: 15, paddingHorizontal: 4 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  submit: {
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});
