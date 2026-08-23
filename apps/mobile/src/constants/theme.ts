/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#251814",
    background: "#FFF8F4",
    surface: "#FFFFFF",
    backgroundElement: "#FFF0E8",
    backgroundSelected: "#FFE1D2",
    textSecondary: "#826E65",
    border: "#F1D9CD",
    brand: "#FF4F1F",
    brandStrong: "#E53B0D",
    brandSoft: "#FFF0E8",
    positive: "#159B62",
    warning: "#D47A00",
  },
  dark: {
    text: "#FFF9F5",
    background: "#090706",
    surface: "#18110F",
    backgroundElement: "#261713",
    backgroundSelected: "#3A2119",
    textSecondary: "#B9A79E",
    border: "#40291F",
    brand: "#FF6338",
    brandStrong: "#FF7A52",
    brandSoft: "#351A12",
    positive: "#49D092",
    warning: "#FFAD3D",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
