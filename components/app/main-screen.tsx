"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Circle,
  Clock3,
  Flame,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";

import type { FocusItem, MainScreenData } from "@/lib/main-screen-data";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type MainScreenProps = {
  initialData: MainScreenData;
};

const kindStyles: Record<FocusItem["kind"], string> = {
  habit: "bg-positive-soft text-positive",
  event: "bg-info-soft text-info",
  task: "bg-brand-soft text-brand-strong dark:text-brand",
};

export function MainScreen({ initialData }: MainScreenProps) {
  const [items, setItems] = useState(initialData.focusItems);

  const completedCount = useMemo(
    () => items.filter((item) => item.status === "done").length,
    [items],
  );

  function toggleItem(id: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "done" ? "pending" : "done" }
          : item,
      ),
    );
  }

  return (
    <main className="route-content-enter relative pb-4 lg:pb-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="border-brand/15 absolute -top-52 right-[-14rem] size-[38rem] rounded-full border" />
        <div className="border-brand/20 absolute -top-36 right-[-8rem] size-[26rem] rounded-full border" />
        {/*
          Sits fully inside this overflow-hidden layer and fades to transparent
          at its own bounds, so nothing is ever clipped mid-glow.
        */}
        <div className="ambient-glow absolute top-0 left-0 size-[32rem] max-w-full" />
      </div>

      <div className="relative w-full">
        <section className="pb-7 sm:pb-9">
          <p className="text-muted-foreground mb-2 text-sm font-medium">
            {initialData.dateLabel}
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
            {initialData.greeting}
            {initialData.user.firstName
              ? `, ${initialData.user.firstName}`
              : ""}{" "}
            <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base">
            Here’s the shape of your day. Keep the rhythm going.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="surface-glass rounded-[1.75rem] border p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
                  <Target className="text-brand size-4" /> Today’s Score
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
                    {initialData.score}
                  </span>
                  <span className="text-muted-foreground mb-2 text-lg font-medium">
                    %
                  </span>
                </div>
              </div>
              <Badge className="bg-positive-soft text-positive border-0 shadow-none">
                Strong day
              </Badge>
            </div>
            <Progress
              value={initialData.score}
              aria-label={`Today’s score: ${initialData.score}%`}
              className="progress-brand bg-brand-soft mt-6 h-2.5"
            />
            <div className="text-muted-foreground mt-3 flex justify-between text-xs">
              <span>Your daily balance</span>
              <span>8 points above average</span>
            </div>
          </article>

          <article className="brand-gradient text-brand-foreground shadow-brand relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7">
            <div className="border-brand-foreground/20 absolute -right-10 -bottom-16 size-44 rounded-full border" />
            <div className="border-brand-foreground/20 absolute -right-3 -bottom-8 size-28 rounded-full border" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-brand-foreground/75 text-sm font-semibold">
                  Current streak
                </span>
                <span className="bg-brand-foreground/15 flex size-10 items-center justify-center rounded-2xl">
                  <Flame className="fill-brand-foreground text-brand-foreground size-5" />
                </span>
              </div>
              <p className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                {initialData.streakDays} days
              </p>
              <p className="text-brand-foreground/75 mt-2 text-sm">
                Your longest rhythm yet. Keep showing up.
              </p>
              <div
                className="mt-6 flex gap-1.5"
                aria-label="Seven active streak days"
              >
                {Array.from({ length: 7 }).map((_, index) => (
                  <span
                    key={index}
                    className="bg-brand-foreground/85 h-1.5 flex-1 rounded-full"
                  />
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_0.55fr]">
          <article className="surface-glass rounded-[1.75rem] border p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                  Today’s Focus
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {completedCount} of {items.length} complete
                </p>
              </div>
              <div className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-2xl">
                <Sparkles className="size-5" />
              </div>
            </div>

            <div className="divide-border/65 mt-5 divide-y">
              {items.map((item) => {
                const isDone = item.status === "done";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="group flex w-full items-center gap-3 py-3.5 text-left sm:gap-4"
                    aria-label={`${isDone ? "Mark incomplete" : "Mark complete"}: ${item.title}`}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border transition-all",
                        isDone
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-brand/30 bg-brand-soft/50 text-brand/50 group-hover:border-brand/70",
                      )}
                    >
                      {isDone ? (
                        <Check className="size-4" />
                      ) : (
                        <Circle className="size-3" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block font-medium transition-colors",
                          isDone &&
                            "text-muted-foreground decoration-brand/45 line-through",
                        )}
                      >
                        {item.title}
                      </span>
                      {item.detail && (
                        <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                          {item.status === "pending" &&
                          item.detail.toLowerCase().includes("today") ? (
                            <Clock3 className="text-brand size-3" />
                          ) : null}
                          {item.detail}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "hidden rounded-full px-2.5 py-1 text-[0.65rem] font-semibold capitalize sm:block",
                        kindStyles[item.kind],
                      )}
                    >
                      {item.kind}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>

          <Link
            href="/app/inbox"
            className="border-brand/40 bg-brand-soft/55 hover:border-brand/70 hover:bg-brand-soft group hover:shadow-brand flex min-h-48 flex-col items-center justify-center rounded-[1.75rem] border border-dashed p-7 text-center transition-all hover:-translate-y-0.5 lg:min-h-full"
          >
            <span className="bg-card text-brand shadow-float flex size-16 items-center justify-center rounded-[1.35rem] transition-transform group-hover:scale-105">
              <Plus className="size-7" strokeWidth={2.25} />
            </span>
            <h2 className="mt-5 text-lg font-semibold">Quick Capture</h2>
            <p className="text-muted-foreground mt-2 max-w-48 text-sm leading-6">
              Catch anything. KASA will sort it for you.
            </p>
            <span className="text-brand mt-5 text-xs font-semibold tracking-[0.12em] uppercase">
              Open Smart Inbox
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
