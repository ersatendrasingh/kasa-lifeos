import { TopProgressBar } from "@/components/app/top-progress-bar";
import { Spinner } from "@/components/ui/spinner";

/*
 * Root fallback, shown on first load and hard refresh before any segment has
 * resolved. The progress bar matches the one used during route transitions so
 * loading feels consistent whether the user arrived by click or by refresh.
 */
export default function AppLoading() {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center">
      <TopProgressBar />
      <Spinner className="text-brand size-8" />
    </main>
  );
}
