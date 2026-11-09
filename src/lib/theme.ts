import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { ThemeMode } from '../types';

export function applyThemeMode(mode: ThemeMode): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  document.documentElement.dataset.theme = effective;
  document.documentElement.style.colorScheme = effective;
  if (Capacitor.isNativePlatform()) {
    void StatusBar.setOverlaysWebView({ overlay: false });
    void StatusBar.setBackgroundColor({ color: effective === 'dark' ? '#0f1714' : '#f2f0e9' });
    void StatusBar.setStyle({ style: effective === 'dark' ? Style.Light : Style.Dark });
  }
}

export function readStoredThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem('banwutong-data-v1');
    if (!raw) return 'system';
    const parsed = JSON.parse(raw) as { state?: { themeMode?: ThemeMode } };
    const mode = parsed.state?.themeMode;
    return mode === 'dark' || mode === 'light' ? mode : 'system';
  } catch {
    return 'system';
  }
}
