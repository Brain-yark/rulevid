import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './context/ToastContext'

// ─── Global Error & Rejection Logging ─────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[Global Uncaught Error]', event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global Unhandled Promise Rejection]', event.reason);
  });

  // ─── Insecure Context Detection & Localhost Normalization ───────────────────
  // Modern browsers disable navigator.mediaDevices.getUserMedia on non-localhost HTTP.
  // If the user accessed via local machine hostname (e.g. samba-hp-elitebook-820-g4),
  // automatically normalize to 'localhost' so the browser exposes WebRTC camera APIs.
  if (!window.isSecureContext && window.location.protocol === 'http:') {
    const host = window.location.hostname.toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1') {
      if (host.includes('hp-elitebook') || host.includes('samba') || host.endsWith('.local') || !host.includes('.')) {
        console.warn(`[Security] Hostname "${window.location.hostname}" is an insecure origin. Redirecting to "localhost" for WebRTC getUserMedia support.`);
        window.location.hostname = 'localhost';
      }
    }
  }

  // ─── Legacy getUserMedia Polyfill ───────────────────────────────────────────
  if (navigator && !navigator.mediaDevices) {
    (navigator as any).mediaDevices = {};
  }
  if (navigator && navigator.mediaDevices && !navigator.mediaDevices.getUserMedia) {
    const legacyGUM = (navigator as any).getUserMedia ||
      (navigator as any).webkitGetUserMedia ||
      (navigator as any).mozGetUserMedia ||
      (navigator as any).msGetUserMedia;
    if (legacyGUM) {
      navigator.mediaDevices.getUserMedia = function (constraints: MediaStreamConstraints) {
        return new Promise((resolve, reject) => {
          legacyGUM.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
