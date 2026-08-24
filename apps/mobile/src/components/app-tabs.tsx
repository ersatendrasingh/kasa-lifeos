import { usePathname } from "expo-router";

import SmartInboxScreen from "../app/(app)/inbox";
import TodayScreen from "../app/(app)/index";
import TimelineScreen from "../app/(app)/timeline";

/**
 * The home screen is now the navigation hub. This small route switch keeps
 * the grouped Capture and Timeline screens available without a tab dock.
 */
export default function AppTabs() {
  const pathname = usePathname();

  if (pathname === "/inbox") return <SmartInboxScreen />;
  if (pathname === "/timeline") return <TimelineScreen />;
  return <TodayScreen />;
}
