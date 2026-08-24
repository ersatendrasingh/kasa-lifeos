import type { Metadata } from "next";
import { GrowthWorkspace } from "@/components/app/growth-workspace";
export const metadata: Metadata = { title: "Growth", description: "Your active missions and direction." };
export default function GrowthPage() { return <GrowthWorkspace />; }
