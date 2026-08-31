// Build API URLs that work on hosted ComfyUI, not only localhost.
// Route every /artthreads/api/* and /view?... call through here.

import { api } from "/scripts/api.js";

/** @param {string} route e.g. "/artthreads/api/monitor/stats" */
export function artApiUrl(route) {
  try {
    if (typeof api?.apiURL === "function") return api.apiURL(route);
  } catch (_e) {}
  return route;
}

const _GEAR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z'/%3E%3C/svg%3E";

const _AUDIO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77M16.5 12A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02M3 9v6h4l5 5V4L7 9H3z'/%3E%3C/svg%3E";

const _MUTE_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63m2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71M4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3M12 4 9.91 6.09 12 8.18V4z'/%3E%3C/svg%3E";

/** Inline gear SVG data URI for CSS mask-url(...) (no asset route required). */
export function artGearMask() {
  return _GEAR_SVG;
}

/** Static asset URL for extension web files (hosted-safe). */
export function artAsset(relPath) {
  const p = String(relPath || "").replace(/^\/+/, "");
  if (p === "icons/note/gear.svg") return _GEAR_SVG;
  if (p === "icons/ui/audio.svg") return _AUDIO_SVG;
  if (p === "icons/ui/mute.svg") return _MUTE_SVG;
  try {
    if (typeof api?.apiURL === "function") return api.apiURL(`/extensions/ComfyUI-ArtThreads/${p}`);
  } catch (_e) {}
  return `/extensions/ComfyUI-ArtThreads/${p}`;
}
