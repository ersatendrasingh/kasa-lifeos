"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  GraduationCap,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RouteContentLoader } from "@/components/app/route-content-loader";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Lesson = {
  id: string;
  title: string;
  position: number;
  completedAt: string | null;
};
type Session = {
  id: string;
  minutes: number;
  note: string | null;
  studiedAt: string;
};
type Track = {
  id: string;
  title: string;
  type: string;
  provider: string | null;
  url: string | null;
  description: string | null;
  status: string;
  weeklyGoalMinutes: number;
  lastStudiedAt: string | null;
  lessons: Lesson[];
  sessions: Session[];
  weeklyMinutes: number;
};
type Response = { tracks: Track[] };
const types = ["COURSE", "BOOK", "SKILL", "PRACTICE", "CERTIFICATION"] as const;
const nice = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const progress = (track: Track) =>
  track.lessons.length
    ? Math.round(
        (track.lessons.filter((lesson) => lesson.completedAt).length /
          track.lessons.length) *
          100,
      )
    : 0;

export function LearningWorkspace() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<Track | null>(null);
  const [sessionTrack, setSessionTrack] = useState<Track | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof types)[number]>("COURSE");
  const [provider, setProvider] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("180");
  const [lessons, setLessons] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState("25");
  const [sessionNote, setSessionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadLearning() {
      setLoading(true);
      try {
        const response = await fetch("/api/learning");
        if (!response.ok) throw new Error();
        const payload: Response = await response.json();
        if (!cancelled) setTracks(payload.tracks);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadLearning();
    return () => {
      cancelled = true;
    };
  }, []);
  async function mutate(body: object, key: string) {
    setBusy(key);
    try {
      const response = await fetch("/api/learning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      const payload: Response = await response.json();
      setTracks(payload.tracks);
      setSelected((current) =>
        current
          ? (payload.tracks.find((item) => item.id === current.id) ?? null)
          : null,
      );
    } finally {
      setBusy(null);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 2) {
      setError("Give this learning track a clear title.");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          provider: provider.trim() || undefined,
          url: url.trim(),
          description: description.trim() || undefined,
          weeklyGoalMinutes: Number(goal) || 180,
          lessons: lessons
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok)
        throw new Error("Check the track details and try again.");
      const payload = await response.json();
      setTracks((items) => [payload.track, ...items]);
      setCreate(false);
      setSelected(payload.track);
      setTitle("");
      setProvider("");
      setUrl("");
      setDescription("");
      setGoal("180");
      setLessons("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create this track.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function logSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionTrack) return;
    const minutes = Number(sessionMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
      setError("Enter a session length between 1 and 720 minutes.");
      return;
    }
    setError(null);
    await mutate(
      {
        trackId: sessionTrack.id,
        action: "log-session",
        minutes,
        note: sessionNote.trim() || undefined,
      },
      `study-${sessionTrack.id}`,
    );
    setSessionTrack(null);
    setSessionMinutes("25");
    setSessionNote("");
  }
  const active = tracks.filter((track) => track.status === "ACTIVE");
  const weekMinutes = tracks.reduce(
    (sum, track) => sum + track.weeklyMinutes,
    0,
  );
  const goalMinutes = active.reduce(
    (sum, track) => sum + track.weeklyGoalMinutes,
    0,
  );
  const completed = tracks.filter(
    (track) => track.status === "COMPLETED",
  ).length;
  const focus =
    active.sort(
      (a, b) =>
        (a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0) -
        (b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0),
    )[0] ?? null;
  return (
    <main className="route-content-enter mx-auto max-w-6xl pb-12">
      <header className="border-border/70 flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-brand flex items-center gap-2 text-[.68rem] font-bold tracking-[.18em] uppercase">
            <GraduationCap className="size-3.5" /> Learning studio
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.055em] sm:text-4xl">
            Learn it. Use it. Keep it.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
            Turn every course, book and practice plan into visible progress—not
            another forgotten tab.
          </p>
        </div>
        <Button size="lg" className="shadow-brand h-11 rounded-xl" asChild>
          <Link href="/app/learning/new">
            <Plus /> Add a track
          </Link>
        </Button>
      </header>
      {loading ? (
        <RouteContentLoader />
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Active tracks"
              value={String(active.length)}
              detail="moving forward"
              icon={<BookOpen />}
            />
            <Metric
              label="This week"
              value={`${weekMinutes}m`}
              detail={
                goalMinutes
                  ? `${Math.min(100, Math.round((weekMinutes / goalMinutes) * 100))}% of your goal`
                  : "set a weekly goal"
              }
              icon={<Clock3 />}
            />
            <Metric
              label="Finished"
              value={String(completed)}
              detail="tracks completed"
              icon={<CheckCircle2 />}
            />
            <Metric
              label="Lesson progress"
              value={`${tracks.reduce((sum, track) => sum + track.lessons.filter((lesson) => lesson.completedAt).length, 0)}`}
              detail="small wins recorded"
              icon={<Sparkles />}
            />
          </section>
          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-5">
              {focus && (
                <FocusCard
                  track={focus}
                  busy={busy}
                  onStudy={() => setSessionTrack(focus)}
                  onOpen={() => setSelected(focus)}
                />
              )}
              {active.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {active.map((track) => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      onOpen={() => setSelected(track)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyLearning />
              )}
            </div>
            <aside className="bg-foreground text-background h-fit rounded-[1.75rem] p-6">
              <p className="text-background/55 text-xs font-bold tracking-[.14em] uppercase">
                A better rhythm
              </p>
              <div className="mt-5 space-y-5">
                <Tip
                  icon={<Target />}
                  title="One clear next step"
                  detail="Open a track and finish the next lesson—not the whole syllabus."
                />
                <Tip
                  icon={<Clock3 />}
                  title="Short sessions count"
                  detail="Log 25 focused minutes whenever you show up."
                />
                <Tip
                  icon={<CheckCircle2 />}
                  title="Make it practical"
                  detail="Add a lesson for the project or exercise where you apply it."
                />
              </div>
            </aside>
          </section>
        </>
      )}
      <Dialog
        open={create}
        onOpenChange={(open) => {
          setCreate(open);
          if (!open) setError(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Start a learning track
            </DialogTitle>
            <DialogDescription>
              Add the outcome and the next few lessons. You can keep it light
              and update it as you go.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 py-2"
            onSubmit={(event) => void save(event)}
          >
            <label className="grid gap-2 text-sm font-medium">
              What are you learning?
              <Input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. System design fundamentals"
                className="h-12 rounded-xl"
              />
            </label>
            <div>
              <p className="mb-2 text-sm font-medium">Track type</p>
              <div className="flex flex-wrap gap-2">
                {types.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={type === item ? "default" : "secondary"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setType(item)}
                  >
                    {nice(item)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Provider or author
                <Input
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  placeholder="Provider or author (optional)"
                  className="h-11 rounded-xl"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Weekly goal (minutes)
                <Input
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  inputMode="numeric"
                  placeholder="Weekly minutes"
                  className="h-11 rounded-xl"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Resource link{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                inputMode="url"
                placeholder="Course, book or resource link (optional)"
                className="h-11 rounded-xl"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Outcome{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What will this help you do?"
                className="min-h-20 rounded-xl"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Lessons or milestones{" "}
              <span className="text-muted-foreground font-normal">
                (one per line)
              </span>
              <Textarea
                value={lessons}
                onChange={(event) => setLessons(event.target.value)}
                placeholder={
                  "Lessons or milestones — one per line\nCaching and queues\nDesign a rate limiter\nBuild a small project"
                }
                className="min-h-32 rounded-xl"
              />
            </label>
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={busy === "create" || title.trim().length < 2}
              className="h-12 rounded-xl"
            >
              {busy === "create" ? <Spinner /> : <Plus />} Create learning track
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <StudyDialog
        track={sessionTrack}
        busy={busy}
        minutes={sessionMinutes}
        note={sessionNote}
        error={error}
        onClose={() => {
          setSessionTrack(null);
          setError(null);
        }}
        onMinutesChange={setSessionMinutes}
        onNoteChange={setSessionNote}
        onSubmit={logSession}
      />
      <TrackDetail
        track={selected}
        busy={busy}
        onClose={() => setSelected(null)}
        onAction={mutate}
        onLogSession={() => setSessionTrack(selected)}
      />
    </main>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="bg-card shadow-card rounded-2xl border p-4">
      <span className="bg-brand-soft text-brand grid size-8 place-items-center rounded-xl">
        {icon}
      </span>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
    </article>
  );
}
function FocusCard({
  track,
  busy,
  onStudy,
  onOpen,
}: {
  track: Track;
  busy: string | null;
  onStudy: () => void;
  onOpen: () => void;
}) {
  const amount = Math.min(
    100,
    Math.round((track.weeklyMinutes / track.weeklyGoalMinutes) * 100),
  );
  return (
    <article className="brand-gradient text-brand-foreground shadow-brand relative overflow-hidden rounded-[2rem] p-6 sm:p-7">
      <div className="border-brand-foreground/15 absolute -top-20 -right-12 size-56 rounded-full border-[1.25rem]" />
      <div className="relative">
        <p className="text-brand-foreground/70 text-[.68rem] font-bold tracking-[.15em] uppercase">
          Continue your focus
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {track.title}
            </h2>
            <p className="text-brand-foreground/75 mt-1 text-sm">
              {track.provider || nice(track.type)} · {track.weeklyMinutes} of{" "}
              {track.weeklyGoalMinutes} minutes this week
            </p>
          </div>
          <Button
            variant="secondary"
            className="rounded-xl"
            onClick={onStudy}
            disabled={busy !== null}
          >
            {busy === `study-${track.id}` ? <Spinner /> : <Play />} Record
            session
          </Button>
        </div>
        <Progress
          value={amount}
          className="bg-brand-foreground/25 [&>div]:bg-brand-foreground mt-5 h-2"
        />
        <button
          type="button"
          onClick={onOpen}
          className="text-brand-foreground/80 hover:text-brand-foreground mt-5 flex items-center gap-2 text-xs font-semibold"
        >
          See lessons and progress <ExternalLink className="size-3.5" />
        </button>
      </div>
    </article>
  );
}
function TrackCard({ track, onOpen }: { track: Track; onOpen: () => void }) {
  const done = track.lessons.filter((lesson) => lesson.completedAt).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-card hover:border-brand/40 hover:shadow-card rounded-[1.5rem] border p-5 text-left transition"
    >
      <div className="flex items-start justify-between gap-3">
        <Badge variant="secondary" className="rounded-full">
          {nice(track.type)}
        </Badge>
        <MoreHorizontal className="text-muted-foreground size-4" />
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight">
        {track.title}
      </h2>
      <p className="text-muted-foreground mt-1 h-5 text-sm">
        {track.provider || "Personal learning plan"}
      </p>
      <div className="mt-5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {track.lessons.length
            ? `${done} of ${track.lessons.length} lessons`
            : `${track.weeklyMinutes}m this week`}
        </span>
        <span className="text-brand font-semibold">{progress(track)}%</span>
      </div>
      <Progress value={progress(track)} className="mt-2 h-1.5" />
    </button>
  );
}
function TrackDetail({
  track,
  busy,
  onClose,
  onAction,
  onLogSession,
}: {
  track: Track | null;
  busy: string | null;
  onClose: () => void;
  onAction: (body: object, key: string) => Promise<void>;
  onLogSession: () => void;
}) {
  if (!track) return null;
  return (
    <aside className="bg-card shadow-float fixed right-3 bottom-3 left-3 z-50 max-h-[85vh] overflow-y-auto rounded-[1.75rem] border p-5 sm:right-6 sm:bottom-6 sm:left-auto sm:w-full sm:max-w-lg sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="rounded-full">
            {nice(track.type)}
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {track.title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {track.provider || "Personal learning plan"}
          </p>
          {track.description && (
            <p className="text-muted-foreground mt-3 max-w-md text-sm leading-6">
              {track.description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={onClose}
        >
          ×
        </Button>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-bold tracking-[.14em] uppercase">
          Lessons
        </p>
        <span className="text-brand text-sm font-semibold">
          {progress(track)}% done
        </span>
      </div>
      <div className="mt-3 space-y-1">
        {track.lessons.length ? (
          track.lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void onAction(
                  {
                    trackId: track.id,
                    action: "toggle-lesson",
                    lessonId: lesson.id,
                    completed: !lesson.completedAt,
                  },
                  `lesson-${lesson.id}`,
                )
              }
              className="hover:bg-surface-soft flex w-full items-center gap-3 rounded-xl p-3 text-left"
            >
              <span
                className={
                  lesson.completedAt ? "text-positive" : "text-muted-foreground"
                }
              >
                {busy === `lesson-${lesson.id}` ? (
                  <Spinner className="size-4" />
                ) : lesson.completedAt ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Circle className="size-4" />
                )}
              </span>
              <span
                className={`text-sm ${lesson.completedAt ? "text-muted-foreground line-through" : "font-medium"}`}
              >
                {lesson.title}
              </span>
            </button>
          ))
        ) : (
          <p className="text-muted-foreground bg-surface-soft rounded-xl p-4 text-sm">
            No lessons added yet. Use focused sessions to keep this track
            moving.
          </p>
        )}
      </div>
      <div className="mt-6 flex gap-2">
        <Button
          className="flex-1 rounded-xl"
          disabled={busy !== null}
          onClick={onLogSession}
        >
          <Play /> Record study session
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-xl"
          disabled={busy !== null}
          onClick={() =>
            void onAction(
              { trackId: track.id, action: "set-status", status: "PAUSED" },
              `pause-${track.id}`,
            )
          }
        >
          <Pause />
        </Button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1 rounded-xl"
          disabled={busy !== null || track.status === "COMPLETED"}
          onClick={() =>
            void onAction(
              { trackId: track.id, action: "set-status", status: "COMPLETED" },
              `complete-${track.id}`,
            )
          }
        >
          {busy === `complete-${track.id}` ? <Spinner /> : <CheckCircle2 />}{" "}
          Mark complete
        </Button>
        <Link
          href="/app/timeline"
          className="border-border hover:bg-surface-soft inline-flex size-10 shrink-0 items-center justify-center rounded-xl border"
          aria-label="Open timeline"
        >
          <Clock3 className="size-4" />
        </Link>
      </div>
      {track.sessions.length > 0 && (
        <div className="mt-6">
          <p className="text-muted-foreground text-xs font-bold tracking-[.14em] uppercase">
            This week’s sessions
          </p>
          <div className="mt-3 space-y-2">
            {track.sessions.slice(0, 4).map((session) => (
              <div
                key={session.id}
                className="bg-surface-soft flex items-start justify-between gap-3 rounded-xl p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {session.minutes} focused minutes
                  </p>
                  {session.note && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {session.note}
                    </p>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {new Intl.DateTimeFormat("en-IN", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(session.studiedAt))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {track.url && (
        <a
          href={track.url}
          target="_blank"
          rel="noreferrer"
          className="text-brand mt-4 flex items-center gap-2 text-sm font-semibold"
        >
          Open resource <ExternalLink className="size-4" />
        </a>
      )}
    </aside>
  );
}
function StudyDialog({
  track,
  busy,
  minutes,
  note,
  error,
  onClose,
  onMinutesChange,
  onNoteChange,
  onSubmit,
}: {
  track: Track | null;
  busy: string | null;
  minutes: string;
  note: string;
  error: string | null;
  onClose: () => void;
  onMinutesChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <Dialog open={Boolean(track)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Record your session</DialogTitle>
          <DialogDescription>
            {track
              ? `Add the time you spent on ${track.title}. This will appear in your Timeline.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          onSubmit={(event) => void onSubmit(event)}
        >
          <label className="grid gap-2 text-sm font-medium">
            Focused minutes
            <Input
              value={minutes}
              onChange={(event) => onMinutesChange(event.target.value)}
              inputMode="numeric"
              className="h-11 rounded-xl"
              autoFocus
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            What did you work on?{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
            <Textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="e.g. Finished the caching exercise"
              className="min-h-24 rounded-xl"
            />
          </label>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={!track || busy !== null}
            className="h-12 rounded-xl"
          >
            {busy === `study-${track?.id}` ? <Spinner /> : <CheckCircle2 />}{" "}
            Save session
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Tip({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="bg-background/10 grid size-9 shrink-0 place-items-center rounded-xl">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-background/60 mt-1 text-xs leading-5">{detail}</p>
      </div>
    </div>
  );
}
function EmptyLearning() {
  return (
    <div className="bg-card grid min-h-80 place-items-center rounded-[2rem] border border-dashed p-8 text-center">
      <div>
        <span className="bg-brand-soft text-brand mx-auto grid size-12 place-items-center rounded-2xl">
          <GraduationCap className="size-5" />
        </span>
        <h2 className="mt-4 text-xl font-semibold">
          Start with one useful skill
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
          A course, a book, interview practice or a personal project—make the
          next step clear.
        </p>
        <Button className="mt-5 rounded-xl" asChild>
          <Link href="/app/learning/new">
            <Plus /> Add a learning track
          </Link>
        </Button>
      </div>
    </div>
  );
}
