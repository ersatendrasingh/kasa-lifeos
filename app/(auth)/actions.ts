"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  identifierSchema,
  normalizeIdentifier,
  passwordSchema,
} from "@/lib/auth/validation";
import type { AuthActionState } from "@/lib/auth/types";

const signInSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, "Enter your password"),
});

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Tell us what to call you").max(80),
  identifier: identifierSchema,
  password: passwordSchema,
});

function emailOnly(identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  if (normalized.channel === "PHONE") {
    return {
      error: {
        status: "error" as const,
        message:
          "Phone login will switch on when the SMS provider is connected. Use email for now.",
      },
    };
  }
  return { email: normalized.value };
}

export async function passwordSignInAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const normalized = emailOnly(parsed.data.identifier);
  if (normalized.error) return normalized.error;

  try {
    await auth.api.signInEmail({
      body: { email: normalized.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch {
    return {
      status: "error",
      message: "Those details don’t match an account. Try again or use OTP.",
    };
  }
  redirect("/app");
}

export async function passwordSignUpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const normalized = emailOnly(parsed.data.identifier);
  if (normalized.error) return normalized.error;

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: normalized.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch {
    return {
      status: "error",
      message:
        "This email is already in use, or the account could not be created.",
    };
  }
  redirect("/app");
}

export async function signInWithGoogleAction() {
  const result = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/app" },
    headers: await headers(),
  });
  if (result.url) redirect(result.url);
  redirect("/sign-in");
}
