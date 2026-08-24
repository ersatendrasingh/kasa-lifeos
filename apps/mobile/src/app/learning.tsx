import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import {
  createLearningTrack,
  getLearning,
  updateLearning,
  type LearningTrack,
} from "@/lib/learning";

const types: LearningTrack["type"][] = [
  "COURSE",
  "BOOK",
  "SKILL",
  "PRACTICE",
  "CERTIFICATION",
];
const nice = (value: string) => value[0] + value.slice(1).toLowerCase();
const progress = (track: LearningTrack) =>
  track.lessons.length
    ? Math.round(
        (track.lessons.filter((lesson) => lesson.completedAt).length /
          track.lessons.length) *
          100,
      )
    : 0;

export default function LearningScreen() {
  const c = useTheme();
  const [tracks, setTracks] = useState<LearningTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<LearningTrack | null>(null);
  const [create, setCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [goal, setGoal] = useState("180");
  const [lessons, setLessons] = useState("");
  const [type, setType] = useState<LearningTrack["type"]>("COURSE");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      setTracks((await getLearning()).tracks);
    } catch (e) {
      if (!refresh)
        Alert.alert(
          "Learning unavailable",
          e instanceof Error ? e.message : "Try again.",
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
  const active = tracks.filter((track) => track.status === "ACTIVE");
  const week = tracks.reduce((sum, track) => sum + track.weeklyMinutes, 0);
  const target = active.reduce(
    (sum, track) => sum + track.weeklyGoalMinutes,
    0,
  );
  const focus = active
    .slice()
    .sort(
      (a, b) =>
        (a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0) -
        (b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0),
    )[0];
  async function mutate(input: Parameters<typeof updateLearning>[0]) {
    setBusy(true);
    try {
      const result = await updateLearning(input);
      setTracks(result.tracks);
      setSelected(
        result.tracks.find((track) => track.id === input.trackId) || null,
      );
    } catch (e) {
      Alert.alert(
        "Could not update learning",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveTrack() {
    if (title.trim().length < 2) return;
    setBusy(true);
    try {
      const result = await createLearningTrack({
        title: title.trim(),
        type,
        provider: provider.trim() || undefined,
        weeklyGoalMinutes: Number(goal) || 180,
        lessons: lessons
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setTracks((current) => [result.track, ...current]);
      setCreate(false);
    } catch (e) {
      Alert.alert(
        "Could not create track",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={s.safe}>
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={c.brand}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <AppHeader label="Learning" />
          <Text style={[s.kicker, { color: c.brand }]}>LEARNING STUDIO</Text>
          <Text style={[s.title, { color: c.text }]}>
            Build knowledge that stays.
          </Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            Tracks, lessons and focused sessions—connected to your real
            progress.
          </Text>
          <View
            style={[
              s.weekCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View>
              <Text style={[s.weekKicker, { color: c.textSecondary }]}>
                THIS WEEK
              </Text>
              <Text style={[s.weekNumber, { color: c.text }]}>
                {week}
                <Text style={s.weekUnit}> min</Text>
              </Text>
              <Text style={[s.weekCopy, { color: c.textSecondary }]}>
                {target
                  ? `${Math.min(100, Math.round((week / target) * 100))}% of ${target} minute goal`
                  : "Add a track to set your rhythm"}
              </Text>
            </View>
            <View style={[s.ring, { borderColor: c.brand }]} />
          </View>
          {focus && (
            <Pressable
              onPress={() => setSelected(focus)}
              style={[s.focus, { backgroundColor: c.brand }]}
            >
              <Text style={s.focusKicker}>CONTINUE LEARNING</Text>
              <Text style={s.focusTitle}>{focus.title}</Text>
              <Text style={s.focusCopy}>
                {focus.weeklyMinutes}/{focus.weeklyGoalMinutes} minutes this
                week · {progress(focus)}% lessons
              </Text>
              <View style={s.focusActions}>
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void mutate({
                      trackId: focus.id,
                      action: "log-session",
                      minutes: 25,
                    })
                  }
                  style={s.studyButton}
                >
                  {busy ? (
                    <KasaSpinner size={16} color={c.brand} />
                  ) : (
                    <>
                      <SymbolView
                        name="play.fill"
                        size={13}
                        tintColor={c.brand}
                      />
                      <Text style={[s.studyText, { color: c.brand }]}>
                        Study 25 min
                      </Text>
                    </>
                  )}
                </Pressable>
                <Text style={s.openText}>Open →</Text>
              </View>
            </Pressable>
          )}
          <View style={s.sectionHead}>
            <Text style={[s.heading, { color: c.text }]}>Your tracks</Text>
            <Pressable onPress={() => router.push("/learning/new")}>
              <Text style={[s.add, { color: c.brand }]}>+ ADD TRACK</Text>
            </Pressable>
          </View>
          {loading ? (
            <View style={s.loader}>
              <KasaSpinner size={28} />
            </View>
          ) : active.length ? (
            active.map((track) => (
              <Pressable
                key={track.id}
                onPress={() => setSelected(track)}
                style={[
                  s.track,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View style={s.trackTop}>
                  <Text style={[s.trackType, { color: c.brand }]}>
                    {nice(track.type)}
                  </Text>
                  <Text style={[s.trackPercent, { color: c.text }]}>
                    {progress(track)}%
                  </Text>
                </View>
                <Text style={[s.trackTitle, { color: c.text }]}>
                  {track.title}
                </Text>
                <Text style={[s.trackMeta, { color: c.textSecondary }]}>
                  {track.provider || `${track.lessons.length} lessons`} ·{" "}
                  {track.weeklyMinutes}/{track.weeklyGoalMinutes} min
                </Text>
                <View style={[s.bar, { backgroundColor: c.backgroundElement }]}>
                  <View
                    style={[
                      s.fill,
                      {
                        backgroundColor: c.brand,
                        width: `${progress(track)}%`,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            ))
          ) : (
            <View
              style={[
                s.empty,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView
                name="graduationcap.fill"
                size={30}
                tintColor={c.brand}
              />
              <Text style={[s.emptyTitle, { color: c.text }]}>
                Start your first track
              </Text>
              <Text style={[s.emptyCopy, { color: c.textSecondary }]}>
                A course, book, skill or daily practice—make it visible before
                it gets lost.
              </Text>
              <Pressable onPress={() => router.push("/learning/new")}>
                <Text style={[s.emptyAction, { color: c.brand }]}>
                  Create a track →
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelected(null)}
      >
        <View style={[s.modal, { backgroundColor: c.background }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.detailContent}
            style={[s.sheet, s.fullSheet, { backgroundColor: c.background }]}
          >
            {selected && (
              <>
                <Pressable
                  onPress={() => setSelected(null)}
                  style={[
                    s.back,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <SymbolView
                    name="chevron.left"
                    size={17}
                    tintColor={c.text}
                  />
                </Pressable>
                <Text style={[s.trackType, { color: c.brand }]}>
                  {nice(selected.type)}
                </Text>
                <Text style={[s.sheetTitle, { color: c.text }]}>
                  {selected.title}
                </Text>
                <Text style={[s.sheetMeta, { color: c.textSecondary }]}>
                  {selected.weeklyMinutes}/{selected.weeklyGoalMinutes} minutes
                  this week · {progress(selected)}% complete
                </Text>
                <View style={s.sheetActions}>
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      void mutate({
                        trackId: selected.id,
                        action: "log-session",
                        minutes: 25,
                      })
                    }
                    style={[s.primary, { backgroundColor: c.brand }]}
                  >
                    <Text style={s.primaryText}>Log 25-minute session</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      void mutate({
                        trackId: selected.id,
                        action: "set-status",
                        status:
                          selected.status === "PAUSED" ? "ACTIVE" : "PAUSED",
                      })
                    }
                    style={[
                      s.secondary,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <Text style={[s.secondaryText, { color: c.text }]}>
                      {selected.status === "PAUSED" ? "Resume" : "Pause"}
                    </Text>
                  </Pressable>
                </View>
                <View style={s.detailLinks}>
                  <Pressable
                    disabled={busy || selected.status === "COMPLETED"}
                    onPress={() =>
                      void mutate({
                        trackId: selected.id,
                        action: "set-status",
                        status: "COMPLETED",
                      })
                    }
                    style={[
                      s.detailLink,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <SymbolView
                      name="checkmark.circle"
                      size={15}
                      tintColor={c.brand}
                    />
                    <Text style={[s.detailLinkText, { color: c.text }]}>
                      {selected.status === "COMPLETED"
                        ? "Track completed"
                        : "Mark complete"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/timeline")}
                    style={[
                      s.detailLink,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <SymbolView name="clock" size={15} tintColor={c.brand} />
                    <Text style={[s.detailLinkText, { color: c.text }]}>
                      Timeline
                    </Text>
                  </Pressable>
                </View>
                <Text style={[s.lessonHead, { color: c.text }]}>Lessons</Text>
                <ScrollView style={s.lessonList}>
                  {selected.lessons.length ? (
                    selected.lessons.map((lesson) => (
                      <Pressable
                        key={lesson.id}
                        disabled={busy}
                        onPress={() =>
                          void mutate({
                            trackId: selected.id,
                            action: "toggle-lesson",
                            lessonId: lesson.id,
                            completed: !lesson.completedAt,
                          })
                        }
                        style={[s.lesson, { borderColor: c.border }]}
                      >
                        <SymbolView
                          name={
                            lesson.completedAt
                              ? "checkmark.circle.fill"
                              : "circle"
                          }
                          size={19}
                          tintColor={
                            lesson.completedAt ? c.brand : c.textSecondary
                          }
                        />
                        <Text
                          style={[
                            s.lessonText,
                            { color: c.text },
                            lesson.completedAt && s.done,
                          ]}
                        >
                          {lesson.title}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={[s.noLessons, { color: c.textSecondary }]}>
                      No lessons added yet. Log focused sessions to keep
                      momentum.
                    </Text>
                  )}
                </ScrollView>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
      <Modal
        visible={create}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCreate(false)}
      >
        <View style={[s.modal, { backgroundColor: c.background }]}>
          <KeyboardAvoidingView
            style={s.createKeyboard}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={s.createContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={[
                s.sheet,
                s.fullSheet,
                s.createScroll,
                { backgroundColor: c.background },
              ]}
            >
              <Pressable
                onPress={() => setCreate(false)}
                style={[
                  s.back,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <SymbolView name="chevron.left" size={17} tintColor={c.text} />
              </Pressable>
              <Text style={[s.sheetTitle, { color: c.text }]}>
                Add a learning track
              </Text>
              <Text style={[s.createIntro, { color: c.textSecondary }]}>
                Start small. KASA will turn it into a focused practice space,
                not another abandoned list.
              </Text>
              <Text style={[s.fieldLabel, { color: c.textSecondary }]}>
                WHAT ARE YOU BUILDING?
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What are you learning?"
                placeholderTextColor={c.textSecondary}
                style={[
                  s.input,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
              />
              <Text style={[s.fieldLabel, { color: c.textSecondary }]}>
                FORMAT
              </Text>
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
                        backgroundColor: type === item ? c.brand : c.surface,
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
              <TextInput
                value={provider}
                onChangeText={setProvider}
                placeholder="Provider or author (optional)"
                placeholderTextColor={c.textSecondary}
                style={[
                  s.input,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
              />
              <Text style={[s.fieldLabel, { color: c.textSecondary }]}>
                WEEKLY FOCUS
              </Text>
              <View style={s.goalRow}>
                <TextInput
                  value={goal}
                  onChangeText={setGoal}
                  keyboardType="number-pad"
                  placeholder="180"
                  placeholderTextColor={c.textSecondary}
                  style={[
                    s.goalInput,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.border,
                      color: c.text,
                    },
                  ]}
                />
                <Text style={[s.goalLabel, { color: c.textSecondary }]}>
                  minutes per week
                </Text>
              </View>
              <Text style={[s.fieldLabel, { color: c.textSecondary }]}>
                YOUR RHYTHM
              </Text>
              <TextInput
                value={lessons}
                onChangeText={setLessons}
                multiline
                placeholder="Lessons, one per line (optional)"
                placeholderTextColor={c.textSecondary}
                style={[
                  s.input,
                  s.lessonsInput,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  },
                ]}
              />
              <View style={s.createBottomSpace} />
            </ScrollView>
            <View
              style={[
                s.createFooter,
                { backgroundColor: c.background, borderColor: c.border },
              ]}
            >
              <Pressable
                disabled={busy}
                onPress={() => void saveTrack()}
                style={[
                  s.primary,
                  { backgroundColor: c.brand, opacity: busy ? 0.65 : 1 },
                ]}
              >
                {busy ? (
                  <KasaSpinner size={18} color="#fff" />
                ) : (
                  <Text style={s.primaryText}>Create track</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 110 },
  kicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1.5, marginTop: 9 },
  title: { fontSize: 31, fontWeight: "900", letterSpacing: -1.3, marginTop: 7 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 330 },
  weekCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekKicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  weekNumber: {
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 4,
  },
  weekUnit: { fontSize: 12 },
  weekCopy: { fontSize: 10, marginTop: 3 },
  ring: {
    width: 47,
    height: 47,
    borderRadius: 24,
    borderWidth: 6,
    marginTop: 6,
  },
  focus: { borderRadius: 25, padding: 19, marginTop: 12 },
  focusKicker: {
    color: "rgba(255,255,255,.75)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  focusTitle: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 7 },
  focusCopy: { color: "rgba(255,255,255,.86)", fontSize: 10, marginTop: 3 },
  focusActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  studyButton: {
    height: 39,
    borderRadius: 13,
    backgroundColor: "#fff",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  studyText: { fontSize: 10, fontWeight: "900" },
  openText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 25,
    marginBottom: 10,
  },
  heading: { fontSize: 19, fontWeight: "900" },
  add: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  loader: { height: 140, alignItems: "center", justifyContent: "center" },
  track: { borderWidth: 1, borderRadius: 22, padding: 15, marginBottom: 9 },
  trackTop: { flexDirection: "row", justifyContent: "space-between" },
  trackType: { fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  trackPercent: { fontSize: 13, fontWeight: "900" },
  trackTitle: { fontSize: 17, fontWeight: "900", marginTop: 8 },
  trackMeta: { fontSize: 10, marginTop: 4 },
  bar: { height: 6, borderRadius: 6, overflow: "hidden", marginTop: 14 },
  fill: { height: 6, borderRadius: 6 },
  empty: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 27,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", marginTop: 10 },
  emptyCopy: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 4,
  },
  emptyAction: { fontSize: 10, fontWeight: "900", marginTop: 17 },
  modal: {
    flex: 1,
  },
  sheet: {
    minHeight: "55%",
    maxHeight: "84%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    paddingBottom: 30,
  },
  fullSheet: {
    flex: 1,
    maxHeight: undefined,
    minHeight: undefined,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 62,
  },
  detailContent: { paddingBottom: 44 },
  createKeyboard: { flex: 1 },
  createScroll: { flex: 1 },
  createContent: { flexGrow: 1, paddingBottom: 126 },
  createIntro: { fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 330 },
  fieldLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 23,
  },
  createBottomSpace: { height: 14 },
  createFooter: {
    flexShrink: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 17,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 5,
    alignSelf: "center",
    marginBottom: 15,
  },
  sheetTitle: { fontSize: 23, fontWeight: "900", letterSpacing: -0.8 },
  sheetMeta: { fontSize: 11, marginTop: 4 },
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 15 },
  detailLinks: { flexDirection: "row", gap: 8, marginTop: 9 },
  detailLink: {
    flex: 1,
    minHeight: 43,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  detailLinkText: { fontSize: 10, fontWeight: "900" },
  primary: {
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  primaryText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  secondary: {
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    width: 87,
  },
  secondaryText: { fontSize: 11, fontWeight: "900" },
  lessonHead: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 22,
    marginBottom: 6,
  },
  lessonList: { maxHeight: 280 },
  lesson: {
    minHeight: 54,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  lessonText: { fontSize: 12, fontWeight: "700", flex: 1 },
  done: { textDecorationLine: "line-through", opacity: 0.5 },
  noLessons: { fontSize: 11, lineHeight: 17, marginTop: 5 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    fontSize: 12,
    marginTop: 11,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 11,
  },
  goalInput: {
    height: 52,
    width: 90,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "900",
  },
  goalLabel: { fontSize: 11 },
  types: { gap: 7, marginTop: 12 },
  type: {
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: { fontSize: 8, fontWeight: "900" },
  lessonsInput: { height: 90, paddingTop: 13, textAlignVertical: "top" },
});
