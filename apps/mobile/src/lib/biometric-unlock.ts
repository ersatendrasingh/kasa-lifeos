import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const LAST_UNLOCK_KEY = "kasa.biometric.last-unlock";
const AUTH_GRACE_PERIOD_MS = 60_000;

export async function markBiometricUnlock() {
  await SecureStore.setItemAsync(LAST_UNLOCK_KEY, String(Date.now()));
}

export async function shouldRequestBiometricUnlock() {
  const [hasHardware, isEnrolled, lastUnlock] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    SecureStore.getItemAsync(LAST_UNLOCK_KEY),
  ]);

  if (!hasHardware || !isEnrolled) return false;
  const unlockedAt = Number(lastUnlock ?? 0);
  return (
    !Number.isFinite(unlockedAt) ||
    Date.now() - unlockedAt > AUTH_GRACE_PERIOD_MS
  );
}

export async function unlockWithBiometrics() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock KASA",
    promptSubtitle: "Open your private LifeOS",
    cancelLabel: "Not now",
    fallbackLabel: "Use device passcode",
    disableDeviceFallback: false,
  });

  if (!result.success) return false;
  await markBiometricUnlock();
  return true;
}
