import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Terminal,
  Code2,
  FileText,
  Calculator,
  Settings,
  Music,
  MessageSquare,
  Globe,
  Folder,
  Camera,
  Layers,
  Sparkles,
  Zap,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { DeviceActionBridge } from '../services/deviceActionBridge.ts';
import { triggerHaptic } from '../utils/haptics.ts';

interface PlatformDockProps {
  deviceBridge: DeviceActionBridge;
  onExecuteApp: (appName: string, query?: string) => void;
  currentPlatform: 'auto' | 'windows' | 'android';
  onSelectPlatform: (platform: 'auto' | 'windows' | 'android') => void;
}

export const PlatformDock: React.FC<PlatformDockProps> = ({
  deviceBridge,
  onExecuteApp,
  currentPlatform,
  onSelectPlatform,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isWindowsActive = deviceBridge.isWindows();

  const windowsQuickApps = [
    { id: 'vscode', name: 'VS Code', icon: <Code2 className="w-4 h-4 text-blue-600" /> },
    { id: 'terminal', name: 'Terminal / CMD', icon: <Terminal className="w-4 h-4 text-emerald-600" /> },
    { id: 'notepad', name: 'Notepad', icon: <FileText className="w-4 h-4 text-sky-600" /> },
    { id: 'calculator', name: 'Calculator', icon: <Calculator className="w-4 h-4 text-amber-600" /> },
    { id: 'spotify', name: 'Spotify Music', icon: <Music className="w-4 h-4 text-emerald-600" /> },
    { id: 'whatsapp', name: 'WhatsApp', icon: <MessageSquare className="w-4 h-4 text-emerald-600" /> },
    { id: 'explorer', name: 'File Explorer', icon: <Folder className="w-4 h-4 text-amber-600" /> },
    { id: 'settings', name: 'Windows Settings', icon: <Settings className="w-4 h-4 text-indigo-600" /> },
    { id: 'snippingtool', name: 'Snipping Tool', icon: <Camera className="w-4 h-4 text-rose-600" /> },
  ];

  const androidQuickApps = [
    { id: 'whatsapp', name: 'WhatsApp', icon: <MessageSquare className="w-4 h-4 text-emerald-600" /> },
    { id: 'youtube', name: 'YouTube', icon: <Sparkles className="w-4 h-4 text-rose-600" /> },
    { id: 'instagram', name: 'Instagram', icon: <Layers className="w-4 h-4 text-pink-600" /> },
    { id: 'spotify', name: 'Spotify', icon: <Music className="w-4 h-4 text-emerald-600" /> },
    { id: 'maps', name: 'Google Maps', icon: <Globe className="w-4 h-4 text-blue-600" /> },
    { id: 'camera', name: 'Camera', icon: <Camera className="w-4 h-4 text-cyan-600" /> },
    { id: 'photos', name: 'Photos / Gallery', icon: <Folder className="w-4 h-4 text-amber-600" /> },
    { id: 'phone', name: 'Dialer / Phone', icon: <Zap className="w-4 h-4 text-emerald-600" /> },
    { id: 'gpay', name: 'Google Pay (UPI)', icon: <Zap className="w-4 h-4 text-blue-600" /> },
    { id: 'zomato', name: 'Zomato', icon: <Sparkles className="w-4 h-4 text-rose-600" /> },
    { id: 'calculator', name: 'Calculator', icon: <Calculator className="w-4 h-4 text-amber-600" /> },
    { id: 'settings', name: 'Settings', icon: <Settings className="w-4 h-4 text-indigo-600" /> },
  ];

  const activeApps = isWindowsActive ? windowsQuickApps : androidQuickApps;

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 z-20">
      <div className="bg-white/45 hover:bg-white/55 border border-white/70 rounded-2xl backdrop-blur-xl shadow-[0_20px_50px_rgba(14,165,233,0.18)] hover:shadow-[0_25px_60px_rgba(14,165,233,0.25)] ring-1 ring-white/60 overflow-hidden transition-all duration-300">
        {/* Dock Header Bar */}
        <div className="px-3.5 py-2 bg-slate-900/5 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50/80 border border-blue-200 text-[10px] font-mono text-blue-700 font-bold shadow-2xs">
              {isWindowsActive ? (
                <>
                  <Monitor className="w-3 h-3 text-blue-600" />
                  <span>WINDOWS 10/11 AUTOMATION</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3 h-3 text-emerald-600" />
                  <span>ANDROID SMARTPHONE AUTOMATION</span>
                </>
              )}
            </div>

            <span className="hidden sm:inline text-[11px] text-slate-600 font-mono font-medium">
              Voice automation for apps, links & system tools
            </span>
          </div>

          {/* Platform Switcher & Expand Toggle */}
          <div className="flex items-center gap-1.5">
            {/* Mode Selector Buttons */}
            <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/60 text-[10px] font-mono backdrop-blur-sm">
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); onSelectPlatform('auto'); }}
                className={`px-2 py-0.5 rounded-md spring-button transition-all ${
                  currentPlatform === 'auto'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Auto-detect operating system"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); onSelectPlatform('windows'); }}
                className={`px-2 py-0.5 rounded-md spring-button transition-all flex items-center gap-1 ${
                  currentPlatform === 'windows'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Force Windows PC mode"
              >
                <Monitor className="w-2.5 h-2.5" />
                <span>Win</span>
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); onSelectPlatform('android'); }}
                className={`px-2 py-0.5 rounded-md spring-button transition-all flex items-center gap-1 ${
                  currentPlatform === 'android'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Force Android Mobile mode"
              >
                <Smartphone className="w-2.5 h-2.5" />
                <span>Mobile</span>
              </button>
            </div>

            {/* Expand / Collapse Quick Apps */}
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setIsExpanded(!isExpanded); }}
              className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all spring-button flex items-center gap-1"
              title={isExpanded ? 'Collapse Quick Launch Dock' : 'Expand Quick Launch Dock'}
            >
              <span className="text-[10px] font-mono font-bold hidden sm:inline text-blue-600">
                {isExpanded ? 'Hide Apps' : 'Quick Apps'}
              </span>
              <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                <ChevronDown className="w-4 h-4 text-blue-600" />
              </div>
            </button>
          </div>
        </div>

        {/* Quick App Launcher Grid with Smooth CSS Grid Expansion */}
        <div
          className={`grid transition-all duration-300 ease-out overflow-hidden ${
            isExpanded ? 'grid-rows-[1fr] opacity-100 p-3 border-t border-slate-100/60 bg-white/40 backdrop-blur-md' : 'grid-rows-[0fr] opacity-0 p-0 border-t-0'
          }`}
        >
          <div className="min-h-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
            {activeApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  if (app.id === 'camera') {
                    const cameraInput = document.getElementById('iris-mobile-camera-capture') as HTMLInputElement | null;
                    if (cameraInput) {
                      cameraInput.click();
                    }
                  }
                  onExecuteApp(app.id);
                }}
                className="p-2.5 rounded-xl bg-white/70 hover:bg-blue-50/90 border border-white/80 hover:border-blue-300 transition-all flex items-center gap-2 group text-left shadow-2xs hover:shadow-md spring-button"
              >
                <div className="p-1.5 rounded-lg bg-white border border-slate-200/80 group-hover:border-blue-300 group-hover:scale-110 transition-all shrink-0">
                  {app.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[11px] text-slate-900 truncate group-hover:text-blue-600">
                    {app.name}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono truncate">
                    Launch app
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
