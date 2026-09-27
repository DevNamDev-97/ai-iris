import React, { useState, useEffect, useRef } from 'react';
import { AssistantState } from '../services/liveClient.ts';
import { triggerHaptic } from '../utils/haptics.ts';

interface IrisOrbProps {
  state: AssistantState;
  audioLevel: number; // 0.0 to 1.0
  onClick: () => void;
}

export const IrisOrb: React.FC<IrisOrbProps> = ({ state, audioLevel, onClick }) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const pathRef1 = useRef<SVGPathElement | null>(null);
  const pathRef2 = useRef<SVGPathElement | null>(null);
  const audioRef = useRef<number>(audioLevel);
  const stateRef = useRef<AssistantState>(state);

  useEffect(() => {
    audioRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 60 FPS Direct SVG Path Update Loop (zero React state re-render overhead)
  useEffect(() => {
    let animId: number;
    let startTime = performance.now();
    let smoothAmp = 0;

    const renderWave = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;
      const targetAudio = audioRef.current;
      const currentState = stateRef.current;
      const isActive = currentState === 'LISTENING' || currentState === 'SPEAKING' || currentState === 'CONNECTING';

      const baseAmp = isActive ? (currentState === 'SPEAKING' ? 14 : 9) : 3.5;
      const targetAmp = baseAmp + (targetAudio * 28);
      smoothAmp += (targetAmp - smoothAmp) * 0.18;

      const speed = isActive ? 5.5 : 2.2;
      const width = 320;
      const centerY = 40;
      const segments = 36;
      let pathData = '';

      for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * width;
        const normalizedDist = Math.abs(i - segments / 2) / (segments / 2);
        const envelope = Math.max(0, 1 - Math.pow(normalizedDist, 1.8));

        const wave1 = Math.sin(elapsed * speed + (i * 0.45));
        const wave2 = Math.cos(elapsed * (speed * 1.35) + (i * 0.8)) * 0.5;
        const wave3 = Math.sin(elapsed * (speed * 0.65) - (i * 0.3)) * 0.3;

        const yOffset = (wave1 + wave2 + wave3) * smoothAmp * envelope;
        const y = centerY + yOffset;

        if (i === 0) {
          pathData = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else {
          pathData += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      }

      if (pathRef1.current) pathRef1.current.setAttribute('d', pathData);
      if (pathRef2.current) pathRef2.current.setAttribute('d', pathData);

      animId = requestAnimationFrame(renderWave);
    };

    animId = requestAnimationFrame(renderWave);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    triggerHaptic('medium');
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };

    setRipples((prev) => [...prev.slice(-2), newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 700);

    onClick();
  };

  const isActive = state === 'LISTENING' || state === 'SPEAKING' || state === 'CONNECTING';
  const scaleMultiplier = 1 + Math.min(0.18, audioLevel * 0.22);
  const glowSpread = Math.min(75, 28 + audioLevel * 65);

  const getStatusLabel = () => {
    switch (state) {
      case 'SPEAKING':
        return 'SPEAKING';
      case 'LISTENING':
        return 'LISTENING';
      case 'CONNECTING':
        return 'LINKING...';
      case 'ERROR':
        return 'RECONNECT';
      case 'IDLE':
      default:
        return 'STANDBY';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center select-none relative my-2">
      {/* Outer Clickable Orb Shell */}
      <div
        onClick={handleContainerClick}
        className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center cursor-pointer group transition-transform duration-200 active:scale-95 will-change-transform"
      >
        {/* Click Shockwave Ripples */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full pointer-events-none animate-ping bg-blue-400/40"
            style={{
              left: ripple.x - 35,
              top: ripple.y - 35,
              width: 70,
              height: 70,
            }}
          />
        ))}

        {/* 1. Volumetric Blue Aura Bloom Glow */}
        <div
          className="absolute inset-0 rounded-full blur-3xl transition-all duration-200 pointer-events-none will-change-transform"
          style={{
            background:
              state === 'ERROR'
                ? 'radial-gradient(circle, rgba(239, 68, 68, 0.45) 0%, rgba(220, 38, 38, 0.2) 50%, transparent 75%)'
                : state === 'SPEAKING'
                ? 'radial-gradient(circle, rgba(0, 180, 255, 0.55) 0%, rgba(37, 99, 235, 0.32) 45%, rgba(59, 130, 246, 0.15) 75%)'
                : isActive
                ? 'radial-gradient(circle, rgba(0, 150, 255, 0.45) 0%, rgba(2, 132, 199, 0.28) 50%, transparent 75%)'
                : 'radial-gradient(circle, rgba(0, 140, 255, 0.32) 0%, rgba(59, 130, 246, 0.12) 55%, transparent 75%)',
            transform: `scale(${scaleMultiplier * 1.1})`,
          }}
        />

        {/* 2. Outer Orbital Ambient Rings with 60fps CSS Spin */}
        <div
          className={`absolute inset-2 rounded-full border border-blue-400/30 transition-all pointer-events-none will-change-transform ${
            isActive ? 'animate-spin-slow' : ''
          }`}
          style={{
            borderStyle: 'dashed',
            boxShadow: `0 0 ${glowSpread * 0.3}px rgba(0, 140, 255, 0.25)`,
          }}
        />

        <div
          className={`absolute inset-5 rounded-full border border-sky-300/40 pointer-events-none will-change-transform ${
            isActive ? 'animate-spin-reverse' : ''
          }`}
          style={{
            borderTopColor: 'transparent',
            borderRightColor: 'rgba(56, 189, 248, 0.8)',
            borderBottomColor: 'transparent',
            borderLeftColor: 'rgba(56, 189, 248, 0.8)',
          }}
        />

        {/* 3. Subtle HUD Reticle Target Brackets */}
        <div className="absolute inset-1 rounded-full pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-500/50" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-500/50" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500/50" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500/50" />
        </div>

        {/* 4. Central Advanced Glowing Blue Orb Sphere */}
        <div
          className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center transition-transform duration-200 overflow-hidden z-10 shadow-2xl animate-breathe-smooth will-change-transform"
          style={{
            background:
              state === 'ERROR'
                ? 'radial-gradient(circle at 35% 30%, #f87171 0%, #ef4444 35%, #b91c1c 70%, #450a0a 100%)'
                : state === 'SPEAKING'
                ? 'radial-gradient(circle at 35% 30%, #38bdf8 0%, #00d2ff 25%, #0284c7 55%, #1e40af 80%, #0f172a 100%)'
                : isActive
                ? 'radial-gradient(circle at 35% 30%, #38bdf8 0%, #0284c7 35%, #1d4ed8 65%, #0f172a 100%)'
                : 'radial-gradient(circle at 35% 30%, #38bdf8 0%, #0284c7 30%, #1e3a8a 65%, #0a0f1d 100%)',
            transform: `scale(${scaleMultiplier})`,
            boxShadow: `0 0 ${glowSpread}px ${
              state === 'ERROR' ? '#ef4444' : '#0099ff'
            }, inset 0 0 35px rgba(255, 255, 255, 0.4), 0 12px 30px rgba(0, 80, 200, 0.3)`,
            border: '2px solid rgba(255, 255, 255, 0.85)',
          }}
        >
          {/* Glass Specular Top Highlight */}
          <div className="absolute top-2 left-6 w-20 h-10 bg-white/40 rounded-full blur-sm -rotate-20 pointer-events-none" />

          {/* Holographic Concentric Depth Core */}
          <div className="absolute inset-4 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,240,255,0.25)_0%,transparent_70%)] pointer-events-none" />

          {/* Dynamic Audio Horizon Glow across the Bisecting Equator */}
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-10 pointer-events-none blur-md transition-opacity duration-200"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(0, 240, 255, 0.4) 30%, rgba(255, 255, 255, 0.7) 50%, rgba(0, 240, 255, 0.4) 70%, transparent 100%)',
              opacity: isActive ? 0.85 : 0.45,
            }}
          />

          {/* 5. Dynamic Bisecting Audio Wave Line */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <svg
              className="w-full h-24 overflow-visible"
              viewBox="0 0 320 80"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="waveGlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(0, 240, 255, 0)" />
                  <stop offset="20%" stopColor="rgba(0, 240, 255, 0.6)" />
                  <stop offset="50%" stopColor="#ffffff" />
                  <stop offset="80%" stopColor="rgba(0, 240, 255, 0.6)" />
                  <stop offset="100%" stopColor="rgba(0, 240, 255, 0)" />
                </linearGradient>
                <filter id="waveNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background Harmonic Ghost Wave */}
              <path
                ref={pathRef1}
                fill="none"
                stroke="rgba(56, 189, 248, 0.5)"
                strokeWidth="4"
                filter="url(#waveNeonGlow)"
                className="opacity-70"
              />

              {/* Primary Sharp Bisecting Wave Line */}
              <path
                ref={pathRef2}
                fill="none"
                stroke="url(#waveGlowGradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* 6. Centrally Positioned "I.R.I.S" Text & Status */}
          <div className="relative z-20 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <h1
              className="font-mono font-black text-2xl sm:text-3xl tracking-[0.28em] text-white drop-shadow-[0_0_18px_rgba(0,240,255,1)] transition-transform duration-200 group-hover:scale-105"
              style={{
                textShadow: '0 0 10px #ffffff, 0 0 20px #00f0ff, 0 0 30px #0284c7',
              }}
            >
              I.R.I.S
            </h1>

            {/* Status Pill */}
            <div className="flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-slate-950/40 backdrop-blur-md border border-white/30 shadow-inner">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  state === 'SPEAKING'
                    ? 'bg-cyan-300 animate-ping'
                    : state === 'LISTENING'
                    ? 'bg-emerald-300 animate-pulse'
                    : state === 'ERROR'
                    ? 'bg-rose-400'
                    : 'bg-cyan-400'
                }`}
              />
              <span className="text-[9px] font-mono font-bold tracking-widest text-cyan-100 uppercase">
                {getStatusLabel()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-orb Quick Interactive Cue */}
      <div className="mt-2 flex flex-col items-center text-center">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600/90 hover:text-blue-500 transition-colors">
          {state === 'IDLE' || state === 'ERROR' ? 'TAP ORB TO ENGAGE LINK' : 'TAP TO DISCONNECT'}
        </span>
      </div>
    </div>
  );
};
