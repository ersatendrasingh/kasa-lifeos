"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Inbox, LogOut, Menu, Plus, Search } from "lucide-react";

import { signOutAction } from "@/app/app/actions";
import { KasaLogo } from "@/components/brand/kasa-logo";
import {
  LinkPendingSignal,
  RouteProgressBar,
  RouteTransitionProvider,
} from "@/components/app/route-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navigationGroups } from "@/lib/app-navigation";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  user: { name?: string | null; email?: string | null; image?: string | null };
};

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "KASA";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function currentLabel(pathname: string) {
  for (const group of navigationGroups) {
    const item = group.items.find(({ href }) =>
      href === "/app" ? pathname === href : pathname.startsWith(href),
    );
    if (item) return item.name;
  }
  return "KASA";
}

function AppNavigation({
  pathname,
  mobile = false,
}: {
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <nav
      className={cn("space-y-6", mobile && "px-3 pb-6")}
      aria-label="Life areas"
    >
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="text-muted-foreground mb-2 px-3 text-[0.65rem] font-semibold tracking-[0.14em] uppercase">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active =
                item.href === "/app"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              const content = (
                <span
                  className={cn(
                    "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-soft text-brand"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon
                    className="size-4.5 shrink-0"
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {active ? (
                    <span className="bg-brand size-1.5 rounded-full" />
                  ) : null}
                </span>
              );

              return mobile ? (
                <SheetClose key={item.href} asChild>
                  <Link href={item.href}>
                    {content}
                    <LinkPendingSignal />
                  </Link>
                </SheetClose>
              ) : (
                <Link key={item.href} href={item.href}>
                  {content}
                  <LinkPendingSignal />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const userInitials = initials(user.name, user.email);
  const firstName = user.name?.split(" ")[0] || "You";

  return (
    <RouteTransitionProvider>
      <RouteProgressBar />
      <div className="bg-background text-foreground flex h-dvh overflow-hidden">
        <aside className="border-border/70 bg-card/55 hidden w-64 shrink-0 flex-col border-r backdrop-blur-xl lg:flex xl:w-72">
          <div className="flex h-20 items-center px-5">
            <Link href="/app" aria-label="KASA Today">
              <KasaLogo markClassName="size-9" />
              <LinkPendingSignal />
            </Link>
          </div>

          <div className="px-4 pb-5">
            <Button
              asChild
              className="shadow-brand h-11 w-full justify-start rounded-xl"
            >
              <Link href="/app/inbox">
                <Plus /> Quick capture
                <LinkPendingSignal />
              </Link>
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
            <AppNavigation pathname={pathname} />
          </div>

          <div className="border-border/70 border-t p-3">
            <div className="flex items-center gap-3 rounded-2xl p-2">
              <Avatar size="lg" className="bg-brand-soft">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback className="bg-brand-soft text-brand font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{firstName}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {user.email}
                </p>
              </div>
              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sign out"
                >
                  <LogOut />
                </Button>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-border/70 bg-background/82 z-30 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-6 lg:h-20 xl:px-8">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[19rem] gap-0 p-0">
                <SheetHeader className="border-border/70 border-b px-5 py-5 text-left">
                  <SheetTitle>
                    <KasaLogo markClassName="size-9" />
                  </SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto pt-5">
                  <AppNavigation pathname={pathname} mobile />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 lg:w-44">
              <p className="text-muted-foreground hidden text-[0.65rem] font-semibold tracking-[0.12em] uppercase lg:block">
                Your Life OS
              </p>
              <p className="truncate text-sm font-semibold lg:mt-0.5 lg:text-base">
                {currentLabel(pathname)}
              </p>
            </div>

            <div className="mx-auto hidden w-full max-w-xl md:block">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  readOnly
                  aria-label="Search KASA"
                  placeholder="Search your life..."
                  className="bg-surface-soft/60 h-10 rounded-xl border-transparent pl-10 shadow-none"
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open Smart Inbox"
              >
                <Link href="/app/inbox">
                  <Inbox />
                  <LinkPendingSignal />
                </Link>
              </Button>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label="Notifications"
              >
                <Bell />
                <span className="bg-brand absolute top-2.5 right-2.5 size-1.5 rounded-full" />
              </Button>
              <Avatar className="bg-brand-soft ml-1">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback className="bg-brand-soft text-brand text-xs font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[100rem] px-4 py-5 sm:px-6 sm:py-7 xl:px-8 xl:py-8">
              {children}
            </div>
          </div>

          <nav
            className="border-border/70 bg-card/92 grid h-16 shrink-0 grid-cols-4 border-t px-2 backdrop-blur-xl lg:hidden"
            aria-label="Primary mobile navigation"
          >
            {[
              ...navigationGroups[0].items.slice(0, 3),
              { name: "More", shortName: "More", href: "#more", icon: Menu },
            ].map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(item.href);
              if (item.href === "#more") {
                return (
                  <Sheet key="more">
                    <SheetTrigger className="text-muted-foreground flex flex-col items-center justify-center gap-1 text-[0.65rem] font-medium">
                      <Icon className="size-4.5" /> More
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[19rem] gap-0 p-0">
                      <SheetHeader className="border-border/70 border-b px-5 py-5 text-left">
                        <SheetTitle>
                          <KasaLogo markClassName="size-9" />
                        </SheetTitle>
                      </SheetHeader>
                      <div className="min-h-0 flex-1 overflow-y-auto pt-5">
                        <AppNavigation pathname={pathname} mobile />
                      </div>
                    </SheetContent>
                  </Sheet>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 text-[0.65rem] font-medium",
                    active ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4.5" /> {item.shortName}
                  <LinkPendingSignal />
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </RouteTransitionProvider>
  );
}
