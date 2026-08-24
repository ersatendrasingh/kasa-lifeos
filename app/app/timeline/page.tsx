import type { Metadata } from "next";
import { TimelineWorkspace } from "@/components/app/timeline-workspace";
export const metadata: Metadata = { title: "Timeline", description: "Your private life history." };
export default function TimelinePage() { return <TimelineWorkspace />; }
