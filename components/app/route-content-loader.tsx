import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * The single loading treatment for every authenticated web screen.
 * Route fallbacks and client-side data refreshes intentionally share this so
 * a screen never introduces a competing loader.
 */
export function RouteContentLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "route-loader flex min-h-[60vh] items-center justify-center",
        className,
      )}
    >
      <Spinner className="text-brand size-7" />
    </div>
  );
}
