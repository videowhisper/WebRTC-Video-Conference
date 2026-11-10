import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { t } from '../config/labels';
import { initializeTheme, setThemePreference, themePreference } from '../services/theme';
export default function ThemeToggle() {
  const [mode, setMode] = useState(themePreference);
  useEffect(() => { initializeTheme(); const update = () => setMode(themePreference()); window.addEventListener('vwc-theme', update); return () => window.removeEventListener('vwc-theme', update); }, []);
  const Icon = mode === 'system' ? Monitor : mode === 'dark' ? Moon : Sun;
  const label = mode === 'system' ? t('Theme: system. Switch to light.') : mode === 'light' ? t('Theme: light. Switch to dark.') : t('Theme: dark. Switch to system.');
  return <button type="button" className="vwc-theme-toggle" title={label} aria-label={label} onClick={() => setThemePreference(mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system')}><Icon size={18} /></button>;
}
