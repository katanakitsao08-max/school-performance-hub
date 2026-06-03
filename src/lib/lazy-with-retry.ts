import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "pt:chunk-reload";

/**
 * Wraps React.lazy with auto-recovery for stale chunk errors that occur
 * after a redeploy (filenames change, old HTML references vanished JS).
 * If import fails, force a one-time hard reload to fetch the new manifest.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // success — clear any prior flag
      try { window.sessionStorage.removeItem(RELOAD_KEY); } catch {}
      return mod;
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isChunkErr =
        /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed/i.test(msg);
      if (isChunkErr && typeof window !== "undefined") {
        const already = window.sessionStorage.getItem(RELOAD_KEY);
        if (!already) {
          window.sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // Return a never-resolving promise so React doesn't render the error
          return await new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }
  });
}
