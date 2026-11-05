import type { PluginManifest } from "../types";

export const unpamManifest: PluginManifest = {
  pluginId: "unpam",
  displayName: "Universitas Pamulang (FTI)",
  domains: ["ftiunpam.com"],
  sources: [
    {
      kind: "academic-calendar",
      url: "https://ftiunpam.com/kalender",
      requiresLogin: false,
      syncIntervalHours: 24 * 7,
    },
    {
      kind: "e-learning",
      url: "https://ftiunpam.com/elearning",
      requiresLogin: false,
      syncIntervalHours: 24,
    },
    {
      kind: "events",
      url: "https://ftiunpam.com/pengumuman",
      requiresLogin: false,
      syncIntervalHours: 24,
    },
  ],
};
