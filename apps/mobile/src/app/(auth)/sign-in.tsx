import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
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

import { useTheme } from "@/hooks/use-theme";
import { KasaSpinner } from "@/components/kasa-spinner";
import { authClient } from "@/lib/auth-client";
import { apiUrl } from "@/lib/api";
import { markBiometricUnlock } from "@/lib/biometric-unlock";
import kasaIcon from "@/assets/images/kasa-icon.png";

type Mode = "sign-in" | "sign-up";
type Method = "otp" | "password";
const googleEnabled = process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

function errorMessage(error: { message?: string } | null) {
  return error?.message ?? "Something went wrong. Please try again.";
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export default function SignInScreen() {
  const c = useTheme();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [method, setMethod] = useState<Method>("otp");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const normalizedEmail = email.trim().toLowerCase();

  async function completeAuth() {
    await markBiometricUnlock();
    router.replace("/");
  }

  function cancelActiveRequest() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setPending(false);
  }

  function startRequest() {
    cancelActiveRequest();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    return controller;
  }

  function finishRequest(controller: AbortController) {
    if (activeRequest.current !== controller) return;
    activeRequest.current = null;
    setPending(false);
  }

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 6_000);

    fetch(apiUrl("/api/auth/get-session"), {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (controller.signal.aborted) {
          setMessage(
            "KASA could not reach the local server. Keep the Mac server running and reconnect the development app.",
          );
          return;
        }
        if (!isAbortError(error)) {
          setMessage("KASA could not connect to the authentication server.");
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  async function submit() {
    setMessage(null);
    if (!normalizedEmail.includes("@")) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (mode === "sign-up" && name.trim().length < 2) {
      setMessage("Tell KASA what to call you.");
      return;
    }

    const controller = startRequest();
    try {
      if (method === "otp") {
        if (!otpSent) {
          const result = await authClient.emailOtp.sendVerificationOtp(
            {
              email: normalizedEmail,
              type: "sign-in",
            },
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          if (result.error) setMessage(errorMessage(result.error));
          else {
            setOtpSent(true);
            setMessage(
              __DEV__
                ? "Code sent. Local development code: 123456"
                : "A secure 6-digit code has been sent.",
            );
          }
          return;
        }

        const result = await authClient.signIn.emailOtp(
          {
            email: normalizedEmail,
            otp,
            name: name.trim() || undefined,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (result.error) setMessage(errorMessage(result.error));
        else await completeAuth();
        return;
      }

      if (password.length < 8) {
        setMessage("Password must be at least 8 characters.");
        return;
      }
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email(
              {
                name: name.trim(),
                email: normalizedEmail,
                password,
              },
              { signal: controller.signal },
            )
          : await authClient.signIn.email(
              {
                email: normalizedEmail,
                password,
              },
              { signal: controller.signal },
            );
      if (controller.signal.aborted) return;
      if (result.error) setMessage(errorMessage(result.error));
      else await completeAuth();
    } catch (error) {
      if (!isAbortError(error)) {
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      finishRequest(controller);
    }
  }

  async function useGoogle() {
    setMessage(null);
    const controller = startRequest();
    try {
      const result = await authClient.signIn.social(
        {
          provider: "google",
          callbackURL: "/",
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (result.error) setMessage(errorMessage(result.error));
    } catch (error) {
      if (!isAbortError(error)) {
        setMessage("Google sign-in could not be started.");
      }
    } finally {
      finishRequest(controller);
    }
  }

  function switchMode(next: Mode) {
    cancelActiveRequest();
    setMode(next);
    setOtpSent(false);
    setOtp("");
    setMessage(null);
  }

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <View style={[s.glow, { backgroundColor: c.brand }]} />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={s.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.brandRow}>
              <Image source={kasaIcon} alt="KASA" style={s.logo} />
              <View>
                <Text style={[s.brand, { color: c.text }]}>KASA</Text>
                <Text style={[s.lifeOS, { color: c.textSecondary }]}>
                  LifeOS
                </Text>
              </View>
            </View>

            <Text style={[s.eyebrow, { color: c.brand }]}>
              YOUR LIFE, SECURELY CONNECTED
            </Text>
            <Text style={[s.title, { color: c.text }]}>
              {mode === "sign-in" ? "Welcome back." : "Build your LifeOS."}
            </Text>
            <Text style={[s.subtitle, { color: c.textSecondary }]}>
              One calm place for your plans, memories, health and money.
            </Text>

            <View
              style={[
                s.card,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <View
                style={[s.segment, { backgroundColor: c.backgroundElement }]}
              >
                {(["sign-in", "sign-up"] as const).map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => switchMode(item)}
                    style={[
                      s.segmentButton,
                      mode === item && { backgroundColor: c.surface },
                    ]}
                  >
                    <Text
                      style={[
                        s.segmentText,
                        { color: mode === item ? c.text : c.textSecondary },
                      ]}
                    >
                      {item === "sign-in" ? "Sign in" : "Create account"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {googleEnabled ? (
                <Pressable
                  disabled={pending}
                  onPress={useGoogle}
                  style={[s.socialButton, { borderColor: c.border }]}
                >
                  <Text style={s.google}>G</Text>
                  <Text style={[s.socialText, { color: c.text }]}>
                    Continue with Google
                  </Text>
                </Pressable>
              ) : null}
              <View style={s.dividerRow}>
                <View style={[s.divider, { backgroundColor: c.border }]} />
                <Text style={[s.or, { color: c.textSecondary }]}>OR</Text>
                <View style={[s.divider, { backgroundColor: c.border }]} />
              </View>

              <View
                style={[s.methodTabs, { backgroundColor: c.backgroundElement }]}
              >
                {(["otp", "password"] as const).map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => {
                      cancelActiveRequest();
                      setMethod(item);
                      setOtpSent(false);
                      setMessage(null);
                    }}
                    style={[
                      s.methodTab,
                      method === item && { backgroundColor: c.surface },
                    ]}
                  >
                    <Text
                      style={[
                        s.methodText,
                        { color: method === item ? c.text : c.textSecondary },
                      ]}
                    >
                      {item === "otp" ? "One-time code" : "Password"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {mode === "sign-up" ? (
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="What should KASA call you?"
                  placeholderTextColor={c.textSecondary}
                  autoCapitalize="words"
                  style={[
                    s.input,
                    {
                      color: c.text,
                      borderColor: c.border,
                      backgroundColor: c.background,
                    },
                  ]}
                />
              ) : null}
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setOtpSent(false);
                }}
                placeholder="Email address"
                placeholderTextColor={c.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={[
                  s.input,
                  {
                    color: c.text,
                    borderColor: c.border,
                    backgroundColor: c.background,
                  },
                ]}
              />
              {method === "password" ? (
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="8+ character password"
                  placeholderTextColor={c.textSecondary}
                  secureTextEntry
                  autoComplete={
                    mode === "sign-up" ? "new-password" : "current-password"
                  }
                  style={[
                    s.input,
                    {
                      color: c.text,
                      borderColor: c.border,
                      backgroundColor: c.background,
                    },
                  ]}
                />
              ) : otpSent ? (
                <TextInput
                  value={otp}
                  onChangeText={(value) =>
                    setOtp(value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="6-digit code"
                  placeholderTextColor={c.textSecondary}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  style={[
                    s.input,
                    s.otpInput,
                    {
                      color: c.text,
                      borderColor: c.brand,
                      backgroundColor: c.background,
                    },
                  ]}
                />
              ) : null}

              {message ? (
                <Text
                  style={[
                    s.message,
                    { color: message.includes("sent") ? c.positive : c.brand },
                  ]}
                >
                  {message}
                </Text>
              ) : null}

              <Pressable
                disabled={pending}
                onPress={submit}
                style={({ pressed }) => [
                  s.primary,
                  {
                    backgroundColor: c.brand,
                    opacity: pending || pressed ? 0.72 : 1,
                  },
                ]}
              >
                {pending ? (
                  <KasaSpinner size={21} color="#FFFFFF" />
                ) : (
                  <Text style={s.primaryText}>
                    {method === "otp" && !otpSent
                      ? "Send secure code"
                      : mode === "sign-up"
                        ? "Create my KASA"
                        : "Enter KASA"}
                  </Text>
                )}
              </Pressable>
            </View>

            <Text style={[s.privacy, { color: c.textSecondary }]}>
              🔒 Your private data stays attached only to your account.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  safe: { flex: 1 },
  glow: {
    position: "absolute",
    top: -170,
    right: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.11,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  logo: { width: 44, height: 44, borderRadius: 13 },
  brand: {
    fontSize: 19,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  lifeOS: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.45,
    marginBottom: 8,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: -1.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 22,
    maxWidth: 340,
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    gap: 11,
    shadowColor: "#7C2608",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  segment: { flexDirection: "row", padding: 4, borderRadius: 14 },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 11,
  },
  segmentText: { fontSize: 13, fontWeight: "800" },
  socialButton: {
    height: 50,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  google: { color: "#4285F4", fontSize: 17, fontWeight: "900" },
  socialText: { fontSize: 14, fontWeight: "700" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  divider: { flex: 1, height: 1 },
  or: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  methodTabs: { flexDirection: "row", padding: 3, borderRadius: 13 },
  methodTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  methodText: { fontSize: 12, fontWeight: "700" },
  input: {
    height: 51,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  otpInput: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 7,
    textAlign: "center",
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    paddingHorizontal: 3,
  },
  primary: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  privacy: { fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 16 },
});
