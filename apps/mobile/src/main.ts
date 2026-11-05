/**
 * StarsTask Mobile entry (Capacitor).
 * Offline-first check-in + push. E2EE keys reuse web IndexedDB format.
 */
import { Capacitor } from "@capacitor/core";

console.log("StarsTask Mobile", Capacitor.getPlatform());

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
