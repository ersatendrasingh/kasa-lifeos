import { SymbolView } from "expo-symbols";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  AppState,
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AppTabs from "@/components/app-tabs";
import { KasaSpinner } from "@/components/kasa-spinner";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import {
  shouldRequestBiometricUnlock,
  unlockWithBiometrics,
} from "@/lib/biometric-unlock";
import {
  ensureNotificationPermission,
  NOTIFICATION_CHANGED_EVENT,
  syncLocalNotifications,
} from "@/lib/notifications";

type UnlockState = "checking" | "unlocked" | "locked";

export default function ProtectedAppLayout() {
  const colors = useTheme();
  const { data: session, isPending } = authClient.useSession();
  const [unlockState, setUnlockState] = useState<UnlockState>("checking");

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;

    async function verifyAppOwner() {
      try {
        const required = await shouldRequestBiometricUnlock();
        if (!active) return;
        if (!required) {
          setUnlockState("unlocked");
          return;
        }
        const unlocked = await unlockWithBiometrics();
        if (active) setUnlockState(unlocked ? "unlocked" : "locked");
      } catch {
        if (active) setUnlockState("locked");
      }
    }

    void verifyAppOwner();
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || unlockState !== "unlocked") return;
    const sync = () => {
      void ensureNotificationPermission()
        .then(() => syncLocalNotifications())
        .then(() => DeviceEventEmitter.emit(NOTIFICATION_CHANGED_EVENT))
        .catch(() => undefined);
    };
    sync();
    const interval = setInterval(sync, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [session?.user.id, unlockState]);

  if (isPending || (session?.user && unlockState === "checking")) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <KasaSpinner size={30} />
      </View>
    );
  }

  if (!session?.user) return <Redirect href="/sign-in" />;
  if (unlockState === "locked") {
    return (
      <View style={[styles.lockScreen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.faceIcon,
            { backgroundColor: colors.brandSoft, borderColor: colors.border },
          ]}
        >
          <SymbolView name="faceid" size={40} tintColor={colors.brand} />
        </View>
        <Text style={[styles.lockTitle, { color: colors.text }]}>
          KASA is locked
        </Text>
        <Text style={[styles.lockMessage, { color: colors.textSecondary }]}>
          Use Face ID to open your private LifeOS.
        </Text>
        <Pressable
          onPress={async () => {
            setUnlockState("checking");
            const unlocked = await unlockWithBiometrics().catch(() => false);
            setUnlockState(unlocked ? "unlocked" : "locked");
          }}
          style={({ pressed }) => [
            styles.unlockButton,
            { backgroundColor: colors.brand, opacity: pressed ? 0.76 : 1 },
          ]}
        >
          <SymbolView name="faceid" size={19} tintColor="#FFFFFF" />
          <Text style={styles.unlockButtonText}>Unlock with Face ID</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await authClient.signOut();
            router.replace("/sign-in");
          }}
        >
          <Text
            style={[styles.anotherAccount, { color: colors.textSecondary }]}
          >
            Use another account
          </Text>
        </Pressable>
      </View>
    );
  }
  return <AppTabs />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  faceIcon: {
    width: 82,
    height: 82,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  lockTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -1.2 },
  lockMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  unlockButton: {
    height: 52,
    minWidth: 230,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 22,
  },
  unlockButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  anotherAccount: { marginTop: 20, fontSize: 13, fontWeight: "700" },
});
