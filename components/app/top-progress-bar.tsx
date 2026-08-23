/*
 * Indeterminate top progress bar.
 *
 * Deliberately free of hooks and the "use client" directive so it can render
 * from a server component (the loading.tsx fallbacks, covering first load and
 * streaming) as well as from the client shell during a click-time transition.
 * The animation is pure CSS, so it runs before hydration.
 */
export function TopProgressBar() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5"
    >
      <div className="route-progress route-progress-visible">
        <div className="route-progress-bar" />
      </div>
    </div>
  );
}
