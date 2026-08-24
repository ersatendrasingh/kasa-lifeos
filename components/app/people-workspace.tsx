"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Spinner } from "@/components/ui/spinner";
import { RouteContentLoader } from "@/components/app/route-content-loader";

type Person = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  category: string;
  favorite: boolean;
  trustLevel: number;
  lastContactAt: string | null;
  tags: unknown;
  _count?: { memories: number };
};
const categories = [
  "FAMILY",
  "FRIEND",
  "WORK",
  "DOCTOR",
  "HOME_SERVICE",
  "OTHER",
];
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function label(category: string) {
  return category
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PeopleWorkspace() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [create, setCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("FRIEND");
  useEffect(() => {
    let cancelled = false;
    async function loadPeople() {
      setLoading(true);
      try {
        const response = await fetch("/api/people");
        if (!response.ok) throw new Error();
        const payload = await response.json();
        if (!cancelled) setPeople(payload.people);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPeople();
    return () => {
      cancelled = true;
    };
  }, []);
  async function save() {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      const response = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          category: selectedCategory,
        }),
      });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setPeople((items) => [payload.person, ...items]);
      setCreate(false);
      setName("");
      setPhone("");
    } finally {
      setSaving(false);
    }
  }
  const filtered = useMemo(
    () =>
      people.filter(
        (person) =>
          (category === "ALL" || person.category === category) &&
          `${person.name} ${person.company ?? ""} ${person.role ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [people, category, query],
  );
  const favorites = people.filter((person) => person.favorite).slice(0, 5);
  return (
    <main className="route-content-enter pb-10">
      <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-brand flex items-center gap-2 text-xs font-bold tracking-[.16em] uppercase">
            <Sparkles className="size-4" /> Relationship memory
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em] sm:text-5xl">
            People, remembered.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
            The context, shared history and little details that help you show up
            for people well.
          </p>
        </div>
        <Button
          size="lg"
          className="shadow-brand h-12 rounded-xl"
          onClick={() => setCreate(true)}
        >
          <Plus /> Add a person
        </Button>
      </header>
      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          <div className="bg-card/75 flex flex-col gap-3 rounded-[1.5rem] border p-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search names, notes or work…"
                className="h-11 rounded-xl border-transparent bg-transparent pl-10 shadow-none"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {["ALL", ...categories].map((item) => (
                <Button
                  key={item}
                  variant={category === item ? "default" : "secondary"}
                  className="shrink-0 rounded-xl capitalize"
                  onClick={() => setCategory(item)}
                >
                  {item === "ALL" ? "All people" : label(item)}
                </Button>
              ))}
            </div>
          </div>
          {loading ? (
            <RouteContentLoader />
          ) : filtered.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((person) => (
                <article
                  key={person.id}
                  className="bg-card group rounded-[1.5rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <Avatar className="bg-brand-soft size-12">
                      <AvatarFallback className="bg-brand-soft text-brand font-semibold">
                        {initials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    {person.favorite && (
                      <Star className="text-brand size-4 fill-current" />
                    )}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold tracking-tight">
                    {person.name}
                  </h2>
                  <p className="text-muted-foreground mt-1 h-5 text-sm">
                    {person.role || person.company || label(person.category)}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant="secondary">{label(person.category)}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {person._count?.memories ?? 0} memories
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="flex-1 rounded-xl"
                      disabled={!person.phone}
                    >
                      {person.phone ? (
                        <a href={`tel:${person.phone}`}>
                          <Phone /> Call
                        </a>
                      ) : (
                        <span>
                          <Phone /> No phone
                        </span>
                      )}
                    </Button>
                    <Button
                      asChild
                      variant="secondary"
                      size="icon-sm"
                      className="rounded-xl"
                      disabled={!person.phone}
                    >
                      {person.phone ? (
                        <a
                          href={`sms:${person.phone}`}
                          aria-label={`Message ${person.name}`}
                        >
                          <MessageCircle />
                        </a>
                      ) : (
                        <span>
                          <MessageCircle />
                        </span>
                      )}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-card/70 mt-5 grid min-h-72 place-items-center rounded-[2rem] border border-dashed p-8 text-center">
              <div>
                <UsersRound className="text-brand mx-auto size-8" />
                <h2 className="mt-4 text-xl font-semibold">
                  Your circle starts with one person
                </h2>
                <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
                  Add family, friends, doctors and trusted services. Notes and
                  interactions will stay connected to their profile.
                </p>
              </div>
            </div>
          )}
        </div>
        <aside className="bg-foreground text-background h-fit rounded-[1.75rem] p-6">
          <div className="flex items-center justify-between">
            <p className="text-background/55 text-xs font-bold tracking-[.14em] uppercase">
              Your inner circle
            </p>
            <Heart className="text-brand size-4 fill-current" />
          </div>
          {favorites.length ? (
            <div className="mt-5 space-y-4">
              {favorites.map((person) => (
                <div key={person.id} className="flex items-center gap-3">
                  <Avatar className="bg-background/10 size-9">
                    <AvatarFallback className="bg-background/10 text-xs">
                      {initials(person.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {person.name}
                    </p>
                    <p className="text-background/55 truncate text-xs">
                      {person.lastContactAt
                        ? `Last contact ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(person.lastContactAt))}`
                        : "No interaction yet"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-background/65 mt-4 text-sm leading-6">
              Star the people you never want to lose track of. Their shared
              context will always be easy to find here.
            </p>
          )}
        </aside>
      </section>
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent className="rounded-[1.75rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Add a person</DialogTitle>
            <DialogDescription>
              Start with the basics. Add memories, notes and reminders whenever
              they become useful.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
              className="h-12 rounded-xl"
            />
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              placeholder="Phone number (optional)"
              className="h-12 rounded-xl"
            />
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <Button
                  key={item}
                  variant={selectedCategory === item ? "default" : "secondary"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setSelectedCategory(item)}
                >
                  {label(item)}
                </Button>
              ))}
            </div>
            <Button
              disabled={saving || name.trim().length < 2}
              onClick={() => void save()}
              className="h-12 rounded-xl"
            >
              {saving ? <Spinner /> : <Plus />} Create relationship profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
