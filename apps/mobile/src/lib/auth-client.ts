import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { API_URL } from "@/lib/api";

if (__DEV__) console.info(`[KASA] Auth API: ${API_URL}`);

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "kasa",
      storagePrefix: "kasa-auth",
      cookiePrefix: "kasa",
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
});
