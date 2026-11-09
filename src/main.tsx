import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/ToastProvider';
import { applyThemeMode, readStoredThemeMode } from './lib/theme';
import './styles.css';

applyThemeMode(readStoredThemeMode());
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app');
  void StatusBar.setOverlaysWebView({ overlay: false });
  void Keyboard.setResizeMode({ mode: KeyboardResize.Native });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
