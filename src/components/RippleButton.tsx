import React, { useState } from 'react';
import { triggerHaptic } from '../utils/haptics.ts';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  hapticType?: 'light' | 'medium' | 'heavy' | 'double';
}

export const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  hapticType = 'light',
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic(hapticType);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = { id: Date.now(), x, y };

    setRipples((prev) => [...prev.slice(-2), ripple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
    }, 600);

    if (onClick) onClick(e);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 hover:from-cyan-300 hover:to-blue-300 text-slate-950 font-bold border border-cyan-200/80 shadow-[0_0_15px_rgba(34,211,238,0.35)] hover:shadow-[0_0_22px_rgba(34,211,238,0.55)]';
      case 'secondary':
        return 'bg-slate-900/80 hover:bg-slate-800 text-cyan-200 hover:text-white border border-cyan-400/30 hover:border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.15)]';
      case 'danger':
        return 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 hover:text-white border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.25)]';
      case 'ghost':
        return 'bg-cyan-950/20 hover:bg-cyan-900/40 text-cyan-300 hover:text-white border border-cyan-500/20';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-2.5 py-1 text-xs rounded-xl';
      case 'md':
        return 'px-3.5 py-1.5 text-xs sm:text-sm rounded-xl';
      case 'lg':
        return 'px-5 py-2.5 text-sm sm:text-base rounded-2xl';
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`relative overflow-hidden spring-button flex items-center justify-center gap-1.5 select-none ${getVariantStyles()} ${getSizeStyles()} ${className}`}
      {...props}
    >
      {/* Expanding Ripple Shockwaves */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-ping bg-white/40 will-change-transform"
          style={{
            left: ripple.x - 20,
            top: ripple.y - 20,
            width: 40,
            height: 40,
          }}
        />
      ))}
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  );
};
