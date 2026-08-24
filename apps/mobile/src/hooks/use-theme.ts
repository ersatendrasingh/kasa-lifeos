/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from "@/constants/theme";
import { useResolvedAppearanceScheme } from "@/lib/appearance";

export function useTheme() {
  return Colors[useResolvedAppearanceScheme()];
}
