"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  BellRing,
  BrainCircuit,
  CheckSquare2,
  IndianRupee,
  Lightbulb,
  Mic,
  MicOff,
  LockKeyhole,
  ShoppingBasket,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { createCaptureAction } from "@/app/app/brain-dump/actions";
import { initialCaptureState } from "@/lib/brain-dump/action-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useVoiceCapture } from "@/hooks/use-voice-capture";

type CaptureListItem = {
  id: string;
  text: string;
  category: string;
  confidence: number;
  createdAtLabel: string;
  classifier?: string;
  source?: string;
  isExample?: boolean;
};

type BrainDumpScreenProps = {
  isAuthenticated: boolean;
  captures: CaptureListItem[];
};

const categoryConfig = {
  TASK: {
    label: "Task",
    icon: CheckSquare2,
    style: "bg-brand-soft text-brand",
  },
  REMINDER: {
    label: "Reminder",
    icon: BellRing,
    style: "bg-warning-soft text-warning",
  },
  IDEA: {
    label: "Idea",
    icon: Lightbulb,
    style: "bg-info-soft text-info",
  },
  EXPENSE: {
    label: "Expense",
    icon: IndianRupee,
    style: "bg-danger-soft text-danger",
  },
  SHOPPING: {
    label: "Shopping",
    icon: ShoppingBasket,
    style: "bg-positive-soft text-positive",
  },
  WISH: {
    label: "Wish",
    icon: Sparkles,
    style: "bg-secondary text-secondary-foreground",
  },
} as const;

const examples = [
  "Laptop service",
  "Remind me to call Gayle tomorrow evening",
  "Idea for a family health app",
  "Paid ₹1200 electricity bill",
  "Milk khatam",
  "Someday buy a camera",
];

function getCategoryConfig(category: string) {
  return (
    categoryConfig[category as keyof typeof categoryConfig] ??
    categoryConfig.TASK
  );
}

export function BrainDumpScreen({
  isAuthenticated,
  captures,
}: BrainDumpScreenProps) {
  const [state, formAction, pending] = useActionState(
    createCaptureAction,
    initialCaptureState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [captureSource, setCaptureSource] = useState<"WEB" | "VOICE">("WEB");

  const acceptTranscript = useCallback((transcript: string) => {
    if (!textareaRef.current) return;
    textareaRef.current.value = transcript;
    textareaRef.current.focus();
    setCaptureSource("VOICE");
  }, []);
  const voice = useVoiceCapture(acceptTranscript);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    }
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  function fillExample(text: string) {
    if (!textareaRef.current) return;
    textareaRef.current.value = text;
    textareaRef.current.focus();
  }

  return (
    <main className="relative pb-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-brand/12 absolute top-[-12rem] left-1/2 size-[42rem] -translate-x-1/2 rounded-full blur-[130px]" />
        <div className="border-brand/15 absolute top-[-21rem] left-1/2 size-[46rem] -translate-x-1/2 rounded-full border" />
      </div>

      <div className="relative w-full">
        <section className="grid items-start gap-6 py-2 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 lg:py-4">
          <div>
            <Badge
              variant="outline"
              className="border-brand/25 bg-brand-soft/70 text-brand shadow-none"
            >
              <BrainCircuit data-icon="inline-start" /> Universal capture
            </Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
              Capture the thought.
              <span className="brand-text-gradient block">KASA sorts it.</span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-base leading-7 sm:text-lg">
              Tasks, reminders, ideas, expenses, shopping, and wishes—write
              naturally. Your original thought always stays intact.
            </p>

            <form
              ref={formRef}
              action={formAction}
              className="surface-glass mt-8 rounded-[1.75rem] border p-4 sm:p-5"
            >
              <input type="hidden" name="source" value={captureSource} />
              <Textarea
                ref={textareaRef}
                name="text"
                required
                minLength={2}
                maxLength={2000}
                onChange={() => setCaptureSource("WEB")}
                disabled={!isAuthenticated || pending}
                placeholder="Type naturally—or tap the mic and just say it..."
                className="bg-surface-soft/45 min-h-40 resize-none rounded-2xl border-0 p-4 text-base leading-7 shadow-none focus-visible:ring-2 sm:min-h-48 sm:p-5"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={voice.listening ? "default" : "outline"}
                  onClick={voice.toggle}
                  disabled={!voice.supported || pending}
                  className={cn(
                    "rounded-xl",
                    voice.listening && "shadow-brand animate-pulse",
                  )}
                >
                  {voice.listening ? <MicOff /> : <Mic />}
                  {voice.listening ? "Listening… tap to stop" : "Speak instead"}
                </Button>
                {voice.supported ? (
                  <div className="bg-surface-soft flex rounded-xl p-1">
                    {[
                      ["en-IN", "Hinglish"],
                      ["hi-IN", "हिंदी"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          voice.setLanguage(value as "en-IN" | "hi-IN")
                        }
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                          voice.language === value
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Voice capture works in Chrome and supported mobile browsers.
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  <LockKeyhole className="size-3.5" /> Private to your account
                </span>
                {isAuthenticated ? (
                  <Button
                    type="submit"
                    size="lg"
                    disabled={pending}
                    aria-busy={pending}
                    className="shadow-brand rounded-xl"
                  >
                    {pending ? (
                      <Spinner className="size-5" />
                    ) : (
                      <>
                        <WandSparkles /> Let KASA handle it
                      </>
                    )}
                  </Button>
                ) : (
                  <Button asChild size="lg" className="rounded-xl">
                    <Link href="/sign-in">Sign in to capture</Link>
                  </Button>
                )}
              </div>
              {state.status === "error" && state.message ? (
                <p className="text-danger mt-3 text-sm" role="alert">
                  {state.message}
                </p>
              ) : null}
              {state.status === "success" ? (
                <div className="border-positive/20 bg-positive-soft text-positive mt-3 rounded-xl border px-3 py-2.5 text-sm">
                  <span className="font-semibold">Done automatically.</span>{" "}
                  {state.message}
                  {state.classifier === "AI" ? " · AI understood" : ""}
                </div>
              ) : null}
            </form>

            <div className="mt-5">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
                Try an example
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => fillExample(example)}
                    disabled={!isAuthenticated}
                    className="border-border bg-card/70 text-muted-foreground hover:border-brand/40 hover:text-foreground rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-45"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="surface-glass rounded-[1.75rem] border p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Your inbox flow</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  One inbox. Six smart destinations.
                </p>
              </div>
              <span className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-2xl">
                <WandSparkles className="size-5" />
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
              {Object.entries(categoryConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <div
                    key={key}
                    className="border-border/70 bg-card/65 rounded-2xl border p-3.5"
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-xl",
                        config.style,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <p className="mt-3 text-sm font-semibold">{config.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="border-border/70 mt-6 border-t pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Recent captures</h3>
                {!isAuthenticated ? (
                  <Badge variant="secondary">Examples</Badge>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2">
                {captures.length ? (
                  captures.map((capture) => {
                    const config = getCategoryConfig(capture.category);
                    const Icon = config.icon;
                    return (
                      <div
                        key={capture.id}
                        className="border-border/60 bg-surface-soft/45 flex items-start gap-3 rounded-2xl border p-3"
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-xl",
                            config.style,
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {capture.text}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {config.label} ·{" "}
                            {Math.round(capture.confidence * 100)}% confidence ·{" "}
                            {capture.createdAtLabel}
                          </p>
                          {capture.classifier ? (
                            <p className="text-brand mt-1 text-[0.68rem] font-semibold tracking-[0.08em] uppercase">
                              {capture.classifier === "AI"
                                ? "AI organized"
                                : "Smart rules"}
                              {capture.source === "VOICE" ? " · Voice" : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-surface-soft/45 text-muted-foreground rounded-2xl p-5 text-center text-sm">
                    Your captured thoughts will appear here.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
