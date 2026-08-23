import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  HeartPulse,
  Orbit,
  Sparkles,
} from "lucide-react";

import { KasaLogo, KasaMark } from "@/components/brand/kasa-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const lifeAreas = [
  { label: "Health", icon: HeartPulse, color: "bg-danger-soft text-danger" },
  { label: "Mind", icon: Brain, color: "bg-info-soft text-info" },
  { label: "Time", icon: CalendarDays, color: "bg-warning-soft text-warning" },
];

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="border-brand/15 absolute top-[-18rem] right-[-12rem] size-[42rem] rounded-full border" />
        <div className="border-brand/20 absolute top-[-12rem] right-[-6rem] size-[29rem] rounded-full border" />
        <div className="bg-brand/10 absolute top-32 left-[-18rem] size-[32rem] rounded-full blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex h-24 items-center justify-between">
          <Link href="/" aria-label="KASA home">
            <KasaLogo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:block">
              Your life, one system
            </span>
            <ThemeToggle />
            <Button
              asChild
              variant="outline"
              className="bg-background/60 rounded-full px-5 backdrop-blur"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-14 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
          <div className="max-w-3xl">
            <Badge
              className="border-brand/25 bg-brand-soft/80 text-brand-strong dark:text-brand shadow-none"
              variant="outline"
            >
              <Sparkles data-icon="inline-start" /> A calmer way to live
            </Badge>
            <h1 className="mt-7 text-[clamp(3.4rem,7.8vw,7.25rem)] leading-[0.88] font-semibold tracking-[-0.075em] text-balance">
              Your life,
              <span className="brand-text-gradient block">in rhythm.</span>
            </h1>
            <p className="text-muted-foreground mt-7 max-w-xl text-lg leading-8 text-pretty sm:text-xl">
              KASA brings your health, time, goals, relationships, and growth
              into one thoughtful personal operating system.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="shadow-brand rounded-full px-7"
              >
                <Link href="/sign-in">
                  Begin with KASA
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <span className="text-muted-foreground text-sm">
                Built around you. Always private.
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[31rem] py-10">
            <div className="bg-brand/20 absolute inset-8 rounded-full blur-3xl" />
            <div className="surface-glass relative rounded-[2.5rem] border p-4">
              <div className="surface-gradient border-border rounded-[1.9rem] border p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                      Today
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                      Good morning, you.
                    </h2>
                  </div>
                  <KasaMark className="shadow-brand size-12" />
                </div>

                <div className="mt-9 flex items-center justify-center py-3">
                  <div className="border-brand/30 bg-card/70 relative flex size-52 items-center justify-center rounded-full border shadow-inner">
                    <div className="border-brand/45 absolute inset-4 rounded-full border border-dashed" />
                    <div className="bg-brand shadow-brand absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full" />
                    <div className="text-center">
                      <span className="text-5xl font-semibold tracking-[-0.06em]">
                        82
                      </span>
                      <p className="text-muted-foreground mt-1 text-xs font-medium tracking-widest uppercase">
                        Life flow
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-3 gap-2.5">
                  {lifeAreas.map(({ label, icon: Icon, color }) => (
                    <div
                      key={label}
                      className="border-border/70 bg-card/80 rounded-2xl border p-3 shadow-sm"
                    >
                      <span
                        className={`flex size-8 items-center justify-center rounded-xl ${color}`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <p className="mt-3 text-sm font-medium">{label}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        In balance
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-border bg-card/90 shadow-float absolute -right-2 bottom-5 flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium sm:-right-10">
              <Orbit className="text-brand size-4" /> One connected life
            </div>
          </div>
        </section>

        <footer className="text-muted-foreground border-border/70 flex flex-col gap-2 border-t py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 KASA — Life OS</span>
          <span>Designed for the whole human, not just the to-do list.</span>
        </footer>
      </div>
    </main>
  );
}
