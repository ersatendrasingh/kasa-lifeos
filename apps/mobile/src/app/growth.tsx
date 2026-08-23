import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { CosmicBackground } from "@/components/cosmic-background";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { createMission, listMissions, type Mission } from "@/lib/missions";

const tabs = ["Missions", "Learning", "Skills", "Progress", "Wins"] as const;
const categories = ["Career", "Financial", "Health", "Learning", "Personal", "Travel", "Family", "Business"];

function completion(mission: Mission) {
  if (mission.targetValue && mission.targetValue > 0) return Math.min(100, Math.round(((mission.currentValue ?? 0) / mission.targetValue) * 100));
  if (mission.milestones.length) return Math.round((mission.milestones.filter((item) => item.completedAt).length / mission.milestones.length) * 100);
  return 0;
}

export default function GrowthScreen() {
  const c = useTheme();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Missions");
  const [createVisible, setCreateVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Career");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try { setMissions(await listMissions()); }
    catch { if (!silent) Alert.alert("Growth is unavailable", "Your missions could not be loaded. Pull down to try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const overview = useMemo(() => {
    const average = missions.length ? Math.round(missions.reduce((sum, mission) => sum + completion(mission), 0) / missions.length) : 0;
    const milestones = missions.reduce((sum, mission) => sum + mission.milestones.length, 0);
    return { average, milestones };
  }, [missions]);

  async function saveMission() {
    if (title.trim().length < 2) { Alert.alert("Add a mission name", "For example: Build LifeOS or Run a half marathon."); return; }
    setSaving(true);
    try {
      const mission = await createMission({ title: title.trim(), category, description: description.trim() || undefined, milestones: [] });
      setMissions((current) => [mission, ...current]);
      setCreateVisible(false); setTitle(""); setDescription(""); setCategory("Career");
    } catch (cause) { Alert.alert("Could not create mission", cause instanceof Error ? cause.message : "Please try again."); }
    finally { setSaving(false); }
  }

  return <View style={[s.screen, { backgroundColor: c.background }]}>
    <CosmicBackground />
    <SafeAreaView edges={["top"]} style={s.safe}>
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.brand} />} showsVerticalScrollIndicator={false}>
        <AppHeader label="Growth" />
        <Text style={[s.eyebrow, { color: c.brand }]}>ACTIVE MISSIONS</Text>
        <Text style={[s.title, { color: c.text }]}>Grow with direction.</Text>
        <Text style={[s.subtitle, { color: c.textSecondary }]}>Turn the things that matter into steady, visible progress.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {tabs.map((tab) => { const active = activeTab === tab; return <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[s.tab, { backgroundColor: active ? c.brand : c.surface, borderColor: active ? c.brand : c.border }]}><Text style={[s.tabText, { color: active ? "#fff" : c.textSecondary }]}>{tab}</Text></Pressable>; })}
        </ScrollView>
        {activeTab === "Missions" ? <>
          <View style={[s.hero, { backgroundColor: c.brand }]}>
            <Text style={s.heroKicker}>YOUR FORWARD MOTION</Text><Text style={s.heroNumber}>{overview.average}%</Text>
            <Text style={s.heroCopy}>{missions.length ? `${missions.length} active missions, ${overview.milestones} planned milestones.` : "One clear mission can change your next chapter."}</Text>
            <View style={s.heroTrack}><View style={[s.heroFill, { width: `${overview.average}%` }]} /></View>
          </View>
          <Pressable onPress={() => setCreateVisible(true)} style={[s.createButton, { backgroundColor: c.brand }]}><SymbolView name="flag.checkered" size={15} tintColor="#fff" /><Text style={s.createText}>Start a mission</Text></Pressable>
          <View style={s.sectionHead}><Text style={[s.heading, { color: c.text }]}>Your missions</Text><Text style={[s.count, { color: c.brand }]}>{missions.length} ACTIVE</Text></View>
          {loading ? <View style={s.loader}><KasaSpinner size={28} /></View> : missions.length ? missions.map((mission) => {
            const percent = completion(mission); const completeMilestones = mission.milestones.filter((item) => item.completedAt).length;
            return <Pressable key={mission.id} onPress={() => router.push({ pathname: "/life", params: { missionId: mission.id } })} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={s.cardTop}><Text style={[s.category, { color: c.brand }]}>{mission.category.toUpperCase()}</Text><Text style={[s.percent, { color: c.text }]}>{percent}%</Text></View>
              <Text style={[s.missionTitle, { color: c.text }]}>{mission.title}</Text><Text numberOfLines={1} style={[s.missionDetail, { color: c.textSecondary }]}>{mission.description || (mission.milestones.length ? `${completeMilestones} of ${mission.milestones.length} milestones complete` : "Add milestones and connect your work")}</Text>
              <View style={[s.track, { backgroundColor: c.backgroundElement }]}><View style={[s.fill, { backgroundColor: c.brand, width: `${percent}%` }]} /></View>
            </Pressable>;
          }) : <EmptyState color={c.brand} text={c.text} muted={c.textSecondary} surface={c.surface} border={c.border} onStart={() => setCreateVisible(true)} />}
        </> : <ComingSoon tab={activeTab} color={c.brand} text={c.text} muted={c.textSecondary} surface={c.surface} border={c.border} />}
      </ScrollView>
    </SafeAreaView>
    <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
      <View style={s.modal}><Pressable style={StyleSheet.absoluteFill} onPress={() => !saving && setCreateVisible(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}><View style={[s.sheet, { backgroundColor: c.background }]}>
          <View style={[s.handle, { backgroundColor: c.border }]} /><Text style={[s.sheetTitle, { color: c.text }]}>Start a mission</Text><Text style={[s.sheetCopy, { color: c.textSecondary }]}>Give the bigger thing a name. You can add milestones next.</Text>
          <TextInput autoFocus value={title} onChangeText={setTitle} placeholder="e.g. Become Full Stack Architect" placeholderTextColor={c.textSecondary} style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} />
          <TextInput value={description} onChangeText={setDescription} placeholder="Why this matters (optional)" placeholderTextColor={c.textSecondary} style={[s.input, s.description, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} multiline />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[s.chip, { backgroundColor: category === item ? c.brand : c.surface, borderColor: category === item ? c.brand : c.border }]}><Text style={[s.chipText, { color: category === item ? "#fff" : c.textSecondary }]}>{item}</Text></Pressable>)}</ScrollView>
          <Pressable disabled={saving} onPress={() => void saveMission()} style={[s.createButton, { backgroundColor: c.brand, opacity: saving ? .65 : 1 }]}>{saving ? <KasaSpinner size={18} color="#fff" /> : <Text style={s.createText}>Create mission</Text>}</Pressable>
        </View></KeyboardAvoidingView>
      </View>
    </Modal>
  </View>;
}

function EmptyState({ color, text, muted, surface, border, onStart }: { color: string; text: string; muted: string; surface: string; border: string; onStart: () => void }) { return <View style={[s.empty, { backgroundColor: surface, borderColor: border }]}><SymbolView name="flag.checkered" size={28} tintColor={color} /><Text style={[s.emptyTitle, { color: text }]}>Start with one real mission</Text><Text style={[s.emptyCopy, { color: muted }]}>Career switch, fitness, buying a home—or the work you want to be known for.</Text><Pressable onPress={onStart}><Text style={[s.emptyAction, { color }]}>Create your first mission →</Text></Pressable></View>; }
function ComingSoon({ tab, color, text, muted, surface, border }: { tab: string; color: string; text: string; muted: string; surface: string; border: string }) { return <View style={[s.empty, { backgroundColor: surface, borderColor: border }]}><SymbolView name="sparkles" size={28} tintColor={color} /><Text style={[s.emptyTitle, { color: text }]}>{tab}, connected soon</Text><Text style={[s.emptyCopy, { color: muted }]}>This view will turn your missions into a living record of learning, skills and meaningful wins.</Text></View>; }

const s = StyleSheet.create({
  screen: { flex: 1 }, safe: { flex: 1 }, content: { padding: 20, paddingTop: 8, paddingBottom: 112 }, eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 1.4, marginTop: 20 }, title: { fontSize: 31, fontWeight: "900", letterSpacing: -1.3, marginTop: 8 }, subtitle: { fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 310 }, tabs: { gap: 8, marginTop: 18 }, tab: { height: 36, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }, tabText: { fontSize: 9, fontWeight: "900" }, hero: { marginTop: 15, borderRadius: 27, padding: 20, overflow: "hidden" }, heroKicker: { color: "rgba(255,255,255,.78)", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 }, heroNumber: { color: "#fff", fontSize: 47, fontWeight: "900", letterSpacing: -2, marginTop: 4 }, heroCopy: { color: "rgba(255,255,255,.88)", fontSize: 11, marginTop: 2 }, heroTrack: { backgroundColor: "rgba(255,255,255,.25)", height: 7, borderRadius: 9, overflow: "hidden", marginTop: 17 }, heroFill: { height: 7, borderRadius: 9, backgroundColor: "#fff" }, createButton: { height: 53, borderRadius: 19, marginTop: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, createText: { color: "#fff", fontSize: 12, fontWeight: "900" }, sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 25, marginBottom: 10 }, heading: { fontSize: 19, fontWeight: "900", letterSpacing: -.5 }, count: { fontSize: 8, fontWeight: "900", letterSpacing: 1 }, loader: { height: 120, justifyContent: "center", alignItems: "center" }, card: { borderWidth: 1, borderRadius: 24, padding: 16, marginBottom: 9 }, cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, category: { fontSize: 8, fontWeight: "900", letterSpacing: 1.1 }, percent: { fontSize: 13, fontWeight: "900" }, missionTitle: { fontSize: 17, fontWeight: "900", letterSpacing: -.3, marginTop: 8 }, missionDetail: { fontSize: 10, marginTop: 4 }, track: { height: 6, borderRadius: 6, overflow: "hidden", marginTop: 14 }, fill: { height: 6, borderRadius: 6 }, empty: { borderWidth: 1, borderRadius: 27, padding: 27, alignItems: "center" }, emptyTitle: { fontSize: 16, fontWeight: "900", marginTop: 10 }, emptyCopy: { fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 5, maxWidth: 285 }, emptyAction: { fontSize: 10, fontWeight: "900", marginTop: 17 }, modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,5,3,.58)" }, sheet: { borderTopLeftRadius: 33, borderTopRightRadius: 33, padding: 20, paddingBottom: 32 }, handle: { width: 42, height: 4, borderRadius: 5, alignSelf: "center", marginBottom: 17 }, sheetTitle: { fontSize: 23, fontWeight: "900", letterSpacing: -.7 }, sheetCopy: { fontSize: 11, marginTop: 4 }, input: { height: 54, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, fontSize: 13, marginTop: 15 }, description: { height: 68, paddingTop: 14, textAlignVertical: "top" }, chips: { gap: 7, marginTop: 12 }, chip: { height: 33, borderRadius: 12, borderWidth: 1, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" }, chipText: { fontSize: 8, fontWeight: "900" },
});
