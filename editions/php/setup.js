import { initializeTheme, setThemePreference, themePreference } from './theme.js';
initializeTheme();
const button = document.querySelector('[data-theme-toggle]');
function render() {
  const mode = themePreference();
  const next = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
  button.title = `Theme: ${mode}. Switch to ${next}.`; button.setAttribute('aria-label', button.title);
  button.querySelector('[data-theme-icon]').textContent = mode === 'system' ? '◐' : mode === 'light' ? '☀' : '☾';
}
button?.addEventListener('click', () => { const mode = themePreference(); setThemePreference(mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system'); render(); });
window.addEventListener('vwc-theme', render); render();
