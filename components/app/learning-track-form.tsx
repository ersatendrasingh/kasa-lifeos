"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Link2, Plus, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const types = ["COURSE", "BOOK", "SKILL", "PRACTICE", "CERTIFICATION"] as const;
type TrackType = (typeof types)[number];
const nice = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function LearningTrackForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TrackType>("COURSE");
  const [provider, setProvider] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("180");
  const [lessons, setLessons] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 2) {
      setError("Give this learning track a clear title.");
      return;
    }
    const weeklyGoalMinutes = Number(goal);
    if (!Number.isInteger(weeklyGoalMinutes) || weeklyGoalMinutes < 15) {
      setError("Set a weekly goal of at least 15 minutes.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          provider: provider.trim() || undefined,
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          weeklyGoalMinutes,
          lessons: lessons
            .split("\n")
            .map((lesson) => lesson.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error("Check the details and try again.");
      router.push("/app/learning");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create this track.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="route-content-enter mx-auto max-w-4xl pb-12">
      <header className="border-border/70 border-b pb-7">
        <Button variant="ghost" size="sm" className="-ml-2 rounded-xl" asChild>
          <Link href="/app/learning">
            <ArrowLeft /> Back to learning
          </Link>
        </Button>
        <p className="text-brand mt-6 flex items-center gap-2 text-[.68rem] font-bold tracking-[.18em] uppercase">
          <Plus className="size-3.5" /> New learning track
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.055em] sm:text-4xl">
          Make your next skill tangible.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
          Add the resource, a realistic weekly rhythm, and the first steps you
          can finish.
        </p>
      </header>

      <form
        onSubmit={(event) => void submit(event)}
        className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]"
      >
        <section className="bg-card shadow-card space-y-7 rounded-[1.75rem] border p-5 sm:p-7">
          <div>
            <p className="text-sm font-semibold">The learning plan</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Start with enough detail to make showing up easy.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            What are you learning?
            <Input
              autoFocus
              required
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Provider or author{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
              <Input
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                placeholder="e.g. Coursera, James Clear"
                className="h-11 rounded-xl"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Weekly goal{" "}
              <span className="text-muted-foreground font-normal">
                (minutes)
              </span>
              <Input
                required
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                inputMode="numeric"
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
              placeholder="https://..."
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
              placeholder="What will this help you do in real life or work?"
              className="min-h-24 rounded-xl"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            First lessons or milestones{" "}
            <span className="text-muted-foreground font-normal">
              (one per line)
            </span>
            <Textarea
              value={lessons}
              onChange={(event) => setLessons(event.target.value)}
              placeholder={
                "Caching and queues\nDesign a rate limiter\nBuild a small project"
              }
              className="min-h-40 rounded-xl"
            />
          </label>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-xl"
              asChild
            >
              <Link href="/app/learning">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="shadow-brand h-11 rounded-xl"
            >
              {busy ? <Spinner /> : <CheckCircle2 />} Create learning track
            </Button>
          </div>
        </section>
        <aside className="bg-foreground text-background h-fit rounded-[1.75rem] p-5 sm:p-6">
          <span className="bg-background/10 grid size-10 place-items-center rounded-xl">
            <Target className="size-5" />
          </span>
          <h2 className="mt-5 text-lg font-semibold">Keep it useful</h2>
          <ul className="text-background/65 mt-3 space-y-3 text-sm leading-6">
            <li className="flex gap-2">
              <Link2 className="mt-1 size-3.5 shrink-0" />
              Save the exact resource you will open.
            </li>
            <li className="flex gap-2">
              <Target className="mt-1 size-3.5 shrink-0" />
              Choose a goal you can repeat each week.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-1 size-3.5 shrink-0" />
              Add only the next few finishable steps.
            </li>
          </ul>
        </aside>
      </form>
    </main>
  );
}
