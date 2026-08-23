import {
  BookOpen,
  BriefcaseBusiness,
  HeartPulse,
  Home,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";

const lifeAreas = [
  {
    label: "Health",
    icon: HeartPulse,
    x: 50,
    y: 15,
    tone: "text-danger bg-danger-soft",
  },
  {
    label: "Career",
    icon: BriefcaseBusiness,
    x: 82,
    y: 29,
    tone: "text-brand bg-brand-soft",
  },
  {
    label: "Money",
    icon: WalletCards,
    x: 82,
    y: 67,
    tone: "text-positive bg-positive-soft",
  },
  {
    label: "Learning",
    icon: BookOpen,
    x: 61,
    y: 90,
    tone: "text-info bg-info-soft",
  },
  {
    label: "Home",
    icon: Home,
    x: 20,
    y: 78,
    tone: "text-warning bg-warning-soft",
  },
  {
    label: "People",
    icon: UsersRound,
    x: 18,
    y: 39,
    tone: "text-brand bg-brand-soft",
  },
] as const;

export function LifeOrbit() {
  return (
    <div
      className="auth-visual-enter relative mx-auto aspect-square w-full max-w-[30rem]"
      aria-label="Your life areas connected around you"
    >
      <div className="bg-brand/12 absolute inset-[12%] rounded-full blur-3xl" />
      <svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        className="absolute inset-0 size-full overflow-visible"
      >
        <circle
          className="auth-orbit-ring stroke-border"
          cx="200"
          cy="200"
          r="145"
          fill="none"
          strokeWidth="1"
        />
        <circle
          className="auth-orbit-ring auth-orbit-ring-reverse stroke-brand/25"
          cx="200"
          cy="200"
          r="108"
          fill="none"
          strokeWidth="1.5"
        />
        {lifeAreas.map((area) => (
          <line
            key={area.label}
            className="auth-life-line stroke-brand/25"
            x1="200"
            y1="200"
            x2={area.x * 4}
            y2={area.y * 4}
            strokeWidth="1.2"
          />
        ))}
      </svg>

      <div className="auth-center-pulse border-brand/20 bg-card shadow-float absolute top-1/2 left-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border">
        <span className="brand-gradient text-brand-foreground shadow-brand flex size-12 items-center justify-center rounded-2xl">
          <UserRound className="size-6" />
        </span>
        <span className="mt-2 text-xs font-bold">Your life</span>
      </div>

      {lifeAreas.map((area, index) => {
        const Icon = area.icon;
        return (
          <div
            key={area.label}
            className="auth-life-node absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${area.x}%`,
              top: `${area.y}%`,
              animationDelay: `${180 + index * 90}ms`,
            }}
          >
            <div className="border-border/80 bg-card/92 shadow-float flex items-center gap-2 rounded-2xl border p-2 pr-3 backdrop-blur-xl">
              <span
                className={`flex size-8 items-center justify-center rounded-xl ${area.tone}`}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-[0.68rem] font-bold whitespace-nowrap">
                {area.label}
              </span>
            </div>
          </div>
        );
      })}

      <div className="auth-sparkle text-brand absolute top-[17%] left-[26%]">
        <Sparkles className="size-4" />
      </div>
      <div className="auth-sparkle text-brand absolute right-[23%] bottom-[18%] [animation-delay:700ms]">
        <Sparkles className="size-3" />
      </div>
    </div>
  );
}
