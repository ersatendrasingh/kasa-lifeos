import { cn } from "@/lib/utils";

type KasaMarkProps = {
  className?: string;
  priority?: "primary" | "quiet";
};

export function KasaMark({ className, priority = "primary" }: KasaMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width="96"
        height="96"
        rx="27"
        fill={priority === "primary" ? "var(--brand)" : "var(--brand-soft)"}
      />
      <path
        d="M30 22V74M33 52L65 22M45 44L68 74"
        stroke="var(--brand-foreground)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 58.5C26 78 49.5 87.5 69.5 76.5C81.5 70 87 57 85 45"
        stroke="var(--brand-foreground)"
        strokeOpacity="0.32"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="84" cy="39" r="3.5" fill="var(--brand-highlight)" />
    </svg>
  );
}

type KasaLogoProps = {
  className?: string;
  markClassName?: string;
  compact?: boolean;
};

export function KasaLogo({
  className,
  markClassName,
  compact = false,
}: KasaLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <KasaMark className={cn("size-10", markClassName)} />
      {!compact && (
        <span className="flex items-baseline gap-2 leading-none">
          <span className="font-heading text-xl font-bold tracking-[-0.055em]">
            KASA
          </span>
          <span className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
            Life OS
          </span>
        </span>
      )}
    </span>
  );
}
