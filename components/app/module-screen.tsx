import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { ProductModule } from "@/lib/app-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ModuleScreen({ module }: { module: ProductModule }) {
  const Icon = module.icon;

  return (
    <main className="relative pb-6">
      <div className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-80 overflow-hidden">
        <div className="bg-brand/10 absolute -top-24 left-1/3 size-80 rounded-full blur-[110px]" />
      </div>

      <section className="surface-glass relative overflow-hidden rounded-[2rem] border p-6 sm:p-8 xl:p-10">
        <div className="border-brand/10 absolute -top-32 -right-24 size-80 rounded-full border" />
        <div className="border-brand/10 absolute -top-16 -right-12 size-52 rounded-full border" />
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <Badge
              variant="outline"
              className="border-brand/20 bg-brand-soft/65 text-brand shadow-none"
            >
              <Icon data-icon="inline-start" /> {module.eyebrow}
            </Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl xl:text-6xl">
              {module.name}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7 sm:text-lg">
              {module.description}
            </p>
          </div>
          <Button
            size="lg"
            className="shadow-brand h-12 shrink-0 rounded-xl px-5"
          >
            <Plus /> {module.primaryAction}
          </Button>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {module.metrics.map((metric, index) => (
          <article
            key={metric.label}
            className="surface-glass rounded-2xl border p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-muted-foreground text-sm font-medium">
                {metric.label}
              </p>
              <span
                className={
                  index === 0
                    ? module.accent +
                      " flex size-8 items-center justify-center rounded-xl"
                    : "bg-surface-soft text-muted-foreground flex size-8 items-center justify-center rounded-xl"
                }
              >
                {index === 0 ? (
                  <Icon className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
              {metric.value}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {metric.detail}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid items-start gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="surface-glass rounded-[1.75rem] border p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                Start with what matters
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                A calm path into {module.name.toLowerCase()}.
              </p>
            </div>
            <span
              className={
                module.accent +
                " flex size-11 items-center justify-center rounded-2xl"
              }
            >
              <Icon className="size-5" />
            </span>
          </div>
          <div className="divide-border/65 mt-5 divide-y">
            {module.focus.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className="group flex w-full items-center gap-4 py-4 text-left"
              >
                <span className="bg-surface-soft text-muted-foreground group-hover:bg-brand-soft group-hover:text-brand flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold transition-colors">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold sm:text-base">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs sm:text-sm">
                    {item.detail}
                  </span>
                </span>
                <Badge variant="secondary" className="hidden sm:flex">
                  {item.status}
                </Badge>
                <ChevronRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </article>

        <div className="grid gap-4">
          <article className="brand-gradient text-brand-foreground shadow-brand relative overflow-hidden rounded-[1.75rem] p-6">
            <Sparkles className="text-brand-foreground/85 size-5" />
            <p className="text-brand-foreground/70 mt-5 text-xs font-semibold tracking-[0.13em] uppercase">
              KASA insight
            </p>
            <p className="mt-3 text-lg leading-7 font-semibold">
              {module.insight}
            </p>
            <div className="text-brand-foreground/75 mt-6 flex items-center gap-2 text-xs">
              <ShieldCheck className="size-4" /> Private and personalized
            </div>
          </article>

          <Link
            href="/app/inbox"
            className="surface-glass hover:border-brand/40 group flex items-center gap-4 rounded-[1.5rem] border p-5 transition-colors"
          >
            <span className="bg-brand-soft text-brand flex size-11 items-center justify-center rounded-2xl">
              <Plus className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                Capture something
              </span>
              <span className="text-muted-foreground mt-1 block text-xs">
                KASA will find the right place.
              </span>
            </span>
            <ChevronRight className="text-muted-foreground group-hover:text-brand size-4" />
          </Link>

          <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
            <Clock3 className="size-4" /> Proactive reminders activate as you
            add information.
          </div>
        </div>
      </section>
    </main>
  );
}
