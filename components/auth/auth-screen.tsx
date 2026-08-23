"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AtSign,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  passwordSignInAction,
  passwordSignUpAction,
  signInWithGoogleAction,
} from "@/app/(auth)/actions";
import { KasaLogo } from "@/components/brand/kasa-logo";
import { LifeOrbit } from "@/components/auth/life-orbit";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { initialAuthState, type AuthActionState } from "@/lib/auth/types";
import { identifierSchema, normalizeIdentifier } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";

type AuthIntent = "SIGN_IN" | "SIGN_UP";
type AuthMethod = "password" | "otp";
type IdentifierKind = "email" | "phone";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.24-.2-1.8h-9.2v3.35h5.4a4.6 4.6 0 0 1-2 2.94l-.02.11 2.9 2.24.2.02c1.85-1.71 2.92-4.23 2.92-6.86Z"
      />
      <path
        fill="#34A853"
        d="M12.2 21.8c2.65 0 4.87-.87 6.49-2.71l-3.09-2.37c-.83.56-1.95.95-3.4.95a5.9 5.9 0 0 1-5.58-4.07l-.1.01-3.02 2.34-.04.1A9.8 9.8 0 0 0 12.2 21.8Z"
      />
      <path
        fill="#FBBC05"
        d="M6.62 13.6a6.06 6.06 0 0 1 0-3.84l-.01-.11-3.06-2.38-.1.05a9.8 9.8 0 0 0 0 8.73l3.17-2.45Z"
      />
      <path
        fill="#EA4335"
        d="M12.2 7.69c1.84 0 3.08.79 3.78 1.44l2.77-2.7A9.43 9.43 0 0 0 12.2 3.56a9.8 9.8 0 0 0-8.75 5.76l3.17 2.44A5.92 5.92 0 0 1 12.2 7.7Z"
      />
    </svg>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.[0] ? (
    <p className="text-danger mt-1.5 text-xs" role="alert">
      {messages[0]}
    </p>
  ) : null;
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}•••@${domain}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function AuthScreen({ intent }: { intent: AuthIntent }) {
  const router = useRouter();
  const isSignUp = intent === "SIGN_UP";
  const [method, setMethod] = useState<AuthMethod>("password");
  const [identifierKind, setIdentifierKind] = useState<IdentifierKind>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [editingIdentifier, setEditingIdentifier] = useState(false);
  const passwordAction = isSignUp ? passwordSignUpAction : passwordSignInAction;
  const [passwordState, submitPassword, passwordPending] = useActionState(
    passwordAction,
    initialAuthState,
  );
  const [otpState, setOtpState] = useState<AuthActionState>(initialAuthState);
  const [verifyState, setVerifyState] =
    useState<AuthActionState>(initialAuthState);
  const [otpPending, setOtpPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const activeOtpRequest = useRef<AbortController | null>(null);
  const showOtpEntry = otpState.status === "otp_sent" && !editingIdentifier;

  const cancelOtpRequest = useCallback(() => {
    activeOtpRequest.current?.abort();
    activeOtpRequest.current = null;
    setOtpPending(false);
    setVerifyPending(false);
  }, []);

  useEffect(() => {
    const requestRef = activeOtpRequest;
    return () => requestRef.current?.abort();
  }, []);

  function startOtpRequest() {
    cancelOtpRequest();
    const controller = new AbortController();
    activeOtpRequest.current = controller;
    return controller;
  }

  function finishOtpRequest(
    controller: AbortController,
    setPending: (pending: boolean) => void,
  ) {
    if (activeOtpRequest.current !== controller) return;
    activeOtpRequest.current = null;
    setPending(false);
  }

  function switchMethod(nextMethod: AuthMethod) {
    if (nextMethod !== method) cancelOtpRequest();
    setMethod(nextMethod);
    setEditingIdentifier(false);
  }

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawIdentifier = String(formData.get("identifier") ?? "");
    const parsedIdentifier = identifierSchema.safeParse(rawIdentifier);
    const name = String(formData.get("name") ?? "").trim();

    if (!parsedIdentifier.success) {
      setOtpState({
        status: "error",
        fieldErrors: {
          identifier: ["Enter a valid email or Indian mobile number"],
        },
      });
      return;
    }
    if (isSignUp && name.length < 2) {
      setOtpState({
        status: "error",
        fieldErrors: { name: ["Tell us what to call you"] },
      });
      return;
    }

    const normalized = normalizeIdentifier(parsedIdentifier.data);
    if (normalized.channel === "PHONE") {
      setOtpState({
        status: "error",
        message:
          "Phone login will switch on when the SMS provider is connected. Use email for now.",
      });
      return;
    }

    const controller = startOtpRequest();
    setOtpPending(true);
    setOtpState(initialAuthState);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp(
        { email: normalized.value, type: "sign-in" },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (result.error) {
        setOtpState({
          status: "error",
          message: "The sign-in code could not be sent. Please try again.",
        });
        return;
      }
      setOtpState({
        status: "otp_sent",
        message: `We sent a 6-digit code to ${maskEmail(normalized.value)}.`,
        identifier: normalized.value,
        intent,
        name,
        previewCode:
          process.env.NODE_ENV === "development" ? "123456" : undefined,
      });
    } catch (error) {
      if (!isAbortError(error)) {
        setOtpState({
          status: "error",
          message: "The sign-in code could not be sent. Please try again.",
        });
      }
    } finally {
      finishOtpRequest(controller, setOtpPending);
    }
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const otp = String(formData.get("otp") ?? "");
    if (!/^\d{6}$/.test(otp)) {
      setVerifyState({
        status: "error",
        fieldErrors: { otp: ["Enter the complete 6-digit code"] },
      });
      return;
    }

    const controller = startOtpRequest();
    setVerifyPending(true);
    setVerifyState(initialAuthState);
    try {
      const result = await authClient.signIn.emailOtp(
        {
          email: otpState.identifier!,
          otp,
          name: otpState.name || undefined,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (result.error) {
        setVerifyState({
          status: "error",
          message: "That code is incorrect or expired. Request a fresh code.",
        });
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch (error) {
      if (!isAbortError(error)) {
        setVerifyState({
          status: "error",
          message: "That code is incorrect or expired. Request a fresh code.",
        });
      }
    } finally {
      finishOtpRequest(controller, setVerifyPending);
    }
  }

  const identifierLabel =
    identifierKind === "email" ? "Email address" : "Mobile number";
  const identifierPlaceholder =
    identifierKind === "email" ? "you@example.com" : "+91 98765 43210";

  return (
    <main className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="bg-brand/14 absolute -top-44 -left-44 size-[34rem] rounded-full blur-[120px]" />
        <div className="bg-brand/8 absolute -right-40 -bottom-44 size-[36rem] rounded-full blur-[130px]" />
        <div className="border-brand/12 absolute -top-72 left-[8%] size-[42rem] rounded-full border" />
        <div className="border-brand/10 absolute -top-56 left-[13%] size-[32rem] rounded-full border" />
      </div>

      <ThemeToggle className="bg-card/70 border-border/70 fixed top-4 right-4 z-30 border backdrop-blur-xl sm:top-6 sm:right-6" />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[90rem] items-center gap-10 px-4 py-4 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:px-10 xl:gap-20">
        <aside className="auth-panel-enter relative hidden lg:block">
          <div className="bg-brand/12 absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]" />
          <div className="relative">
            <LifeOrbit />

            <div className="relative -mt-2 text-center">
              <p className="text-brand text-[0.66rem] font-bold tracking-[0.18em] uppercase">
                Everything revolves around you
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] xl:text-3xl">
                Your whole life, in rhythm.
              </h1>
              <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-6">
                KASA connects your health, money, people, home, learning, and
                goals—without the mental clutter.
              </p>
            </div>

            <div className="border-border/70 bg-card/55 relative mx-auto mt-5 grid max-w-sm grid-cols-3 rounded-2xl border p-1.5 text-center backdrop-blur-xl">
              {[
                ["Today", "Focus"],
                ["Always", "Remember"],
                ["Ahead", "Grow"],
              ].map(([label, value]) => (
                <div key={label} className="px-2 py-2">
                  <p className="text-[0.63rem] font-bold">{value}</p>
                  <p className="text-muted-foreground mt-0.5 text-[0.58rem] uppercase">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex items-center justify-center lg:min-h-0">
          <div className="auth-form-enter w-full max-w-[31rem]">
            <div className="auth-form-child surface-glass shadow-float rounded-[1.75rem] border p-5 [animation-delay:70ms] sm:p-6">
              <div className="mb-5">
                <Link
                  href="/"
                  aria-label="KASA home"
                  className="inline-flex rounded-xl transition-transform hover:scale-[1.02] focus-visible:ring-2"
                >
                  <KasaLogo markClassName="size-10" />
                </Link>
                <h2 className="mt-4 text-[1.75rem] font-semibold tracking-[-0.045em]">
                  {isSignUp ? "Create your KASA" : "Welcome back"}
                </h2>
                <p className="text-muted-foreground mt-1.5 text-sm leading-5">
                  {isSignUp
                    ? "A private Life OS that grows around your world."
                    : "Your day, memories, and momentum are waiting."}
                </p>
              </div>

              <form action={signInWithGoogleAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  className="bg-card/80 hover:bg-card h-11 w-full rounded-xl"
                >
                  <GoogleIcon /> Continue with Google
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <span className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-[0.65rem] font-semibold tracking-[0.15em] uppercase">
                  or use your details
                </span>
                <span className="bg-border h-px flex-1" />
              </div>

              <div className="bg-surface-soft/75 mb-4 grid grid-cols-2 rounded-xl p-1">
                {(["password", "otp"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      switchMethod(value);
                    }}
                    className={cn(
                      "flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all",
                      method === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {value === "password" ? (
                      <LockKeyhole className="size-4" />
                    ) : (
                      <KeyRound className="size-4" />
                    )}
                    {value === "password" ? "Password" : "One-time code"}
                  </button>
                ))}
              </div>

              {method === "password" ? (
                <form action={submitPassword} className="grid gap-3">
                  {isSignUp ? (
                    <div>
                      <Label htmlFor="password-name">Your name</Label>
                      <div className="relative mt-2">
                        <Sparkles className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                        <Input
                          id="password-name"
                          name="name"
                          autoComplete="name"
                          placeholder="What should KASA call you?"
                          className="h-11 rounded-xl pl-10"
                        />
                      </div>
                      <FieldError messages={passwordState.fieldErrors?.name} />
                    </div>
                  ) : null}
                  <IdentifierField
                    kind={identifierKind}
                    onKindChange={setIdentifierKind}
                    label={identifierLabel}
                    placeholder={identifierPlaceholder}
                    error={passwordState.fieldErrors?.identifier}
                  />
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {!isSignUp ? (
                        <button
                          type="button"
                          onClick={() => switchMethod("otp")}
                          className="text-brand text-xs font-semibold"
                        >
                          Forgot password?
                        </button>
                      ) : null}
                    </div>
                    <div className="relative mt-2">
                      <LockKeyhole className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          isSignUp ? "new-password" : "current-password"
                        }
                        placeholder={
                          isSignUp ? "8+ characters" : "Your password"
                        }
                        className="h-11 rounded-xl pr-11 pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    <FieldError
                      messages={passwordState.fieldErrors?.password}
                    />
                  </div>
                  {passwordState.message ? (
                    <p
                      className="bg-danger-soft text-danger rounded-xl p-3 text-sm"
                      role="alert"
                    >
                      {passwordState.message}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={passwordPending}
                    aria-busy={passwordPending}
                    className="shadow-brand mt-1 h-11 rounded-xl"
                  >
                    {passwordPending ? (
                      <Spinner className="size-5" />
                    ) : isSignUp ? (
                      "Create my KASA"
                    ) : (
                      "Enter KASA"
                    )}
                    {!passwordPending ? <ArrowRight /> : null}
                  </Button>
                </form>
              ) : showOtpEntry ? (
                <form onSubmit={verifyOtp} className="grid gap-4">
                  <div className="bg-brand-soft/65 rounded-2xl p-4">
                    <p className="text-sm font-semibold">Check your messages</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      {otpState.message}
                    </p>
                    {otpState.previewCode ? (
                      <p className="text-brand mt-2 text-xs font-bold">
                        Development code: {otpState.previewCode}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="otp-code">6-digit code</Label>
                    <InputOTP
                      id="otp-code"
                      name="otp"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      containerClassName="mt-3 justify-between"
                    >
                      <InputOTPGroup className="w-full justify-between gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="bg-card size-11 flex-1 rounded-xl border text-base first:rounded-xl first:border last:rounded-xl"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <FieldError messages={verifyState.fieldErrors?.otp} />
                  </div>
                  <input
                    type="hidden"
                    name="identifier"
                    value={otpState.identifier}
                  />
                  <input type="hidden" name="intent" value={otpState.intent} />
                  <input
                    type="hidden"
                    name="name"
                    value={otpState.name ?? ""}
                  />
                  {verifyState.message ? (
                    <p
                      className="bg-danger-soft text-danger rounded-xl p-3 text-sm"
                      role="alert"
                    >
                      {verifyState.message}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={verifyPending}
                    aria-busy={verifyPending}
                    className="shadow-brand h-11 rounded-xl"
                  >
                    {verifyPending ? (
                      <Spinner className="size-5" />
                    ) : (
                      "Verify & continue"
                    )}
                    {!verifyPending ? <ArrowRight /> : null}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      cancelOtpRequest();
                      setEditingIdentifier(true);
                    }}
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    Use a different email or number
                  </button>
                </form>
              ) : (
                <form onSubmit={requestOtp} className="grid gap-3">
                  {isSignUp ? (
                    <div>
                      <Label htmlFor="otp-name">Your name</Label>
                      <div className="relative mt-2">
                        <Sparkles className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                        <Input
                          id="otp-name"
                          name="name"
                          autoComplete="name"
                          placeholder="What should KASA call you?"
                          className="h-11 rounded-xl pl-10"
                        />
                      </div>
                      <FieldError messages={otpState.fieldErrors?.name} />
                    </div>
                  ) : null}
                  <input type="hidden" name="intent" value={intent} />
                  <IdentifierField
                    kind={identifierKind}
                    onKindChange={setIdentifierKind}
                    label={identifierLabel}
                    placeholder={identifierPlaceholder}
                    error={otpState.fieldErrors?.identifier}
                  />
                  <p className="text-muted-foreground flex gap-2 text-xs leading-5">
                    <ShieldCheck className="text-brand mt-0.5 size-4 shrink-0" />
                    We’ll send a secure code. It expires in 10 minutes and can
                    only be used once.
                  </p>
                  {otpState.status === "error" && otpState.message ? (
                    <p
                      className="bg-danger-soft text-danger rounded-xl p-3 text-sm"
                      role="alert"
                    >
                      {otpState.message}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={otpPending}
                    aria-busy={otpPending}
                    className="shadow-brand h-11 rounded-xl"
                  >
                    {otpPending ? (
                      <Spinner className="size-5" />
                    ) : (
                      "Send secure code"
                    )}
                    {!otpPending ? <ArrowRight /> : null}
                  </Button>
                </form>
              )}

              <p className="text-muted-foreground mt-5 text-center text-sm">
                {isSignUp ? "Already have your KASA?" : "New to KASA?"}{" "}
                <Link
                  href={isSignUp ? "/sign-in" : "/sign-up"}
                  className="text-brand font-semibold hover:underline"
                >
                  {isSignUp ? "Sign in" : "Create your account"}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function IdentifierField({
  kind,
  onKindChange,
  label,
  placeholder,
  error,
}: {
  kind: IdentifierKind;
  onKindChange: (kind: IdentifierKind) => void;
  label: string;
  placeholder: string;
  error?: string[];
}) {
  const Icon = kind === "email" ? Mail : Phone;
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={`identifier-${kind}`}>{label}</Label>
        <div className="bg-surface-soft flex rounded-lg p-0.5">
          {(["email", "phone"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onKindChange(value)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[0.68rem] font-semibold capitalize",
                kind === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {value === "email" ? (
                <AtSign className="size-3" />
              ) : (
                <Phone className="size-3" />
              )}
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-2">
        <Icon className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <Input
          key={kind}
          id={`identifier-${kind}`}
          name="identifier"
          type={kind === "email" ? "email" : "tel"}
          inputMode={kind === "email" ? "email" : "tel"}
          autoComplete={kind === "email" ? "email" : "tel"}
          placeholder={placeholder}
          className="h-11 rounded-xl pl-10"
        />
      </div>
      <FieldError messages={error} />
    </div>
  );
}
