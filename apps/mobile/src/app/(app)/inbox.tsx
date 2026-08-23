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
  deleteAutomationEvent,
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

const quickPrompts = [
  ["car.fill", "I bought a bike."],
  ["doc.text.fill", "I need to renew my passport."],
  ["indianrupeesign.circle.fill", "My salary arrived."],
] as const;

const voiceModes = [
  ["MIXED", "Mixed", "en-IN"],
  ["ENGLISH", "English", "en-IN"],
  ["HINDI", "Hindi", "hi-IN"],
] as const;

const localDayKey = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function offsetDay(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

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
  const [voiceMode, setVoiceMode] =
    useState<(typeof voiceModes)[number][0]>("MIXED");
  const [historyDate, setHistoryDate] = useState(() => new Date());
  const [deleteTarget, setDeleteTarget] = useState<AutomationEvent | null>(
    null,
  );
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const audioUriRef = useRef<string | null>(null);
  const liveTranscriptRef = useRef("");
  const committedTranscriptRef = useRef("");
  const shouldProcessVoiceRef = useRef(false);
  const finalizingVoiceRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

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
      const transcription = uri ? await transcribeVoice(uri) : null;
      const displayedText = transcription?.text || liveTranscript;
      const savedText = transcription?.englishText || liveTranscript;
      if (!displayedText || !savedText)
        throw new Error("KASA did not hear anything");
      // Keep the live text in the language/script the person used. Only the
      // automation record is normalized to English for consistent saving.
      setText(displayedText);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await processSignal(savedText, "VOICE");
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
      shouldProcessVoiceRef.current = true;
      setText("");
      const mode =
        voiceModes.find(([key]) => key === voiceMode) ?? voiceModes[0];
      startSpeechRecognition(mode[2]);
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
      DeviceEventEmitter.emit("kasa:calendar-updated");
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
      DeviceEventEmitter.emit("kasa:calendar-updated");
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
      DeviceEventEmitter.emit("kasa:calendar-updated");
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
  async function removeCapture(event: AutomationEvent) {
    setDeletingEventId(event.id);
    try {
      await deleteAutomationEvent(event.id);
      setEvents((items) => items.filter((item) => item.id !== event.id));
      setDeleteTarget(null);
      DeviceEventEmitter.emit("kasa:timeline-updated");
      DeviceEventEmitter.emit("kasa:calendar-updated");
      await refreshNotificationAutomation();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not delete this capture",
      );
    } finally {
      setDeletingEventId(null);
    }
  }
  const historyKey = localDayKey(historyDate);
  const todayKey = localDayKey(new Date());
  const visibleEvents = events.filter(
    (event) => localDayKey(event.createdAt) === historyKey,
  );
  const historyLabel =
    historyKey === todayKey
      ? "Today"
      : historyKey === localDayKey(offsetDay(new Date(), -1))
        ? "Yesterday"
        : new Intl.DateTimeFormat("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(historyDate);
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
          <View style={s.promptBlock}>
            <Text style={[s.promptLabel, { color: c.textSecondary }]}>
              TRY A LIFE UPDATE
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.promptRow}
            >
              {quickPrompts.map(([icon, value]) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    setText(value);
                    inputRef.current?.focus();
                  }}
                  style={[
                    s.promptChip,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <SymbolView name={icon} size={13} tintColor={c.brand} />
                  <Text style={[s.promptText, { color: c.text }]}>{value}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
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
                ref={inputRef}
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
                disabled={busy !== null}
                onPress={() => {
                  if (text.trim()) void capture();
                  else inputRef.current?.focus();
                }}
                style={[
                  s.capture,
                  { backgroundColor: c.brand, opacity: busy ? 0.72 : 1 },
                ]}
              >
                {busy ? (
                  <KasaSpinner color="#FFFFFF" size={20} />
                ) : (
                  <Text style={s.captureText}>Organize with KASA</Text>
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
          <View style={s.voiceModeRow}>
            <Text style={[s.voiceModeLabel, { color: c.textSecondary }]}>
              VOICE LANGUAGE
            </Text>
            <View style={s.voiceModeOptions}>
              {voiceModes.map(([key, label]) => {
                const selected = voiceMode === key;
                return (
                  <Pressable
                    key={key}
                    disabled={isListening || busy !== null}
                    onPress={() => setVoiceMode(key)}
                    style={[
                      s.voiceModeOption,
                      {
                        backgroundColor: selected ? c.brandSoft : c.surface,
                        borderColor: selected ? c.brand : c.border,
                        opacity: isListening || busy ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.voiceModeText,
                        { color: selected ? c.brand : c.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View
            style={[
              s.actionPromise,
              { backgroundColor: c.brandSoft, borderColor: c.border },
            ]}
          >
            <SymbolView name="sparkles" size={16} tintColor={c.brand} />
            <Text style={[s.actionPromiseText, { color: c.text }]}>
              One update can create reminders, timeline moments, records and
              finance context.
            </Text>
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
            <View>
              <Text style={[s.recentTitle, { color: c.text }]}>Captures</Text>
              <Text style={[s.historyHint, { color: c.textSecondary }]}>
                Only this day
              </Text>
            </View>
            <View style={s.historyControls}>
              <Pressable
                accessibilityLabel="Previous capture date"
                onPress={() => setHistoryDate((day) => offsetDay(day, -1))}
                style={[
                  s.historyButton,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <SymbolView name="chevron.left" size={12} tintColor={c.text} />
              </Pressable>
              <Pressable
                onPress={() => setHistoryDate(new Date())}
                style={[s.historyLabel, { backgroundColor: c.brandSoft }]}
              >
                <Text style={[s.historyText, { color: c.brand }]}>
                  {historyLabel}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Next capture date"
                disabled={historyKey === todayKey}
                onPress={() => setHistoryDate((day) => offsetDay(day, 1))}
                style={[
                  s.historyButton,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    opacity: historyKey === todayKey ? 0.35 : 1,
                  },
                ]}
              >
                <SymbolView name="chevron.right" size={12} tintColor={c.text} />
              </Pressable>
            </View>
          </View>
          {visibleEvents.length === 0 ? (
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
                No captures were saved on {historyLabel.toLowerCase()}.
              </Text>
            </View>
          ) : (
            visibleEvents.map((event) => (
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
                  <View style={s.captureTop}>
                    <Text
                      numberOfLines={2}
                      style={[s.itemText, { color: c.text }]}
                    >
                      {event.summary || event.rawText}
                    </Text>
                    <Pressable
                      accessibilityLabel="Delete capture"
                      onPress={() => setDeleteTarget(event)}
                      style={[
                        s.deleteCapture,
                        { backgroundColor: c.backgroundElement },
                      ]}
                    >
                      <SymbolView
                        name="trash"
                        size={13}
                        tintColor={c.textSecondary}
                      />
                    </Pressable>
                  </View>
                  <Text style={[s.itemMeta, { color: c.brand }]}>
                    {event.source.replaceAll("_", " ")} ·{" "}
                    {event.status === "ACTIONED"
                      ? "ORGANIZED"
                      : event.status.replaceAll("_", " ")}
                  </Text>
                  {event.actions.some(
                    (action) =>
                      action.requiresReview &&
                      (action.status === "PROPOSED" ||
                        action.status === "NEEDS_REVIEW"),
                  ) && (
                    <View style={s.actionList}>
                      {event.actions
                        .filter(
                          (action) =>
                            action.requiresReview &&
                            (action.status === "PROPOSED" ||
                              action.status === "NEEDS_REVIEW"),
                        )
                        .map((action) => (
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
                                {action.type.replaceAll("_", " ")}
                              </Text>
                            </View>
                            {action.requiresReview && (
                              <View style={s.reviewButtons}>
                                <Pressable
                                  onPress={() =>
                                    void decide(action.id, "reject")
                                  }
                                  style={s.rejectButton}
                                >
                                  <SymbolView
                                    name="xmark"
                                    size={11}
                                    tintColor={c.textSecondary}
                                  />
                                </Pressable>
                                <Pressable
                                  onPress={() =>
                                    void decide(action.id, "approve")
                                  }
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
                  )}
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
      <Modal
        animationType="fade"
        transparent
        visible={deleteTarget !== null}
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={s.deleteOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !deletingEventId && setDeleteTarget(null)}
          />
          {deleteTarget ? (
            <View
              style={[
                s.deleteDialog,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <View style={[s.deleteIcon, { backgroundColor: c.brandSoft }]}>
                <SymbolView name="trash.fill" size={19} tintColor={c.brand} />
              </View>
              <Text style={[s.deleteTitle, { color: c.text }]}>
                Delete this capture?
              </Text>
              <Text style={[s.deleteMessage, { color: c.textSecondary }]}>
                Its task, reminder, calendar plan and other results will also be
                removed.
              </Text>
              <View style={s.deleteActions}>
                <Pressable
                  disabled={Boolean(deletingEventId)}
                  onPress={() => setDeleteTarget(null)}
                  style={[
                    s.keepButton,
                    { backgroundColor: c.backgroundElement },
                  ]}
                >
                  <Text style={[s.keepText, { color: c.text }]}>Keep it</Text>
                </Pressable>
                <Pressable
                  disabled={Boolean(deletingEventId)}
                  onPress={() => void removeCapture(deleteTarget)}
                  style={[s.removeButton, { backgroundColor: c.brand }]}
                >
                  {deletingEventId ? (
                    <KasaSpinner color="#FFFFFF" size={17} />
                  ) : (
                    <>
                      <SymbolView
                        name="trash.fill"
                        size={14}
                        tintColor="#FFFFFF"
                      />
                      <Text style={s.removeText}>Delete</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
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
  promptBlock: { marginTop: 20 },
  promptLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.25,
    marginBottom: 9,
  },
  promptRow: { gap: 8, paddingRight: 20 },
  promptChip: {
    height: 35,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promptText: { fontSize: 10, fontWeight: "800" },
  composer: { borderWidth: 1.5, borderRadius: 28, padding: 16, marginTop: 15 },
  input: {
    minHeight: 108,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: "top",
  },
  liveTranscriptBox: {
    minHeight: 108,
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
  voiceModeRow: { marginTop: 14 },
  voiceModeLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  voiceModeOptions: { flexDirection: "row", gap: 7 },
  voiceModeOption: {
    height: 33,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceModeText: { fontSize: 10, fontWeight: "900" },
  actionPromise: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 13,
  },
  actionPromiseText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
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
  historyHint: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  historyControls: { alignItems: "center", flexDirection: "row", gap: 5 },
  historyButton: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  historyLabel: {
    alignItems: "center",
    borderRadius: 11,
    height: 32,
    justifyContent: "center",
    minWidth: 58,
    paddingHorizontal: 8,
  },
  historyText: { fontSize: 10, fontWeight: "900" },
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
  itemText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  captureTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  deleteCapture: {
    alignItems: "center",
    borderRadius: 11,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
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
  deleteOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(10, 4, 2, 0.62)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  deleteDialog: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: 360,
    padding: 24,
    width: "100%",
  },
  deleteIcon: {
    alignItems: "center",
    borderRadius: 20,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  deleteTitle: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 16,
  },
  deleteMessage: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
  },
  deleteActions: { flexDirection: "row", gap: 9, marginTop: 22, width: "100%" },
  keepButton: {
    alignItems: "center",
    borderRadius: 15,
    flex: 1,
    height: 48,
    justifyContent: "center",
  },
  keepText: { fontSize: 13, fontWeight: "800" },
  removeButton: {
    alignItems: "center",
    borderRadius: 15,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    height: 48,
    justifyContent: "center",
  },
  removeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
