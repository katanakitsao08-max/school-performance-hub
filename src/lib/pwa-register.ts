/**
 * Silent PWA update registration.
 * - No popups, no reload prompts.
 * - Disabled inside the Lovable preview iframe and on preview/sandbox hosts
 *   to avoid stale caches in the editor.
 * - Activates new versions in the background; only refreshes silently
 *   when the user is idle and no critical input is active.
 */

const IDLE_MS = 60_000; // wait at least 60s of idle before any silent refresh
const VERSION_CHECK_MS = 15 * 60_000; // re-check for updates every 15 min

function isInIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

function isPreviewHost(): boolean {
  const h = window.location.hostname;
  return (
    h.includes('lovableproject.com') ||
    h.includes('lovable.app') ||
    h.includes('id-preview--') ||
    h === 'localhost' ||
    h === '127.0.0.1'
  );
}

function isUserBusy(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // Pages where data loss would hurt: marks entry, attendance, etc.
  const path = window.location.pathname;
  if (/marks|attendance|reports|fees|documents/i.test(path)) {
    // Only "busy" if there's a focused control on these pages — handled above.
  }
  return false;
}

function snapshotDrafts(): void {
  try {
    const drafts: Record<string, string> = {};
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((el, i) => {
      if (el.value && el.value.length > 0 && el.type !== 'password') {
        const key = el.name || el.id || `field_${i}`;
        drafts[key] = el.value;
      }
    });
    if (Object.keys(drafts).length > 0) {
      localStorage.setItem('pt_pwa_draft_snapshot', JSON.stringify({ ts: Date.now(), drafts }));
    }
  } catch {}
}

function setupIdleRefresh(reg: ServiceWorkerRegistration) {
  let lastActivity = Date.now();
  const bump = () => { lastActivity = Date.now(); };
  ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'scroll'].forEach((e) =>
    window.addEventListener(e, bump, { passive: true })
  );

  const tryRefresh = () => {
    if (!reg.waiting) return;
    const idleFor = Date.now() - lastActivity;
    if (idleFor < IDLE_MS) return;
    if (isUserBusy()) return;
    if (document.visibilityState !== 'visible') {
      // Hidden tab — safest moment. Snapshot drafts just in case and activate.
      snapshotDrafts();
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Visible but idle — activate silently without forcing reload.
      snapshotDrafts();
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };
  setInterval(tryRefresh, 10_000);
}

export function registerSilentPwa() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // Safety: never run inside the Lovable preview iframe or preview hosts.
  if (isInIframe() || isPreviewHost()) {
    // Cleanup: unregister any previously registered SW so the preview is never stuck.
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // Silent: do NOT reload on controllerchange. New SW already claimed clients.
      // Subsequent navigations will pick up new assets via NetworkFirst.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // intentionally empty — no popups, no forced reload.
      });

      // Periodic background update check.
      setInterval(() => { reg.update().catch(() => {}); }, VERSION_CHECK_MS);
      // Also check when the tab becomes visible / on focus.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
      window.addEventListener('focus', () => { reg.update().catch(() => {}); });

      setupIdleRefresh(reg);
    } catch {
      // swallow — registration failure must never break the app
    }
  });
}
