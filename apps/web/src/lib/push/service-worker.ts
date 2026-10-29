/**
 * Service worker registration shared by the PWA bootstrap component.
 *
 * Extracted from the component so tests can drive it with a fake container:
 * the worker lives at `/sw.js` with scope `/`, and registration failure must
 * never break the rest of the site.
 */

export type ServiceWorkerContainerLike = {
  register(
    scriptURL: string,
    options?: { scope?: string; updateViaCache?: ServiceWorkerUpdateViaCache },
  ): Promise<ServiceWorkerRegistration>;
};

export const SERVICE_WORKER_URL = "/sw.js";
export const SERVICE_WORKER_SCOPE = "/";

export async function registerServiceWorker(
  container?: ServiceWorkerContainerLike,
): Promise<ServiceWorkerRegistration | null> {
  const target =
    container ??
    (typeof navigator !== "undefined" ? navigator.serviceWorker : undefined);

  if (!target) {
    return null;
  }

  try {
    return await target.register(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
      // The browser must revalidate the worker script; a cached worker would
      // keep shipping an old notification handler after a deploy.
      updateViaCache: "none",
    });
  } catch {
    return null;
  }
}
