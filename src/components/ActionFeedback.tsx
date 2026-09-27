import React, { useEffect, useState, useRef } from 'react';
import {
  Check,
  X,
  PhoneCall,
  MessageSquare,
  Monitor,
  Search,
  Settings,
  Code2,
  Music,
  Send,
  Globe,
  ArrowUpRight,
  Zap,
  Layers,
  Sparkles,
  Smartphone,
  Camera,
} from 'lucide-react';
import { ToolExecutionResult } from '../services/deviceActionBridge.ts';

interface ActionFeedbackProps {
  lastAction: {
    name: string;
    args: any;
    result: ToolExecutionResult;
    timestamp: number;
  } | null;
  onClear: () => void;
}

export const ActionFeedback: React.FC<ActionFeedbackProps> = ({ lastAction, onClear }) => {
  const [copied, setCopied] = useState(false);
  const autoTriggeredRef = useRef<number>(0);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  const { name, args, result } = lastAction || { name: '', args: {}, result: { success: false, action: '' } };
  const data = result?.data || {};

  // Extract direct targets
  const protocolUri = data.uri || (name === 'openApp' && data.app ? `${data.app.toLowerCase()}:` : '');
  const webUrl = data.targetUrl || data.url || (typeof data === 'string' && data.startsWith('http') ? data : '');
  const recipient = data.recipient || args?.recipient || args?.contactName || '';
  const messageText = data.message || args?.message || '';
  const query = data.query || args?.query || '';
  const appName = data.app || args?.appName || 'App';
  const platform = result?.platform || data.platform || 'universal';
  const isMultiple = name === 'openMultipleApps' || !!data.apps || (Array.isArray(data.items) && data.items.length > 1);
  const items: Array<{ app: string; uri?: string; url?: string; category?: string }> = data.items || [];
  const isCamera = appName.toLowerCase() === 'camera' || data.app?.toLowerCase() === 'camera' || name === 'openCamera';

  // 1. Zero-Click Automatic Execution on Arrival for single or multiple apps
  useEffect(() => {
    if (!lastAction || autoTriggeredRef.current === lastAction.timestamp) return;
    autoTriggeredRef.current = lastAction.timestamp;

    console.log('⚡ [ActionFeedback] Auto-triggering launch for:', name, isMultiple ? items : (protocolUri || webUrl));

    if (isCamera) {
      const cameraInput = document.getElementById('iris-mobile-camera-capture') as HTMLInputElement | null;
      if (cameraInput) {
        cameraInput.click();
      }
      return;
    }

    if (isMultiple && items.length > 0) {
      items.forEach((item, index) => {
        setTimeout(() => {
          if (item.uri) {
            triggerUriScheme(item.uri);
          } else if (item.url) {
            window.open(item.url, '_blank', 'noopener,noreferrer');
          }
        }, index * 250);
      });
    } else if (protocolUri) {
      triggerUriScheme(protocolUri);
    }
  }, [lastAction, name, protocolUri, webUrl, isMultiple, items, isCamera]);

  const triggerUriScheme = (uri: string) => {
    try {
      const link = document.createElement('a');
      link.href = uri;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
        } catch (_) {}
      }, 500);

      // Also trigger location assignment for direct schemes on mobile if not intent/http
      if (!uri.startsWith('intent:') && !uri.startsWith('http') && !uri.startsWith('mailto:') && !uri.startsWith('sms:')) {
        try {
          window.location.href = uri;
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Auto protocol execution error:', e);
    }
  };

  // 2. Auto-dismiss after 6.5s for multi-app, 4.5s for single
  useEffect(() => {
    if (!lastAction) return;
    const timer = setTimeout(() => {
      onClear();
    }, isMultiple ? 6500 : 4500);
    return () => clearTimeout(timer);
  }, [lastAction, onClear, isMultiple]);

  if (!lastAction) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunchItem = (item: { app: string; uri?: string; url?: string }) => {
    if (item.app.toLowerCase() === 'camera') {
      const cameraInput = document.getElementById('iris-mobile-camera-capture') as HTMLInputElement | null;
      if (cameraInput) cameraInput.click();
      return;
    }
    if (item.uri) {
      triggerUriScheme(item.uri);
    } else if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCameraClick = () => {
    const cameraInput = document.getElementById('iris-mobile-camera-capture') as HTMLInputElement | null;
    if (cameraInput) {
      cameraInput.click();
    }
    onClear();
  };

  const getActionIcon = () => {
    if (isCamera) {
      return <Camera className="w-5 h-5 text-cyan-400" />;
    }
    if (isMultiple) {
      return <Layers className="w-5 h-5 text-cyan-400" />;
    }
    switch (name) {
      case 'sendMessage':
      case 'sendWhatsAppMessage':
      case 'openWhatsApp':
        return <MessageSquare className="w-5 h-5 text-emerald-400" />;
      case 'searchApp':
        return <Search className="w-5 h-5 text-blue-400" />;
      case 'controlWindowsSetting':
        return <Settings className="w-5 h-5 text-indigo-400" />;
      case 'makeCall':
      case 'callContact':
        return <PhoneCall className="w-5 h-5 text-pink-400" />;
      case 'openUrl':
      case 'showLink':
        return <Globe className="w-5 h-5 text-cyan-400" />;
      default:
        if (appName.toLowerCase().includes('code') || appName.toLowerCase().includes('terminal')) {
          return <Code2 className="w-5 h-5 text-cyan-400" />;
        }
        if (appName.toLowerCase().includes('spotify') || appName.toLowerCase().includes('music')) {
          return <Music className="w-5 h-5 text-green-400" />;
        }
        if (platform === 'android') {
          return <Smartphone className="w-5 h-5 text-cyan-400" />;
        }
        return <Monitor className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-lg animate-in fade-in slide-in-from-top-4 duration-300">
      <div
        className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all ${
          result.success
            ? 'bg-slate-900/95 border-cyan-500/60 shadow-[0_0_35px_rgba(6,182,212,0.25)] text-slate-100'
            : 'bg-slate-900/95 border-amber-500/60 shadow-[0_0_35px_rgba(245,158,11,0.25)] text-slate-100'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 shadow-inner shrink-0">
              {getActionIcon()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-wide truncate">
                  {isMultiple
                    ? `Auto-Opened ${data.count || items.length || ''} Apps`
                    : isCamera
                    ? 'Device Camera'
                    : name === 'sendWhatsAppMessage' || (name === 'sendMessage' && data.app === 'whatsapp')
                    ? `WhatsApp: ${recipient || 'Contact'}`
                    : name === 'sendMessage' && data.app === 'instagram'
                    ? `Instagram: @${recipient || 'User'}`
                    : name === 'sendMessage' && data.app === 'gmail'
                    ? `Gmail: ${recipient || 'Email'}`
                    : name === 'searchApp'
                    ? `Search ${data.app || 'App'}: "${query}"`
                    : name === 'openApp'
                    ? `Opening ${appName}`
                    : name === 'controlWindowsSetting'
                    ? `${data.settingName || 'Settings'}`
                    : name}
                </span>

                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold border ${
                    result.success
                      ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40'
                      : 'text-amber-300 bg-amber-950/80 border-amber-500/40'
                  }`}
                >
                  <Check className="w-3 h-3" /> Auto-Launched
                </span>
              </div>
              <p className="text-xs text-cyan-300/80 mt-0.5 truncate">
                {result.message || 'Triggered on device automatically'}
              </p>
            </div>
          </div>

          <button
            onClick={onClear}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-App Sequential List Preview */}
        {isMultiple && items.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {items.map((item, idx) => (
              <a
                key={idx}
                href={item.url || item.uri || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (item.app.toLowerCase() === 'camera') {
                    e.preventDefault();
                    handleCameraClick();
                  } else {
                    handleLaunchItem(item);
                  }
                }}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-cyan-500/20 hover:border-cyan-400 text-left transition-all text-xs group"
              >
                <span className="text-cyan-200 font-medium truncate">{item.app}</span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5 shrink-0">
                  <Check className="w-3 h-3" /> Open
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Action Content Preview (WhatsApp message or search target) */}
        {(name === 'sendWhatsAppMessage' || name === 'sendMessage') && messageText && (
          <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/25 text-xs text-emerald-100 font-sans flex items-start gap-2">
            <Send className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-emerald-400/70 font-mono">MESSAGE PREVIEW:</div>
              <p className="text-slate-200 mt-0.5 break-words">"{messageText}"</p>
            </div>
          </div>
        )}

        {/* Primary Launch Action Buttons (Real clickable <a> tag with target="_blank" and rel="noopener noreferrer") */}
        <div className="mt-3 pt-2.5 border-t border-cyan-500/20 flex flex-wrap items-center gap-2">
          {isCamera ? (
            <button
              onClick={handleCameraClick}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-slate-950" />
              <span>Open Camera</span>
            </button>
          ) : isMultiple ? (
            <button
              onClick={() => {
                items.forEach((item) => handleLaunchItem(item));
                onClear();
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
              <span>Re-trigger All {items.length || ''} Apps</span>
            </button>
          ) : protocolUri || webUrl ? (
            <a
              ref={anchorRef}
              href={protocolUri || webUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClear}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>
                {name === 'sendWhatsAppMessage' || (name === 'sendMessage' && data.app === 'whatsapp')
                  ? 'Open WhatsApp'
                  : name === 'sendMessage' && data.app === 'instagram'
                  ? 'Open Instagram'
                  : name === 'sendMessage' && data.app === 'gmail'
                  ? 'Open Gmail'
                  : name === 'searchApp'
                  ? `Search in ${data.app || 'App'}`
                  : `Open ${appName}`}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              onClick={() => onClear()}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all active:scale-95"
            >
              <span>Launched</span>
              <Check className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Web Version Option for single app */}
          {!isMultiple && !isCamera && protocolUri && webUrl && !webUrl.includes('google.com/search') && protocolUri !== webUrl && (
            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClear}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium text-xs flex items-center gap-1 transition-all"
              title="Open web version in browser tab"
            >
              <Globe className="w-3 h-3 text-slate-400" />
              <span>Web Portal</span>
            </a>
          )}

          {/* Copy Message / Link */}
          {(webUrl || messageText) && !isMultiple && (
            <button
              onClick={() => handleCopy(webUrl || messageText)}
              className="py-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-colors"
              title="Copy link / message"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
