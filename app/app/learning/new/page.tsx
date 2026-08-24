import type { Metadata } from "next";

import { LearningTrackForm } from "@/components/app/learning-track-form";

export const metadata: Metadata = {
  title: "Add learning track",
  description: "Create a focused learning track.",
};

export default function NewLearningTrackPage() {
  return <LearningTrackForm />;
}
