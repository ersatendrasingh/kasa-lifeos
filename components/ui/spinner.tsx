import { cn } from "@/lib/utils";

const APPLE_SPINNER_SEGMENTS = Array.from({ length: 12 }, (_, index) => index);

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("apple-spinner size-4 shrink-0", className)}
      {...props}
    >
      {APPLE_SPINNER_SEGMENTS.map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="apple-spinner-segment"
          style={{ "--apple-spinner-index": index } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

export { Spinner };
