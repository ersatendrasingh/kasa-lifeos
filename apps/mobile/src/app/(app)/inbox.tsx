import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Linking,
  Modal,
  Platform,
  Pressable,
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
  createAutomationSignal,
  decideAutomationAction,
  listAutomationEvents,
  listAutomationAttachments,
  scanAutomationFile,
  transcribeVoice,
  type AutomationEvent,
  type AutomationAttachment,
} from "@/lib/automation";
import {
  NOTIFICATION_CHANGED_EVENT,
  syncLocalNotifications,
} from "@/lib/notifications";

async function refreshNotificationAutomation() {
  await syncLocalNotifications().catch(() => undefined);
  DeviceEventEmitter.emit(NOTIFICATION_CHANGED_EVENT);
}

function recordingTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const categories = [
  ["✓", "Task"],
  ["◷", "Reminder"],
  ["✦", "Idea"],
  ["₹", "Expense"],
  ["▣", "Shopping"],
  ["☆", "Wish"],
];

export default function SmartInboxScreen() {
  const c = useTheme();
  const [text, setText] = useState("");
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [attachments, setAttachments] = useState<AutomationAttachment[]>([]);
  const [preview, setPreview] = useState<AutomationAttachment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [listeningSeconds, setListeningSeconds] = useState(0);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const audioUriRef = useRef<string | null>(null);
  const liveTranscriptRef = useRef("");
  const committedTranscriptRef = useRef("");
  const speechLocaleRef = useRef<"hi-IN" | "en-IN">("hi-IN");
  const shouldProcessVoiceRef = useRef(false);
  const finalizingVoiceRef = useRef(false);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setListeningSeconds(0);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const incoming = event.results
      .map((result) => result.transcript)
      .filter(Boolean)
      .join(" ");
    if (!incoming.trim()) return;

    const committed = committedTranscriptRef.current;
    const transcript = incoming.startsWith(" ")
      ? `${committed}${incoming}`.trim()
      : incoming.trim();

    liveTranscriptRef.current = transcript;
    if (event.isFinal) committedTranscriptRef.current = transcript;
    setText(transcript);
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    audioUriRef.current = event.uri;
  });

  useSpeechRecognitionEvent("volumechange", (event) => {
    setVoiceLevel(Math.max(0, Math.min(1, (event.value + 2) / 12)));
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    if (shouldProcessVoiceRef.current) void finalizeVoiceCapture();
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (event.error === "aborted") return;
    if (
      event.error === "language-not-supported" &&
      speechLocaleRef.current === "hi-IN" &&
      shouldProcessVoiceRef.current
    ) {
      speechLocaleRef.current = "en-IN";
      setText("");
      setError(null);
      setTimeout(() => startSpeechRecognition("en-IN"), 250);
      return;
    }
    shouldProcessVoiceRef.current = false;
    setIsListening(false);
    setBusy(null);
    setError(
      event.error === "no-speech" || event.error === "speech-timeout"
        ? "KASA did not hear anything. Tap the mic and try again."
        : event.message || "KASA could not listen right now",
    );
  });

  useEffect(() => {
    let active = true;
    Promise.all([listAutomationEvents(), listAutomationAttachments()])
      .then(([eventItems, attachmentItems]) => {
        if (active) {
          setEvents(eventItems);
          setAttachments(attachmentItems);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isListening) return;
    const timer = setInterval(
      () => setListeningSeconds((seconds) => seconds + 1),
      1_000,
    );
    return () => clearInterval(timer);
  }, [isListening]);

  async function normalizePhoto(uri: string) {
    return manipulateAsync(uri, [], {
      compress: 0.9,
      format: SaveFormat.JPEG,
    });
  }

  async function refreshAttachments() {
    const items = await listAutomationAttachments();
    setAttachments(items);
  }

  async function finalizeVoiceCapture() {
    if (finalizingVoiceRef.current || !shouldProcessVoiceRef.current) return;
    finalizingVoiceRef.current = true;
    shouldProcessVoiceRef.current = false;
    try {
      setError(null);
      setBusy("Perfecting your words…");
      const liveTranscript = liveTranscriptRef.current.trim();
      const uri = audioUriRef.current;
      const transcript = uri ? await transcribeVoice(uri) : liveTranscript;
      if (!transcript) throw new Error("KASA did not hear anything");
      setText(transcript);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      await processSignal(transcript, "VOICE");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Voice transcription failed",
      );
    } finally {
      finalizingVoiceRef.current = false;
      setBusy(null);
    }
  }

  function startSpeechRecognition(locale: "hi-IN" | "en-IN") {
    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      iosTaskHint: "dictation",
      requiresOnDeviceRecognition:
        Platform.OS === "ios" &&
        ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      contextualStrings: [
        "KASA",
        "Aadhaar",
        "PAN",
        "FASTag",
        "SIP",
        "EMI",
        "passport",
        "insurance",
        "reminder",
      ],
      recordingOptions: ExpoSpeechRecognitionModule.supportsRecording()
        ? {
            persist: true,
            outputSampleRate: 16_000,
            outputEncoding: "pcmFormatInt16",
          }
        : undefined,
    });
  }

  async function toggleVoice() {
    if (isListening) {
      setBusy("Finishing your thought…");
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      setError(null);
      let permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      const requestedPermission = !permission.granted;
      if (!permission.granted && permission.canAskAgain) {
        permission =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      }
      if (!permission.granted) {
        Alert.alert(
          "Voice access needed",
          "Allow microphone and speech recognition access so KASA can show your words live.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => void Linking.openSettings(),
            },
          ],
        );
        return;
      }
      if (requestedPermission && Platform.OS === "ios") {
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
      audioUriRef.current = null;
      liveTranscriptRef.current = "";
      committedTranscriptRef.current = "";
      speechLocaleRef.current = "hi-IN";
      shouldProcessVoiceRef.current = true;
      setText("");
      startSpeechRecognition("hi-IN");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (cause) {
      shouldProcessVoiceRef.current = false;
      setError(
        cause instanceof Error
          ? cause.message
          : "KASA could not start listening",
      );
    }
  }
  async function processSignal(
    rawValue: string,
    source: "MANUAL_TEXT" | "VOICE" = "MANUAL_TEXT",
  ) {
    const value = rawValue.trim();
    if (!value) return;
    setBusy(
      source === "VOICE"
        ? "KASA is organizing what you said…"
        : "KASA is understanding the next step…",
    );
    setError(null);
    try {
      const event = await createAutomationSignal(value, source);
      setEvents((items) => [
        event,
        ...items.filter((item) => item.id !== event.id),
      ]);
      DeviceEventEmitter.emit("kasa:timeline-updated");
      await refreshNotificationAutomation();
      setText("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "KASA could not process this",
      );
    } finally {
      setBusy(null);
    }
  }

  async function capture() {
    await processSignal(text, "MANUAL_TEXT");
  }

  async function scanCamera() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Camera needed",
          "Allow camera access to scan receipts and documents.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.82,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      setBusy("Preparing your scan…");
      const normalized = await normalizePhoto(asset.uri);
      await scanFile({
        uri: normalized.uri,
        name: "kasa-camera-scan.jpg",
        mimeType: "image/jpeg",
        source: "CAMERA",
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Camera could not be opened",
      );
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    if (asset.mimeType?.startsWith("image/")) {
      setBusy("Preparing your photo…");
      const normalized = await normalizePhoto(asset.uri);
      await scanFile({
        uri: normalized.uri,
        name: asset.name.replace(/\.[^.]+$/, "") + ".jpg",
        mimeType: "image/jpeg",
        source: "DOCUMENT",
      });
      return;
    }
    await scanFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/pdf",
      source: "DOCUMENT",
    });
  }

  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      setBusy("Preparing your photo…");
      const normalized = await normalizePhoto(asset.uri);
      await scanFile({
        uri: normalized.uri,
        name:
          (asset.fileName?.replace(/\.[^.]+$/, "") ?? "kasa-photo") + ".jpg",
        mimeType: "image/jpeg",
        source: "DOCUMENT",
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Photo could not be opened",
      );
    }
  }

  async function scanFile(input: Parameters<typeof scanAutomationFile>[0]) {
    setBusy(
      input.source === "CAMERA"
        ? "Reading your scan…"
        : "Reading your document…",
    );
    setError(null);
    try {
      const event = await scanAutomationFile(input);
      setEvents((items) => [
        event,
        ...items.filter((item) => item.id !== event.id),
      ]);
      DeviceEventEmitter.emit("kasa:timeline-updated");
      await refreshNotificationAutomation();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "KASA could not read this file",
      );
    } finally {
      await refreshAttachments().catch(() => undefined);
      setBusy(null);
    }
  }

  async function decide(actionId: string, decision: "approve" | "reject") {
    setBusy(
      decision === "approve" ? "Applying action…" : "Removing suggestion…",
    );
    try {
      await decideAutomationAction(actionId, decision);
      DeviceEventEmitter.emit("kasa:timeline-updated");
      await refreshNotificationAutomation();
      setEvents((items) =>
        items.map((event) => ({
          ...event,
          actions: event.actions.map((action) =>
            action.id === actionId
              ? {
                  ...action,
                  status: decision === "approve" ? "EXECUTED" : "REJECTED",
                  requiresReview: false,
                }
              : action,
          ),
        })),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update action",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <CosmicBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader label="Smart Capture" />
          <View style={s.titleRow}>
            <Text style={[s.title, { color: c.text }]}>Tell KASA once.</Text>
            <View style={[s.aiBadge, { backgroundColor: c.brandSoft }]}>
              <Text style={[s.aiText, { color: c.brand }]}>✦ AI</Text>
            </View>
          </View>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            Speak or type naturally. KASA understands the intent, organizes it,
            and handles the next step.
          </Text>
          <View
            style={[
              s.composer,
              {
                backgroundColor: c.surface,
                borderColor: isListening ? c.brand : c.border,
              },
            ]}
          >
            {isListening ? (
              <View style={s.liveTranscriptBox}>
                <Text
                  style={[
                    s.liveTranscript,
                    { color: text ? c.text : c.textSecondary },
                  ]}
                >
                  {text || "Listening… start speaking"}
                </Text>
                <View style={s.waveform}>
                  {[0.45, 0.72, 1, 0.62, 0.84].map((weight, index) => (
                    <View
                      key={index}
                      style={[
                        s.waveBar,
                        {
                          backgroundColor: c.brand,
                          height: 5 + Math.max(voiceLevel, 0.12) * weight * 22,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                placeholder="Remind me to renew my car insurance next Friday at 7 PM…"
                placeholderTextColor={c.textSecondary}
                style={[s.input, { color: c.text }]}
              />
            )}
            <View style={s.actions}>
              <Pressable
                disabled={busy !== null}
                onPress={toggleVoice}
                style={[
                  s.mic,
                  {
                    backgroundColor: isListening ? c.brand : c.brandSoft,
                  },
                ]}
              >
                <SymbolView
                  name={isListening ? "stop.fill" : "mic.fill"}
                  size={19}
                  tintColor={isListening ? "#FFFFFF" : c.brand}
                />
              </Pressable>
              <Pressable
                disabled={busy !== null || !text.trim()}
                onPress={() => void capture()}
                style={[
                  s.capture,
                  { backgroundColor: c.brand, opacity: !text.trim() ? 0.5 : 1 },
                ]}
              >
                {busy ? (
                  <KasaSpinner color="#FFFFFF" size={20} />
                ) : (
                  <Text style={s.captureText}>Organize with KASA →</Text>
                )}
              </Pressable>
            </View>
            {isListening && (
              <View style={s.listening}>
                <View style={[s.liveDot, { backgroundColor: c.brand }]} />
                <Text style={[s.listeningText, { color: c.brand }]}>
                  Live transcript · {recordingTime(listeningSeconds)} · Speak
                  naturally, then tap stop
                </Text>
              </View>
            )}
          </View>
          {busy && <Text style={[s.busyText, { color: c.brand }]}>{busy}</Text>}
          {error && (
            <View style={[s.error, { backgroundColor: c.brandSoft }]}>
              <Text style={[s.errorText, { color: c.brand }]}>{error}</Text>
            </View>
          )}
          <View style={s.sourceRow}>
            <Pressable
              disabled={busy !== null}
              onPress={() => void scanCamera()}
              style={[
                s.sourceButton,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="camera.fill" size={17} tintColor={c.brand} />
              <Text style={[s.sourceText, { color: c.text }]}>Scan</Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() => void pickDocument()}
              style={[
                s.sourceButton,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="doc.fill" size={16} tintColor={c.brand} />
              <Text style={[s.sourceText, { color: c.text }]}>Any file</Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() => void pickPhoto()}
              style={[
                s.sourceButton,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <SymbolView name="photo.fill" size={16} tintColor={c.brand} />
              <Text style={[s.sourceText, { color: c.text }]}>Photos</Text>
            </Pressable>
          </View>
          <Text style={[s.label, { color: c.textSecondary }]}>
            KASA CAN ORGANIZE IT AS
          </Text>
          <View style={s.categoryGrid}>
            {categories.map(([icon, label]) => (
              <View
                key={label}
                style={[
                  s.category,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Text style={[s.categoryIcon, { color: c.brand }]}>{icon}</Text>
                <Text style={[s.categoryLabel, { color: c.text }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
          {attachments.length > 0 && (
            <>
              <View style={s.recentHead}>
                <Text style={[s.recentTitle, { color: c.text }]}>
                  Your uploads
                </Text>
                <Text style={[s.private, { color: c.textSecondary }]}>
                  Private · S3
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.uploadRow}
              >
                {attachments.map((attachment) => (
                  <Pressable
                    key={attachment.id}
                    onPress={() => {
                      if (attachment.kind === "IMAGE") setPreview(attachment);
                      else void Linking.openURL(attachment.previewUrl);
                    }}
                    style={[
                      s.uploadCard,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    {attachment.kind === "IMAGE" ? (
                      <Image
                        alt={attachment.originalFileName}
                        source={attachment.previewUrl}
                        contentFit="cover"
                        style={s.uploadImage}
                      />
                    ) : (
                      <View
                        style={[
                          s.uploadDocument,
                          { backgroundColor: c.brandSoft },
                        ]}
                      >
                        <SymbolView
                          name="doc.fill"
                          size={26}
                          tintColor={c.brand}
                        />
                      </View>
                    )}
                    <Text
                      numberOfLines={1}
                      style={[s.uploadName, { color: c.text }]}
                    >
                      {attachment.originalFileName}
                    </Text>
                    <Text
                      style={[
                        s.uploadMeta,
                        { color: attachment.eventId ? c.positive : c.warning },
                      ]}
                    >
                      {attachment.eventId
                        ? "✓ AI processed"
                        : "Stored · needs retry"}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
          <View style={s.recentHead}>
            <Text style={[s.recentTitle, { color: c.text }]}>
              Recent captures
            </Text>
            <Text style={[s.private, { color: c.textSecondary }]}>
              ⌾ Private
            </Text>
          </View>
          {events.length === 0 ? (
            <View
              style={[
                s.empty,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[s.emptyTitle, { color: c.text }]}>
                Your mind is clear
              </Text>
              <Text style={[s.emptyText, { color: c.textSecondary }]}>
                Your captured thoughts will appear here.
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <View
                key={event.id}
                style={[
                  s.item,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View style={[s.itemIcon, { backgroundColor: c.brandSoft }]}>
                  <Text style={{ color: c.brand }}>✦</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={2}
                    style={[s.itemText, { color: c.text }]}
                  >
                    {event.summary || event.rawText}
                  </Text>
                  <Text style={[s.itemMeta, { color: c.brand }]}>
                    {event.source.replaceAll("_", " ")} ·{" "}
                    {event.status.replaceAll("_", " ")}
                  </Text>
                  <View style={s.actionList}>
                    {event.actions.map((action) => (
                      <View
                        key={action.id}
                        style={[
                          s.actionCard,
                          { backgroundColor: c.backgroundElement },
                        ]}
                      >
                        <View style={s.actionCopy}>
                          <Text style={[s.actionTitle, { color: c.text }]}>
                            {action.title}
                          </Text>
                          <Text
                            style={[
                              s.actionStatus,
                              {
                                color:
                                  action.status === "EXECUTED"
                                    ? c.positive
                                    : c.textSecondary,
                              },
                            ]}
                          >
                            {action.status === "EXECUTED"
                              ? "✓ DONE"
                              : action.type.replaceAll("_", " ")}
                          </Text>
                        </View>
                        {action.requiresReview && (
                          <View style={s.reviewButtons}>
                            <Pressable
                              onPress={() => void decide(action.id, "reject")}
                              style={s.rejectButton}
                            >
                              <SymbolView
                                name="xmark"
                                size={11}
                                tintColor={c.textSecondary}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => void decide(action.id, "approve")}
                              style={[
                                s.approveButton,
                                { backgroundColor: c.brand },
                              ]}
                            >
                              <SymbolView
                                name="checkmark"
                                size={12}
                                tintColor="#FFFFFF"
                              />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
      <Modal
        animationType="fade"
        transparent
        visible={preview !== null}
        onRequestClose={() => setPreview(null)}
      >
        <View style={s.previewScreen}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPreview(null)}
          />
          {preview && (
            <Image
              alt={preview.originalFileName}
              source={preview.previewUrl}
              contentFit="contain"
              style={s.previewImage}
            />
          )}
          <Pressable
            accessibilityLabel="Close preview"
            onPress={() => setPreview(null)}
            style={s.previewClose}
          >
            <SymbolView name="xmark" size={16} tintColor="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 120 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  aiBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  aiText: { fontSize: 11, fontWeight: "800" },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  composer: { borderWidth: 1.5, borderRadius: 28, padding: 16, marginTop: 24 },
  input: {
    minHeight: 128,
    fontSize: 17,
    lineHeight: 25,
    textAlignVertical: "top",
  },
  liveTranscriptBox: {
    minHeight: 128,
    justifyContent: "space-between",
  },
  liveTranscript: { fontSize: 19, lineHeight: 28, fontWeight: "600" },
  waveform: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  waveBar: { width: 3, borderRadius: 3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  mic: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  capture: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  captureText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  listening: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
  },
  liveDot: { width: 7, height: 7, borderRadius: 7 },
  listeningText: { fontSize: 11, fontWeight: "700" },
  busyText: { fontSize: 11, fontWeight: "800", marginTop: 10, marginLeft: 4 },
  error: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  errorText: { fontSize: 11, fontWeight: "700", lineHeight: 16 },
  sourceRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  sourceButton: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  sourceText: { fontSize: 10, fontWeight: "800" },
  label: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.25,
    marginTop: 28,
    marginBottom: 12,
  },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  category: { width: "31%", borderWidth: 1, borderRadius: 18, padding: 13 },
  categoryIcon: { fontSize: 18, fontWeight: "800" },
  categoryLabel: { fontSize: 11, fontWeight: "700", marginTop: 8 },
  uploadRow: { gap: 10, paddingRight: 8 },
  uploadCard: { width: 150, borderRadius: 20, borderWidth: 1, padding: 8 },
  uploadImage: { width: "100%", height: 100, borderRadius: 14 },
  uploadDocument: {
    width: "100%",
    height: 100,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadName: { fontSize: 10, fontWeight: "800", marginTop: 8 },
  uploadMeta: { fontSize: 8, fontWeight: "800", marginTop: 4, marginBottom: 3 },
  previewScreen: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: { width: "100%", height: "78%" },
  previewClose: {
    position: "absolute",
    top: 58,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 12,
  },
  recentTitle: { fontSize: 20, fontWeight: "800" },
  private: { fontSize: 11 },
  empty: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  emptyText: { fontSize: 12, marginTop: 6 },
  item: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    marginBottom: 9,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  itemMeta: { fontSize: 8, fontWeight: "800", letterSpacing: 1, marginTop: 5 },
  actionList: { gap: 7, marginTop: 10 },
  actionCard: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionCopy: { flex: 1 },
  actionTitle: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  actionStatus: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 3,
  },
  reviewButtons: { flexDirection: "row", gap: 6 },
  rejectButton: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  approveButton: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
