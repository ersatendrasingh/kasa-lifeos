import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { randomInt } from "node:crypto";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db";
import { deliverOtp } from "@/lib/auth/otp-delivery";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const googleClientId = process.env.AUTH_GOOGLE_ID?.trim();
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
const googleEnabled = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  appName: "KASA LifeOS",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins: [
    "kasa://",
    "kasa://*",
    "exp+kasa-life-os://",
    "exp+kasa-life-os://*",
    ...(process.env.NODE_ENV === "development"
      ? [
          "exp://",
          "exp://**",
          "http://localhost:*",
          "http://192.168.*.*:*",
          "http://169.254.*.*:*",
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
        },
      }
    : {},
  plugins: [
    expo(),
    emailOTP({
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      generateOTP: () =>
        process.env.NODE_ENV === "development"
          ? "123456"
          : randomInt(100_000, 1_000_000).toString(),
      async sendVerificationOTP({ email, otp, type }) {
        const delivery = await deliverOtp({
          channel: "EMAIL",
          identifier: email,
          code: otp,
          purpose: type === "forget-password" ? "SIGN_IN" : "SIGN_IN",
        });
        if (!delivery.delivered) {
          throw new Error("Email OTP delivery is not configured.");
        }
      },
    }),
    passkey({
      rpName: "KASA LifeOS",
      rpID: new URL(baseURL).hostname,
      origin: baseURL,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    }),
    nextCookies(),
  ],
  advanced: {
    database: { joins: true },
    cookiePrefix: "kasa",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type KasaSession = typeof auth.$Infer.Session;
