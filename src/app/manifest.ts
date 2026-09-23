import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${config.appName} Front Desk`,
    short_name: config.appName,
    description: `Run the front desk with ${config.appName}, even when the network drops.`,
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4efe6",
    theme_color: "#b4452a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Today", url: "/today" },
      { name: "The Ledger", url: "/ledger" },
      { name: "New reservation", url: "/reservations?new=1" },
      { name: "My shift", url: "/shifts" },
    ],
  };
}
