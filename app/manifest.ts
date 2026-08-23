import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KASA — Life OS",
    short_name: "KASA",
    description:
      "A calm personal operating system for your health, time, goals, relationships, and growth.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF9F3",
    theme_color: "#F45B22",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/kasa-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/kasa-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/kasa-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
