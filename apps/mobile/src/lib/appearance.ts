import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { DeviceEventEmitter, useColorScheme } from "react-native";

export type AppearancePreference = "system" | "light" | "dark";
export const APPEARANCE_CHANGED_EVENT = "kasa:appearance-changed";
const APPEARANCE_KEY = "kasa.appearance";

export async function getAppearancePreference(): Promise<AppearancePreference> {
  const value = await SecureStore.getItemAsync(APPEARANCE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export async function setAppearancePreference(value: AppearancePreference) {
  await SecureStore.setItemAsync(APPEARANCE_KEY, value);
  DeviceEventEmitter.emit(APPEARANCE_CHANGED_EVENT, value);
}

/** The one resolved colour mode used by the app shell and every screen. */
export function useResolvedAppearanceScheme(): "light" | "dark" {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<AppearancePreference>("system");

  useEffect(() => {
    void getAppearancePreference().then(setPreference);
    const subscription = DeviceEventEmitter.addListener(
      APPEARANCE_CHANGED_EVENT,
      setPreference,
    );
    return () => subscription.remove();
  }, []);

  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemScheme === "dark" ? "dark" : "light";
}
