import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Google Maps Platform Demo Key Quota Defense Handler
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    window.dispatchEvent(new CustomEvent('gmp-auth-failed'));
  };
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      return;
    }
    if (msg.includes('InvalidKeyMapError') || msg.includes('ApiProjectMapError')) {
      window.dispatchEvent(new CustomEvent('gmp-auth-failed'));
      return;
    }
    origError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
