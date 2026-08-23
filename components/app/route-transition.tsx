"use client";

/*
 * Route transition feedback
 *
 * The /app subtree resolves the session on the server, so a navigation cannot
 * complete until that round trip finishes. Without feedback the UI looks frozen
 * for a moment after a click. `useLinkStatus` reports the pending state of the
 * clicked <Link>, which we lift into context so a single top progress bar can
 * represent any link in the shell.
 *
 * Feedback is deliberately limited to the top bar. This covers the gap between
 * the click and the history update; app/app/loading.tsx then shows the spinner
 * while the page streams, and the screen animates itself in on arrival. An
 * overlay over the content area was tried here and removed: its backdrop hid
 * the content's own enter animation, so the page appeared already settled the
 * moment the overlay lifted.
 */

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLinkStatus } from "next/link";

import { TopProgressBar } from "@/components/app/top-progress-bar";

type RouteTransitionContextValue = {
  navigating: boolean;
  startNavigation: () => void;
  endNavigation: () => void;
};

const noop = () => {};

/*
 * Defaults are inert rather than throwing: a navigation link rendered outside
 * the provider should silently lose its indicator, never break the page.
 */
const RouteTransitionContext = createContext<RouteTransitionContextValue>({
  navigating: false,
  startNavigation: noop,
  endNavigation: noop,
});

function useRouteTransition() {
  return useContext(RouteTransitionContext);
}

export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  /*
   * A count rather than a boolean. Links can hand off to each other — the
   * mobile sheet closes on click and unmounts its link while a new one becomes
   * pending — and a count keeps the indicator continuous across that overlap.
   */
  const [pendingLinks, setPendingLinks] = useState(0);

  const startNavigation = useCallback(
    () => setPendingLinks((count) => count + 1),
    [],
  );

  const endNavigation = useCallback(
    () => setPendingLinks((count) => Math.max(0, count - 1)),
    [],
  );

  return (
    <RouteTransitionContext.Provider
      value={{ navigating: pendingLinks > 0, startNavigation, endNavigation }}
    >
      {children}
    </RouteTransitionContext.Provider>
  );
}

/*
 * Renders nothing — it only reports its parent <Link>'s pending state upward,
 * synchronising the router's state into React. Drawing no markup keeps it
 * immune to the layout shift that inline indicators usually introduce.
 * Must be a descendant of a <Link>.
 */
export function LinkPendingSignal() {
  const { startNavigation, endNavigation } = useRouteTransition();
  const { pending } = useLinkStatus();

  useEffect(() => {
    if (!pending) return;
    startNavigation();
    /*
     * Cleanup covers both outcomes: pending flipping back to false, and this
     * link unmounting mid-navigation. Either way the count is released.
     */
    return endNavigation;
  }, [pending, startNavigation, endNavigation]);

  return null;
}

/* Indeterminate bar pinned to the top of the viewport. */
export function RouteProgressBar() {
  const { navigating } = useRouteTransition();

  if (!navigating) return null;

  return <TopProgressBar />;
}
