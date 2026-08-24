"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Flag,
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
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { RouteContentLoader } from "@/components/app/route-content-loader";

type Mission = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  milestones: Array<{ id: string; title: string; completedAt: string | null }>;
};
const categories = [
  "Career",
  "Financial",
  "Health",
  "Learning",
  "Personal",
  "Travel",
  "Family",
  "Business",
];
function progress(mission: Mission) {
  if (mission.targetValue)
    return Math.min(
      100,
      Math.round(((mission.currentValue ?? 0) / mission.targetValue) * 100),
    );
  if (mission.milestones.length)
    return Math.round(
      (mission.milestones.filter((item) => item.completedAt).length /
        mission.milestones.length) *
        100,
    );
  return 0;
}

export function GrowthWorkspace() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [create, setCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Career");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function loadMissions() {
      setLoading(true);
      try {
        const response = await fetch("/api/missions");
        if (!response.ok) throw new Error();
        const payload = await response.json();
        if (!cancelled) setMissions(payload.missions);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMissions();
    return () => {
      cancelled = true;
    };
  }, []);
  async function save() {
    if (title.trim().length < 2) return;
    setSaving(true);
    try {
      const response = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          description: description.trim() || undefined,
          milestones: milestones
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setMissions((items) => [payload.mission, ...items]);
      setCreate(false);
      setTitle("");
      setDescription("");
      setMilestones("");
    } finally {
      setSaving(false);
    }
  }
  const average = useMemo(
    () =>
      missions.length
        ? Math.round(
            missions.reduce((sum, mission) => sum + progress(mission), 0) /
              missions.length,
          )
        : 0,
    [missions],
  );
  return (
    <main className="route-content-enter pb-10">
      <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-brand flex items-center gap-2 text-xs font-bold tracking-[.16em] uppercase">
            <Sparkles className="size-4" /> Active missions
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em] sm:text-5xl">
            Grow with direction.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
            Your goals are not loose wishes. They are missions—with the work,
            learning and milestones that move them forward.
          </p>
        </div>
        <Button
          size="lg"
          className="shadow-brand h-12 rounded-xl"
          onClick={() => setCreate(true)}
        >
          <Plus /> Start a mission
        </Button>
      </header>
      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <article className="bg-brand text-primary-foreground relative overflow-hidden rounded-[2rem] p-7 shadow-lg">
            <div className="border-primary-foreground/15 absolute -top-24 -right-18 size-64 rounded-full border-[2rem]" />
            <div className="relative">
              <p className="text-primary-foreground/70 text-xs font-bold tracking-[.14em] uppercase">
                Your forward motion
              </p>
              <p className="mt-3 text-6xl font-semibold tracking-[-.07em]">
                {average}%
              </p>
              <p className="text-primary-foreground/80 mt-2 text-sm">
                {missions.length
                  ? `${missions.length} active missions across your life.`
                  : "Start one meaningful mission and make it visible."}
              </p>
              <div className="bg-primary-foreground/25 mt-6 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary-foreground h-full rounded-full"
                  style={{ width: `${average}%` }}
                />
              </div>
            </div>
          </article>
          <div className="mt-7 flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">
              Your missions
            </h2>
            <span className="text-brand text-xs font-bold tracking-[.12em] uppercase">
              {missions.length} active
            </span>
          </div>
          {loading ? (
            <RouteContentLoader />
          ) : missions.length ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {missions.map((mission) => {
                const percent = progress(mission);
                return (
                  <article
                    key={mission.id}
                    className="bg-card rounded-[1.75rem] border p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <Badge variant="secondary">{mission.category}</Badge>
                      <span className="text-lg font-semibold">{percent}%</span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight">
                      {mission.title}
                    </h3>
                    <p className="text-muted-foreground mt-2 min-h-10 text-sm leading-5">
                      {mission.description ||
                        "Connect milestones, learning and work as you move."}
                    </p>
                    <Progress value={percent} className="mt-5 h-2" />
                    <div className="mt-5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {mission.milestones.length
                          ? `${mission.milestones.filter((item) => item.completedAt).length} of ${mission.milestones.length} milestones`
                          : "No milestones yet"}
                      </span>
                      <Button variant="ghost" size="sm" className="text-brand">
                        Open <ArrowRight />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-card/70 mt-4 grid min-h-72 place-items-center rounded-[2rem] border border-dashed p-8 text-center">
              <div>
                <Flag className="text-brand mx-auto size-8" />
                <h2 className="mt-4 text-xl font-semibold">
                  Start with your real next chapter
                </h2>
                <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
                  Career switch, a fitness goal, buying a home, or the product
                  you want to build—turn it into an active mission.
                </p>
              </div>
            </div>
          )}
        </div>
        <aside className="bg-foreground text-background h-fit rounded-[1.75rem] p-6">
          <p className="text-background/55 text-xs font-bold tracking-[.14em] uppercase">
            Mission engine
          </p>
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="bg-background/10 grid size-9 place-items-center rounded-xl">
                <Target className="size-4" />
              </span>
              <span className="text-sm font-medium">Goal</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-background/10 grid size-9 place-items-center rounded-xl">
                <CheckCircle2 className="size-4" />
              </span>
              <span className="text-sm font-medium">Milestones</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-background/10 grid size-9 place-items-center rounded-xl">
                <Sparkles className="size-4" />
              </span>
              <span className="text-sm font-medium">Learning & skills</span>
            </div>
          </div>
          <p className="text-background/65 mt-6 text-sm leading-6">
            Every mission will become the home for related tasks, resources,
            people and progress—not another disconnected goal list.
          </p>
        </aside>
      </section>
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Start a mission</DialogTitle>
            <DialogDescription>
              Name the bigger thing you are building. Milestones make the next
              steps visible.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Become Full Stack Architect"
              className="h-12 rounded-xl"
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Why this matters (optional)"
              className="min-h-22 rounded-xl"
            />
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <Button
                  key={item}
                  variant={category === item ? "default" : "secondary"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setCategory(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
            <Textarea
              value={milestones}
              onChange={(event) => setMilestones(event.target.value)}
              placeholder={
                "Optional milestones — one per line\nFinish portfolio\nComplete system design course"
              }
              className="min-h-28 rounded-xl"
            />
            <Button
              disabled={saving || title.trim().length < 2}
              onClick={() => void save()}
              className="h-12 rounded-xl"
            >
              {saving ? <Spinner /> : <Plus />} Create mission
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
