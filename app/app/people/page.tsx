import type { Metadata } from "next";
import { PeopleWorkspace } from "@/components/app/people-workspace";
export const metadata: Metadata = { title: "People", description: "Your relationship memory." };
export default function PeoplePage() { return <PeopleWorkspace />; }
