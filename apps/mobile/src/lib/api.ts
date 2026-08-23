import Constants from "expo-constants";

function getMetroApiUrl() {
  if (!__DEV__) return null;
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  try {
    const metroUrl = new URL(
      hostUri.includes("://") ? hostUri : `http://${hostUri}`,
    );
    const hostname = metroUrl.hostname.includes(":")
      ? `[${metroUrl.hostname}]`
      : metroUrl.hostname;
    return `http://${hostname}:3000`;
  } catch {
    return null;
  }
}

// In a development build the phone may reach Metro over Wi-Fi, USB, or a
// link-local interface. Deriving the API host from Metro keeps both routes in
// sync and avoids stale hard-coded LAN addresses.
export const API_URL =
  getMetroApiUrl() ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:3000";

export function apiUrl(path: string) {
  return `${API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
