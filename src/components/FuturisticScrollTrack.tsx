import React, { useEffect, useRef, useState, useCallback } from 'react';

interface FuturisticScrollTrackProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
  autoScrollOnUpdate?: any;
}

/**
 * Futuristic Robotic Scroll Container with an auto-fading track and a glowing sliding cyber orb ball.
 */
export const FuturisticScrollTrack: React.FC<FuturisticScrollTrackProps> = ({
  children,
  className = '',
  maxHeight = '100%',
  autoScrollOnUpdate,
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [hasOverflow, setHasOverflow] = useState(false);
  const hideTimerRef = useRef<any>(null);

  // Update scroll metrics
  const updateScrollMetrics = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const overflow = maxScroll > 4;
    setHasOverflow((prev) => (prev !== overflow ? overflow : prev));

    if (overflow && maxScroll > 0) {
      const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
      setScrollProgress((prev) => (Math.abs(prev - progress) > 0.005 ? progress : prev));
    } else {
      setScrollProgress((prev) => (prev !== 0 ? 0 : prev));
    }
  }, []);

  const triggerScrollVisibility = useCallback(() => {
    setIsScrolling(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1300);
  }, []);

  // Handle native scroll
  const handleScroll = () => {
    updateScrollMetrics();
    triggerScrollVisibility();
  };

  // Auto scroll on updates if requested
  useEffect(() => {
    if (autoScrollOnUpdate !== undefined && contentRef.current) {
      contentRef.current.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: 'smooth',
      });
      updateScrollMetrics();
    }
  }, [autoScrollOnUpdate, updateScrollMetrics]);

  // Initial overflow measurement and window resize listener
  useEffect(() => {
    updateScrollMetrics();
    const handleResize = () => updateScrollMetrics();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [updateScrollMetrics]);

  // Handle clicking or dragging on the robotic track
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !contentRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const progress = Math.min(1, Math.max(0, clickY / rect.height));
    const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;
    contentRef.current.scrollTo({
      top: progress * maxScroll,
      behavior: 'smooth',
    });
    triggerScrollVisibility();
  };

  const handleOrbMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    triggerScrollVisibility();

    const startY = e.clientY;
    const startScrollTop = contentRef.current ? contentRef.current.scrollTop : 0;
    const trackHeight = trackRef.current ? trackRef.current.clientHeight : 1;
    const contentHeight = contentRef.current ? contentRef.current.scrollHeight - contentRef.current.clientHeight : 1;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const scrollDelta = (deltaY / trackHeight) * contentHeight;
      if (contentRef.current) {
        contentRef.current.scrollTop = startScrollTop + scrollDelta;
        triggerScrollVisibility();
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const isVisible = hasOverflow && (isScrolling || isHovered || isDragging);

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ maxHeight }}
      onMouseEnter={() => {
        setIsHovered(true);
        triggerScrollVisibility();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Actual Scrollable Content (Native scrollbar hidden) */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto no-scrollbar"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {children}
      </div>

      {/* Futuristic Robotic Rail & Sliding Cyber Orb */}
      {hasOverflow && (
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className={`absolute top-2 bottom-2 right-1 w-3 sm:w-3.5 flex items-center justify-center cursor-pointer transition-all duration-500 pointer-events-auto select-none z-30 ${
            isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          title="Futuristic Nav Rail - Click or drag orb to scroll"
        >
          {/* Cyber Track Line */}
          <div className="relative w-1 h-full bg-slate-950/80 rounded-full border border-cyan-500/30 overflow-hidden shadow-[inset_0_0_6px_rgba(6,182,212,0.4)]">
            {/* Inner Glowing Laser Rail */}
            <div className="absolute inset-x-0 top-0 bottom-0 bg-gradient-to-b from-cyan-500/20 via-blue-500/40 to-cyan-500/20" />

            {/* Subtle Circuit Grid Ticks on the Rail */}
            <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between py-1 opacity-60 pointer-events-none">
              <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_3px_#22d3ee]" />
              <div className="w-full h-0.5 bg-cyan-500/40" />
              <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_3px_#22d3ee]" />
              <div className="w-full h-0.5 bg-cyan-500/40" />
              <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_3px_#22d3ee]" />
            </div>
          </div>

          {/* Futuristic Sliding Orb Ball */}
          <div
            onMouseDown={handleOrbMouseDown}
            style={{
              top: `calc(${scrollProgress * 100}% - ${scrollProgress * 14}px)`,
            }}
            className="absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform active:scale-125 z-40 group"
          >
            {/* Outer Pulsing Neon Halo Ring */}
            <div className="absolute inset-0 rounded-full bg-cyan-400/30 blur-[2px] animate-pulse" />

            {/* Spherical Glowing Cyber Ball */}
            <div className="relative w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 rounded-full bg-gradient-to-tr from-blue-600 via-cyan-400 to-white shadow-[0_0_10px_#06b6d4,0_0_18px_#3b82f6] border border-cyan-200 flex items-center justify-center">
              {/* Core Arc Glow */}
              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_4px_#ffffff]" />
            </div>

            {/* Orbiting Ring Indicator */}
            <div className="absolute -inset-0.5 rounded-full border border-cyan-300/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      )}
    </div>
  );
};
