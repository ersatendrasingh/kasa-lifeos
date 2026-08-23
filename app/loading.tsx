import { Spinner } from "@/components/ui/spinner";

export default function AppLoading() {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center">
      <Spinner className="text-brand size-8" />
    </main>
  );
}
