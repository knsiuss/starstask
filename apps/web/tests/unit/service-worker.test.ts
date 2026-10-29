import { describe, expect, it, vi } from "vitest";

import {
  registerServiceWorker,
  SERVICE_WORKER_SCOPE,
  SERVICE_WORKER_URL,
  type ServiceWorkerContainerLike,
} from "@/lib/push/service-worker";

function container(
  register: ServiceWorkerContainerLike["register"],
): ServiceWorkerContainerLike {
  return { register };
}

describe("registerServiceWorker", () => {
  it("registers the worker at the site root and always revalidates it", async () => {
    // Only object identity matters here; a real ServiceWorkerRegistration has
    // many DOM members that this fake does not need.
    const registration = { scope: "/" } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);

    await expect(registerServiceWorker(container(register))).resolves.toBe(
      registration,
    );
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
      updateViaCache: "none",
    });
  });

  it("returns null when the browser has no service worker support", async () => {
    await expect(registerServiceWorker()).resolves.toBeNull();
  });

  it("swallows registration failures so the site keeps working", async () => {
    const register = vi.fn().mockRejectedValue(new Error("SecurityError"));

    await expect(
      registerServiceWorker(container(register)),
    ).resolves.toBeNull();
  });

  it("uses the documented worker path and scope", () => {
    expect(SERVICE_WORKER_URL).toBe("/sw.js");
    expect(SERVICE_WORKER_SCOPE).toBe("/");
  });
});
