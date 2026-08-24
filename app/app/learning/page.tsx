import type { Metadata } from "next";
import { LearningWorkspace } from "@/components/app/learning-workspace";

export const metadata: Metadata = {
  title: "Learning",
  description: "Your courses, practice, and growth system.",
};
export default function LearningPage() {
  return <LearningWorkspace />;
}
