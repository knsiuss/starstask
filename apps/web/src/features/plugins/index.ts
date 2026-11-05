import type { PluginAdapter } from "./types";
import { unpamPlugin } from "./unpam/adapter";

/** Registry plugin. Tambah plugin baru = satu baris. */
const registry: Record<string, PluginAdapter> = {
  [unpamPlugin.manifest.pluginId]: unpamPlugin,
};

export function getPlugin(pluginId: string): PluginAdapter | undefined {
  return registry[pluginId];
}

export function listPlugins(): PluginAdapter[] {
  return Object.values(registry);
}
