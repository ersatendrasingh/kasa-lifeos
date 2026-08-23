import { TopProgressBar } from "@/components/app/top-progress-bar";
import { Spinner } from "@/components/ui/spinner";

/*
 * Suspense fallback for the /app subtree.
 *
 * ProtectedAppLayout awaits the session before rendering, which makes this
 * subtree dynamic. Without a fallback at this level the router has nothing to
 * show and holds the previous screen until the server responds, so navigation
 * feels unresponsive. Declaring this file lets Next.js swap in the fallback
 * immediately and keeps navigation interruptible while the page streams.
 *
 * The spinner is centred in the viewport rather than pinned near the top so it
 * does not sit in the same place the incoming content animates through — the
 * screen's enter animation then reads as the content arriving, not as the
 * spinner turning into content.
 */
export default function AppSectionLoading() {
  return (
    <>
      <TopProgressBar />
      <div className="route-loader flex min-h-[60vh] items-center justify-center">
        <Spinner className="text-brand size-7" />
      </div>
    </>
  );
}
