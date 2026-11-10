const storageKey = 'vwc-theme';
let initialized = false;
let memoryPreference = null;
export function themePreference() {
  if (memoryPreference) return memoryPreference;
  try { const saved = localStorage.getItem(storageKey); return ['light', 'dark'].includes(saved) ? saved : 'system'; } catch { return 'system'; }
}
export function applyTheme() {
  const mode = themePreference();
  document.documentElement.dataset.theme = mode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
  document.documentElement.dataset.themeMode = mode;
}
export function setThemePreference(mode) {
  if (!['system', 'light', 'dark'].includes(mode)) return;
  memoryPreference = mode;
  try { localStorage.setItem(storageKey, mode); } catch { /* System remains usable without storage. */ }
  applyTheme(); window.dispatchEvent(new Event('vwc-theme'));
}
export function initializeTheme() {
  applyTheme(); if (initialized) return; initialized = true;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  window.addEventListener('storage', () => { memoryPreference = null; applyTheme(); window.dispatchEvent(new Event('vwc-theme')); });
}
