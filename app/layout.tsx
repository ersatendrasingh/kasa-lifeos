import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Manrope, Sora } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "KASA — Life OS",
    template: "%s · KASA",
  },
  description:
    "Your life, thoughtfully connected. KASA is a calm personal operating system for everything that matters.",
  applicationName: "KASA — Life OS",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${sora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
