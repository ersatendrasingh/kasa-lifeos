import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const LAST_UNLOCK_KEY = "kasa.biometric.last-unlock";
const BIOMETRIC_ENABLED_KEY = "kasa.biometric.enabled";
const AUTH_GRACE_PERIOD_MS = 60_000;

export async function isBiometricLockEnabled() {
  const setting = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return setting !== "false";
}

export async function setBiometricLockEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(
    BIOMETRIC_ENABLED_KEY,
    enabled ? "true" : "false",
  );
  if (!enabled) await SecureStore.deleteItemAsync(LAST_UNLOCK_KEY);
}

export async function markBiometricUnlock() {
  await SecureStore.setItemAsync(LAST_UNLOCK_KEY, String(Date.now()));
}

export async function shouldRequestBiometricUnlock() {
  const [enabled, hasHardware, isEnrolled, lastUnlock] = await Promise.all([
    isBiometricLockEnabled(),
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    SecureStore.getItemAsync(LAST_UNLOCK_KEY),
  ]);

  if (!enabled || !hasHardware || !isEnrolled) return false;
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
