import { DeviceEventEmitter } from "react-native";

import { apiUrl } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };
export const AUTH_REQUIRED_EVENT = "kasa:auth-required";

let authRequiredEmitted = false;

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<{ data: T | null; error: { message: string } | null }> {
  let body: BodyInit | undefined;
  if (options.body instanceof FormData || typeof options.body === "string") {
    body = options.body;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  }

  try {
    let response: Response | null = null;
    const initialCookie = await authClient.getCookie();
    // A newly completed native sign-in can take one render tick to persist its
    // cookie. Retry that race once, but never hammer protected routes when the
    // device is genuinely signed out or an old session has expired.
    const maxAttempts = initialCookie ? 2 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const headers = new Headers(options.headers);
      const cookie =
        attempt === 0 ? initialCookie : await authClient.getCookie();
      if (cookie) headers.set("cookie", cookie);
      if (
        options.body !== undefined &&
        !(options.body instanceof FormData) &&
        typeof options.body !== "string"
      ) {
        headers.set("content-type", "application/json");
      }
      response = await fetch(apiUrl(path), {
        ...options,
        body,
        headers,
        credentials: "include",
      });
      if (response.status !== 401 || attempt === maxAttempts - 1) break;
      // Verify against the database instead of trusting Better Auth's native
      // session snapshot, then retry with the cookie persisted by that refresh.
      await authClient.getSession({ query: { disableCookieCache: true } });
    }
    if (!response) throw new Error("KASA API did not respond");
    const payload = (await response.json().catch(() => null)) as
      (T & { error?: string }) | null;
    if (!response.ok) {
      if (response.status === 401 && !authRequiredEmitted) {
        authRequiredEmitted = true;
        DeviceEventEmitter.emit(AUTH_REQUIRED_EVENT);
      }
      return {
        data: null,
        error: {
          message:
            payload && typeof payload.error === "string"
              ? payload.error
              : `KASA API returned ${response.status}`,
        },
      };
    }
    authRequiredEmitted = false;
    return { data: payload as T, error: null };
  } catch (cause) {
    return {
      data: null,
      error: {
        message:
          cause instanceof Error ? cause.message : "KASA API is unreachable",
      },
    };
  }
}
