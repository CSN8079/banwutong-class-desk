import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/ToastProvider';
import './styles.css';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const applyStatusBarTheme = () => {
    void StatusBar.setOverlaysWebView({ overlay: false });
    void StatusBar.setBackgroundColor({ color: darkQuery.matches ? '#0f1714' : '#f2f0e9' });
    void StatusBar.setStyle({ style: darkQuery.matches ? Style.Light : Style.Dark });
  };
  applyStatusBarTheme();
  darkQuery.addEventListener('change', applyStatusBarTheme);
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
