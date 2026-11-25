import { it, expect, vi, afterEach } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
it('applies initial layout and panel once, preserving participant choices on reconfiguration', async () => {
  vi.resetModules(); const { default: store } = await import('../src/store/useConferenceStore');
  store.getState().setConfig({ conference: { defaultLayout: 'speaker', defaultPanel: 'people', pushToTalk: true } });
  expect(store.getState().ui).toMatchObject({ layout: 'speaker', chatOpen: false, peopleOpen: true, pushToTalkEnabled: true });
  store.getState().setUi({ layout: 'gallery', peopleOpen: false, pushToTalkEnabled: false });
  store.getState().setConfig({ displayName: 'Participant', conference: { defaultLayout: 'speaker', defaultPanel: 'people', pushToTalk: true } });
  expect(store.getState().ui).toMatchObject({ layout: 'gallery', peopleOpen: false, pushToTalkEnabled: false });
});
it('uses the host theme only until a participant saves a choice, including System', async () => {
  vi.resetModules(); let saved = null;
  vi.stubGlobal('localStorage', { getItem: () => saved, setItem: (_, value) => { saved = value; } });
  vi.stubGlobal('document', { documentElement: { dataset: {} } });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), dispatchEvent: vi.fn() });
  const theme = await import('../src/services/theme');
  theme.setDefaultTheme('dark'); expect(document.documentElement.dataset.theme).toBe('dark');
  theme.setThemePreference('system'); theme.setDefaultTheme('dark');
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', themeMode: 'system' });
  expect(saved).toBe('system');
});
