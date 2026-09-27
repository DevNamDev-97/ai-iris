import React, { useEffect, useState } from 'react';
import { screenAnnotationService, HighlightShape } from '../services/screenAnnotationService.ts';
import { screenShareService, CursorPosition } from '../services/screenShareService.ts';
import { Sparkles, Trash2, Crosshair, Eye, X, Compass, MousePointer } from 'lucide-react';

export const ScreenAnnotationOverlay: React.FC = () => {
  const [highlights, setHighlights] = useState<HighlightShape[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [cursor, setCursor] = useState<CursorPosition>({ x: 50, y: 50, pxX: 0, pxY: 0, lastMoved: Date.now() });
  const [showMinimap, setShowMinimap] = useState(false);

  useEffect(() => {
    const unsubscribe = screenAnnotationService.subscribe((items) => {
      setHighlights(items);
    });

    const interval = setInterval(() => {
      setIsSharing(screenShareService.getIsSharing());
      setCursor(screenShareService.getCursorPosition());
    }, 200);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleClearAll = () => {
    screenAnnotationService.clearAll();
  };

  const handleRemoveOne = (id: string) => {
    screenAnnotationService.removeHighlight(id);
  };

  const getColorClasses = (color?: string) => {
    switch (color) {
      case 'rose':
      case 'red':
        return {
          border: 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]',
          bg: 'bg-rose-500/15',
          text: 'text-rose-400 bg-rose-950/80 border-rose-500/40',
          svg: '#f43f5e',
        };
      case 'emerald':
      case 'green':
        return {
          border: 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.6)]',
          bg: 'bg-emerald-500/15',
          text: 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40',
          svg: '#34d399',
        };
      case 'amber':
      case 'yellow':
        return {
          border: 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]',
          bg: 'bg-amber-500/15',
          text: 'text-amber-300 bg-amber-950/80 border-amber-500/40',
          svg: '#fbbf24',
        };
      case 'purple':
        return {
          border: 'border-purple-400 shadow-[0_0_20px_rgba(192,132,252,0.6)]',
          bg: 'bg-purple-500/15',
          text: 'text-purple-300 bg-purple-950/80 border-purple-500/40',
          svg: '#c084fc',
        };
      case 'cyan':
      case 'blue':
      default:
        return {
          border: 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]',
          bg: 'bg-cyan-500/15',
          text: 'text-cyan-300 bg-cyan-950/80 border-cyan-500/40',
          svg: '#22d3ee',
        };
    }
  };

  if (highlights.length === 0 && !isSharing) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {/* 1. HIGHLIGHT SHAPES LAYER */}
      {highlights.map((hl) => {
        const colors = getColorClasses(hl.color);
        const left = `${Math.max(0, Math.min(100, hl.x))}%`;
        const top = `${Math.max(0, Math.min(100, hl.y))}%`;
        const width = `${Math.max(5, Math.min(100, hl.width || 20))}%`;
        const height = `${Math.max(5, Math.min(100, hl.height || 15))}%`;

        if (hl.type === 'rect' || hl.type === 'spotlight') {
          return (
            <div
              key={hl.id}
              className="absolute pointer-events-auto transition-all duration-300 ease-out animate-fadeIn"
              style={{ left, top, width, height }}
            >
              {/* Glowing pulsating bounding box */}
              <div
                className={`w-full h-full rounded-xl border-2 ${colors.border} ${colors.bg} relative backdrop-blur-[1px] animate-pulse`}
              >
                {/* Corner Crosshair brackets */}
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-sm" />
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-sm" />
                <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-sm" />
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-white rounded-br-sm" />

                {/* Top Label Badge */}
                {hl.label && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap z-50">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border shadow-lg ${colors.text} backdrop-blur-md`}
                    >
                      <Sparkles className="w-3.5 h-3.5 animate-spin-slow shrink-0" />
                      <span>{hl.label}</span>
                      <button
                        onClick={() => handleRemoveOne(hl.id)}
                        className="ml-1 text-slate-300 hover:text-white transition-colors"
                        title="Dismiss highlight"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (hl.type === 'circle' || hl.type === 'laser') {
          return (
            <div
              key={hl.id}
              className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 transition-all duration-300 animate-fadeIn"
              style={{ left, top }}
            >
              <div className="relative flex items-center justify-center">
                {/* Pulsing laser target ring */}
                <div
                  className={`w-16 h-16 rounded-full border-2 ${colors.border} ${colors.bg} animate-ping absolute opacity-75`}
                />
                <div className={`w-12 h-12 rounded-full border-2 ${colors.border} ${colors.bg} relative flex items-center justify-center shadow-lg`}>
                  <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_#fff]" />
                  <Crosshair className="w-8 h-8 text-white opacity-80 absolute" />
                </div>

                {/* Label */}
                {hl.label && (
                  <div className="absolute top-14 whitespace-nowrap z-50">
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border shadow-lg ${colors.text} backdrop-blur-md`}>
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>{hl.label}</span>
                      <button onClick={() => handleRemoveOne(hl.id)} className="ml-1 text-slate-300 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (hl.type === 'arrow') {
          const startX = hl.startX !== undefined ? hl.startX : hl.x - 10;
          const startY = hl.startY !== undefined ? hl.startY : hl.y - 10;
          return (
            <div key={hl.id} className="absolute inset-0 pointer-events-auto animate-fadeIn">
              <svg className="w-full h-full">
                <defs>
                  <marker
                    id={`arrowhead-${hl.id}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill={colors.svg} />
                  </marker>
                </defs>
                <line
                  x1={`${startX}%`}
                  y1={`${startY}%`}
                  x2={`${hl.x}%`}
                  y2={`${hl.y}%`}
                  stroke={colors.svg}
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  markerEnd={`url(#arrowhead-${hl.id})`}
                  className="animate-pulse"
                />
              </svg>
              {hl.label && (
                <div
                  className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(startX + hl.x) / 2}%`, top: `${(startY + hl.y) / 2}%` }}
                >
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border shadow-lg ${colors.text} backdrop-blur-md`}>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{hl.label}</span>
                    <button onClick={() => handleRemoveOne(hl.id)} className="ml-1 text-slate-300 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }

        return null;
      })}

      {/* 2. LIVE CURSOR TRACKING OVERLAY RADAR */}
      {isSharing && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out pointer-events-none z-30"
          style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
        >
          {/* Glowing Cursor Radar Ring */}
          <div className="relative flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400/80 bg-cyan-400/10 animate-ping absolute" />
            <div className="w-5 h-5 rounded-full border border-white bg-rose-500/80 flex items-center justify-center shadow-[0_0_12px_#ff0055]">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            {/* Coordinates Badge */}
            <div className="absolute top-6 left-6 px-2 py-0.5 rounded-md bg-slate-900/90 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 whitespace-nowrap backdrop-blur-sm shadow-md">
              <span className="font-bold">CURSOR</span> X:{cursor.x}% Y:{cursor.y}%
            </div>
          </div>
        </div>
      )}

      {/* 3. FLOATING ANNOTATIONS CONTROL TOOLBAR */}
      <div className="absolute bottom-6 right-6 pointer-events-auto flex items-center gap-2 z-50">
        {highlights.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700 text-rose-400 hover:text-rose-300 hover:border-rose-500/50 text-xs font-mono font-medium shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95"
            title="Clear all screen highlights drawn by Iris"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Highlights ({highlights.length})</span>
          </button>
        )}

        {isSharing && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-xl backdrop-blur-md">
            <MousePointer className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Iris Screen Tracker Active</span>
            <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-2">
              X:{cursor.x}% Y:{cursor.y}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
