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

// An explicit API URL wins in development. Metro may be reached through a USB
// tunnel whose `localhost` does not expose the Next API on the phone; using it
// first silently sent requests to the wrong/stale backend.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  getMetroApiUrl() ??
  "http://localhost:3000";

export function apiUrl(path: string) {
  return `${API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
