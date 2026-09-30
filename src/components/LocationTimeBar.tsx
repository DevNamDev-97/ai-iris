import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  Globe,
  Calendar,
  Bell,
  FileText,
  MessageSquare,
  RefreshCw,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { DeviceActionBridge, DeviceLocationInfo } from '../services/deviceActionBridge.ts';
import { locationService, PreciseLocation } from '../services/locationService.ts';

interface LocationTimeBarProps {
  bridge: DeviceActionBridge;
  onOpenCalendar: () => void;
  onOpenReminders: () => void;
  onOpenNotes: () => void;
  onOpenNotifications: () => void;
  onOpenContacts: () => void;
  unreadCount: number;
  theme?: 'light' | 'dark';
}

const LocationTimeBarComponent: React.FC<LocationTimeBarProps> = ({
  bridge,
  onOpenCalendar,
  onOpenReminders,
  onOpenNotes,
  onOpenNotifications,
  onOpenContacts,
  unreadCount,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [timeStr, setTimeStr] = useState<string>(() => new Date().toLocaleTimeString());
  const [dateStr, setDateStr] = useState<string>(() => new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
  const [locationInfo, setLocationInfo] = useState<DeviceLocationInfo>(() => bridge.getLocationInfo());
  const [preciseLocation, setPreciseLocation] = useState<PreciseLocation>(() => locationService.getLocation());
  const [isRefreshingLoc, setIsRefreshingLoc] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    }, 1000);

    const unsub = locationService.subscribe((loc) => {
      setPreciseLocation(loc);
    });

    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const handleRefreshLocation = async () => {
    setIsRefreshingLoc(true);
    await locationService.requestPreciseLocation(true);
    await bridge.initLocationAndTimezone();
    setLocationInfo({ ...bridge.getLocationInfo() });
    setTimeout(() => setIsRefreshingLoc(false), 800);
  };

  const hasLocationPermission = preciseLocation.status === 'granted' || preciseLocation.permissionState === 'granted';

  return (
    <div className={`w-full border-b backdrop-blur-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-30 transition-all duration-300 ${
      isDark
        ? 'bg-slate-950/70 hover:bg-slate-950/80 border-cyan-500/20 text-slate-200 shadow-[0_10px_30px_rgba(6,182,212,0.1)]'
        : 'bg-white/60 hover:bg-white/70 border-white/70 text-slate-800 shadow-[0_10px_30px_rgba(14,165,233,0.12)]'
    }`}>
      {/* Left: Live Clock & Date */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 font-mono font-bold ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
          <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-blue-500'}`} />
          <span>{timeStr}</span>
          <span className={`${isDark ? 'text-slate-600' : 'text-slate-300'} font-sans`}>•</span>
          <span className={`${isDark ? 'text-slate-300' : 'text-slate-700'} font-sans font-medium`}>{dateStr}</span>
        </div>

        {/* Center: Precise Location Display Always */}
        <div className={`flex items-center gap-1.5 border-l pl-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {hasLocationPermission ? (
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('iris-open-map', {
                      detail: {
                        center: { lat: preciseLocation.latitude, lng: preciseLocation.longitude },
                        zoom: 16,
                      },
                    })
                  );
                }
              }}
              title="Click to view your precise location on Google Maps"
              className={`flex items-center gap-1.5 font-medium transition-colors group cursor-pointer ${
                isDark ? 'text-slate-200 hover:text-cyan-400' : 'text-slate-800 hover:text-cyan-600'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform shrink-0" />
              <span className={`font-semibold max-w-[200px] sm:max-w-xs truncate underline underline-offset-2 ${
                isDark ? 'text-white decoration-slate-600' : 'text-slate-900 decoration-slate-300'
              }`}>
                {(() => {
                  const isRawCoords = (str?: string) => !str || /^[-+]?\d+\.\d+[\s,]+[-+]?\d+\.\d+$/.test(str.trim());
                  if (preciseLocation.formattedAddress && !isRawCoords(preciseLocation.formattedAddress)) {
                    return preciseLocation.formattedAddress;
                  }
                  if (preciseLocation.neighborhood && !isRawCoords(preciseLocation.neighborhood)) {
                    return `${preciseLocation.neighborhood}, ${preciseLocation.city || ''}`.replace(/,\s*$/, '');
                  }
                  if (preciseLocation.city && !isRawCoords(preciseLocation.city)) {
                    return `${preciseLocation.city}, ${preciseLocation.state || ''}`.replace(/,\s*$/, '');
                  }
                  return 'Indore, Madhya Pradesh';
                })()}
              </span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                isDark ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
              }`}>
                ±{preciseLocation.accuracy}m
              </span>
            </button>
          ) : (
            /* Button shown when permission is not granted */
            <button
              onClick={() => locationService.openAppInfoOrSettings()}
              title="Click to give precise location access to Iris and open Google Maps"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-semibold text-[11px] transition-all shadow-xs hover:scale-105 active:scale-95 group animate-pulse"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 group-hover:rotate-12 transition-transform shrink-0" />
              <span>Give Access to Location</span>
            </button>
          )}

          {/* Timezone & Refresh */}
          <span className={`${isDark ? 'text-slate-700' : 'text-slate-300'} hidden sm:inline`}>•</span>
          <div className={`hidden sm:flex items-center gap-1 font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Globe className={`hidden sm:inline w-3 h-3 ${isDark ? 'text-cyan-400' : 'text-blue-500'}`} />
            <span>{locationInfo.timezone}</span>
          </div>

          <button
            onClick={handleRefreshLocation}
            title="Refresh GPS location & timezone"
            className={`p-1 rounded transition-colors ml-0.5 ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-cyan-400' : 'hover:bg-slate-100 text-slate-400 hover:text-blue-600'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingLoc ? `animate-spin ${isDark ? 'text-cyan-400' : 'text-blue-600'}` : ''}`} />
          </button>
        </div>
      </div>

      {/* Right: Quick Navigation Action Buttons with Motion Blur Tactile Feedback */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenCalendar}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all spring-button ${
            isDark
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-blue-400'
              : 'bg-slate-100/90 hover:bg-blue-50 border-slate-200/80 hover:border-blue-300 text-slate-700 hover:text-blue-600'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden xs:inline">Calendar</span>
        </button>

        <button
          onClick={onOpenReminders}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all spring-button ${
            isDark
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-amber-400'
              : 'bg-slate-100/90 hover:bg-amber-50 border-slate-200/80 hover:border-amber-300 text-slate-700 hover:text-amber-700'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden xs:inline">Reminders</span>
        </button>

        <button
          onClick={onOpenNotes}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all spring-button ${
            isDark
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-indigo-400'
              : 'bg-slate-100/90 hover:bg-indigo-50 border-slate-200/80 hover:border-indigo-300 text-slate-700 hover:text-indigo-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden xs:inline">Notes</span>
        </button>

        <button
          onClick={onOpenNotifications}
          className={`relative px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all spring-button ${
            isDark
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-emerald-400'
              : 'bg-slate-100/90 hover:bg-emerald-50 border-slate-200/80 hover:border-emerald-300 text-slate-700 hover:text-emerald-700'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden xs:inline">Messages</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-bold text-[9px]">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenContacts}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all spring-button ${
            isDark
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-purple-400'
              : 'bg-slate-100/90 hover:bg-purple-50 border-slate-200/80 hover:border-purple-300 text-slate-700 hover:text-purple-700'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-purple-500" />
          <span className="hidden xs:inline">Contacts</span>
        </button>
      </div>
    </div>
  );
};

export const LocationTimeBar = React.memo(LocationTimeBarComponent);
