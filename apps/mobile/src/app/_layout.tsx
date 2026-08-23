import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { DeviceEventEmitter, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Colors } from "@/constants/theme";
import { AUTH_REQUIRED_EVENT } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      () => router.push("/notifications"),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let handling = false;
    const subscription = DeviceEventEmitter.addListener(
      AUTH_REQUIRED_EVENT,
      () => {
        if (handling) return;
        handling = true;
        void authClient
          .signOut()
          .catch(() => undefined)
          .finally(() => router.replace("/sign-in"));
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider
        value={{
          ...(dark ? DarkTheme : DefaultTheme),
          colors: {
            ...(dark ? DarkTheme.colors : DefaultTheme.colors),
            background: dark ? Colors.dark.background : Colors.light.background,
            primary: dark ? Colors.dark.brand : Colors.light.brand,
            card: dark ? Colors.dark.surface : Colors.light.surface,
          },
        }}
      >
        <StatusBar style={dark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(auth)/sign-in" />
          <Stack.Screen
            name="profile"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="edit-profile"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="integrations"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="notifications"
            options={{ animation: "slide_from_right" }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
