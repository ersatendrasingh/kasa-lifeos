import { z } from "zod";

export const identifierSchema = z
  .string()
  .trim()
  .min(5)
  .max(254)
  .refine(
    (value) =>
      z.email().safeParse(value).success ||
      /^(?:\+91)?[6-9]\d{9}$/.test(value.replace(/[\s()-]/g, "")),
    "Enter a valid email or Indian mobile number",
  );

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Add at least one letter")
  .regex(/\d/, "Add at least one number");

export function normalizeIdentifier(input: string) {
  const value = input.trim().toLowerCase();
  if (value.includes("@")) return { value, channel: "EMAIL" as const };

  const digits = value.replace(/\D/g, "");
  return {
    value: digits.length === 10 ? `+91${digits}` : `+${digits}`,
    channel: "PHONE" as const,
  };
}
