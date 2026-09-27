import React from 'react';
import {
  MapPin,
  ShieldAlert,
  Settings,
  X,
  ExternalLink,
  CheckCircle2,
  Smartphone,
  Globe,
  Navigation,
} from 'lucide-react';
import { locationService } from '../services/locationService.ts';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  onClose,
  onRetry,
}) => {
  if (!isOpen) return null;

  const handleRequestPermission = () => {
    locationService.requestPreciseLocation(true);
    onRetry();
  };

  const handleOpenAppInfo = () => {
    const androidBridge = (window as any).AndroidBridge || (window as any).IrisNativeBridge;
    if (androidBridge) {
      try {
        if (typeof androidBridge.openAppDetailsSettings === 'function') {
          androidBridge.openAppDetailsSettings();
          return;
        }
        if (typeof androidBridge.postMessage === 'function') {
          androidBridge.postMessage(
            JSON.stringify({
              action: 'OPEN_APP_SETTINGS',
              intent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
            })
          );
          return;
        }
      } catch (e) {
        console.warn('Android bridge error:', e);
      }
    }

    // Direct instructions for Chrome / Browser
    window.open('chrome://settings/content/location', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        
        {/* Header with radar icon */}
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 px-6 pt-6 pb-5 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              <MapPin className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono">Location Access</h3>
              <p className="text-xs text-cyan-100 font-sans">High-Precision GPS & Google Maps</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-black/10 hover:bg-black/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs leading-relaxed text-slate-600">
          <p className="text-sm text-slate-800 font-medium">
            Iris needs your precise location to show your live GPS position on Google Maps, find nearby places, and give exact directions.
          </p>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-600" />
              <span>How to allow location access:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
              <li>Click the lock/settings icon in your browser address bar (or Android App Info).</li>
              <li>Toggle <strong>Location</strong> permission to <strong>Allow</strong>.</li>
              <li>Click <strong>&quot;Grant Permission &amp; Retry&quot;</strong> below.</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleRequestPermission}
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-98 transition-all"
            >
              <Navigation className="w-4 h-4" />
              <span>Grant Permission &amp; Retry</span>
            </button>

            <button
              onClick={handleOpenAppInfo}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-600" />
              <span>Open Device App Settings / Info</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Google Maps Platform</span>
          <span>Encrypted Device GPS</span>
        </div>
      </div>
    </div>
  );
};
