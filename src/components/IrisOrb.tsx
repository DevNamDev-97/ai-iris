import React, { useState, useEffect, useRef } from 'react';
import { AssistantState } from '../services/liveClient.ts';
import { triggerHaptic } from '../utils/haptics.ts';

interface IrisOrbProps {
  state: AssistantState;
  audioLevel: number; // 0.0 to 1.0
  onClick: () => void;
  theme?: 'light' | 'dark';
  overscrollProgress?: number;
}

const IrisOrbComponent: React.FC<IrisOrbProps> = ({ state, audioLevel, onClick, theme = 'light', overscrollProgress = 0 }) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<number>(audioLevel);
  const stateRef = useRef<AssistantState>(state);
  const overscrollRef = useRef<number>(overscrollProgress);
  const isDark = theme === 'dark';

  useEffect(() => {
    audioRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    overscrollRef.current = overscrollProgress;
  }, [overscrollProgress]);

  // High-Performance 120 FPS Harmonic Waveform Silk Ribbon Renderer
  // Smoothly morphs from circular Iris Orb into straight voice-sensitive audio wave when opening Telemetry Panel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();
    let smoothAmp = 0;
    let velocityAmp = 0;
    let smoothRotation = 0;
    let smoothProgress = 0;
    let smoothCapOpacity = 0;
    let lastTime = performance.now();

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(rect.width || 440);
      const h = Math.round(rect.height || 440);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const render = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;
      const elapsed = (currentTime - startTime) / 1000;
      const currentAudio = audioRef.current;
      const currentState = stateRef.current;

      const isActive = currentState === 'LISTENING' || currentState === 'SPEAKING' || currentState === 'CONNECTING';

      // Base vibration amplitude depending on conversational state
      const baseAmp = isActive ? (currentState === 'SPEAKING' ? 24 : 15) : 7.5;
      const targetAmp = baseAmp + currentAudio * 46;

      // Spring physics (Fast attack, silky exponential decay)
      const stiffness = targetAmp > smoothAmp ? 26 : 14;
      velocityAmp += (targetAmp - smoothAmp) * stiffness * dt;
      velocityAmp *= Math.pow(0.85, dt * 60);
      smoothAmp += velocityAmp * dt;
      smoothAmp = Math.max(1, smoothAmp);

      // Smooth orbital rotation speed
      const rotSpeed = isActive ? (currentState === 'SPEAKING' ? 0.95 : 0.65) : 0.35;
      smoothRotation += rotSpeed * dt;

      // Telemetry panel transition synchronization
      const targetProgress = Math.max(0, Math.min(1, overscrollRef.current));
      const deltaProgress = targetProgress - smoothProgress;
      smoothProgress += deltaProgress * Math.min(dt * 14, 1);
      const isClosing = deltaProgress < -0.001;
      const p = smoothProgress;
      const smoothP = p * p * (3 - 2 * p); // Silky cubic smoothstep easing

      // Triangular caps fade-in / fade-out animation lifecycle:
      // - Opening: Fade in starts when telemetry panel is 70% opened (0.70 to 1.0)
      // - Closing: Fade out starts immediately at onset of closing (1.0) and ends just before telemetry panel closing gets 30% completed (smoothP = 0.72)
      let targetCapOpacity = 0;
      if (isClosing) {
        if (smoothP > 0.72) {
          targetCapOpacity = (smoothP - 0.72) / (1.0 - 0.72); // Fades out cleanly from 1.0 down to 0 at 0.72 (just before 30% closed)
        } else {
          targetCapOpacity = 0;
        }
      } else {
        if (smoothP >= 0.70) {
          targetCapOpacity = (smoothP - 0.70) / 0.30; // 70% opened reached: fade in smoothly up to 100%
        } else {
          targetCapOpacity = 0;
        }
      }
      targetCapOpacity = Math.min(1, Math.max(0, targetCapOpacity));
      const lerpSpeed = isClosing ? 26 : 16;
      smoothCapOpacity += (targetCapOpacity - smoothCapOpacity) * Math.min(dt * lerpSpeed, 1);

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const centerX = cssW / 2;
      const centerY = cssH / 2;

      // 1. Base radius for the perfect circular orb (scales gracefully on smaller mobile screens)
      const baseRadius = Math.min(136, Math.max(90, Math.min(cssW, cssH) * 0.32));

      // 2. Harmonic vertical compression: drops vertical height from 1.0 (circle) down to 0.0 (straight horizontal line)
      const verticalScale = Math.cos(smoothP * Math.PI * 0.5);

      // 3. Target wave length: exactly 70% of the telemetry panel length
      const telemetryPanelWidth = Math.min(768, Math.max(280, cssW));
      const targetWaveLength = telemetryPanelWidth * 0.70;
      const targetWaveRadius = targetWaveLength / 2;

      // Draw Multi-layered Harmonic Silk Ribbon Loops (32 fine lines x 128 points)
      const numLines = 32;
      const pointsPerLoop = 128;

      for (let i = 0; i < numLines; i++) {
        const progress = i / (numLines - 1); // 0 to 1
        const phaseOffset = progress * Math.PI * 1.9;
        const lineAmp = smoothAmp * (0.65 + 0.6 * Math.sin(progress * Math.PI));

        ctx.beginPath();

        // Solid Black with smooth harmonic alpha modulation
        const alpha = 0.22 + 0.68 * Math.sin(progress * Math.PI);
        ctx.globalAlpha = 1.0;

        if (currentState === 'ERROR') {
          ctx.strokeStyle = `rgba(220, 38, 38, ${alpha * 0.9})`;
        } else if (currentState === 'SPEAKING') {
          // Iris actively speaking: dynamic shifting visual ribbon in neon cyan, electric blue & purple gradients
          const r = Math.round(59 + 55 * Math.sin(progress * Math.PI + elapsed * 2.5));
          const g = Math.round(130 + 105 * Math.cos(progress * Math.PI - elapsed * 1.8));
          const b = Math.round(246 + 9 * Math.sin(progress * Math.PI * 2 + elapsed * 2.2));
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.95})`;
        } else if (currentState === 'CONNECTING') {
          // Iris processing/loading: unique warm cosmic amber/golden pulsing waves
          const r = Math.round(217 + 28 * Math.sin(elapsed * 5));
          const g = Math.round(119 + 30 * Math.cos(elapsed * 3));
          const b = Math.round(6 + 5 * Math.sin(elapsed * 4));
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.85})`;
        } else {
          // When user is speaking (LISTENING) or IDLE: clean, classic solid black
          ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.95})`;
        }

        ctx.lineWidth = 1.0 + (1 - Math.abs(progress - 0.5) * 2) * 0.85;

        // Pattern Coefficients changes based on processing vs speaking
        let wave1Multiplier = 4;
        let wave2Multiplier = 3;
        let wave3Multiplier = 6;
        let wave4Multiplier = 2;

        if (currentState === 'CONNECTING') {
          wave1Multiplier = 8;
          wave2Multiplier = 5;
          wave3Multiplier = 11;
          wave4Multiplier = 3;
        } else if (currentState === 'SPEAKING') {
          wave1Multiplier = 3;
          wave2Multiplier = 2;
          wave3Multiplier = 5;
          wave4Multiplier = 4;
        }

        // Dynamic morphing multipliers to make waves flow and breathe beautifully
        const morph1 = 0.78 + 0.15 * Math.sin(elapsed * 1.4);
        const morph2 = 0.48 + 0.12 * Math.cos(elapsed * 1.1);
        const morph3 = 0.28 + 0.08 * Math.sin(elapsed * 1.8);
        const morph4 = 0.38 + 0.10 * Math.cos(elapsed * 0.9);

        // Voice wave frequencies for straight compressed wave
        const waveFreq1 = 3.5;
        const waveFreq2 = 6.0;
        const waveFreq3 = 8.5;
        const layerYOffset = (progress - 0.5) * 8 * smoothP;

        for (let j = 0; j <= pointsPerLoop; j++) {
          const theta = (j / pointsPerLoop) * Math.PI * 2;

          // Harmonic multi-frequency parametric rosette equation
          const wave1 = Math.sin(theta * wave1Multiplier + smoothRotation * 1.2 + phaseOffset + elapsed * 1.5) * lineAmp * morph1;
          const wave2 = Math.cos(theta * wave2Multiplier - smoothRotation * 0.8 + phaseOffset * 1.4 - elapsed * 1.2) * lineAmp * morph2;
          const wave3 = Math.sin(theta * wave3Multiplier + smoothRotation * 2.1 - phaseOffset * 0.6 + elapsed * 2.0) * (lineAmp * morph3);
          const wave4 = Math.cos(theta * wave4Multiplier + elapsed * 1.5 + phaseOffset * 0.8) * (lineAmp * morph4);

          const r = baseRadius + wave1 + wave2 + wave3 + wave4;

          // When smoothP = 0: currentRadiusX = r (pure isotropic circle in X and Y!)
          // When smoothP = 1: currentRadiusX = targetWaveRadius (70% length of telemetry panel!)
          const currentRadiusX = (1 - smoothP) * r + smoothP * (targetWaveRadius + (wave1 + wave2) * 0.25);
          const x = centerX + Math.cos(theta) * currentRadiusX;

          // When smoothP = 0: y_ellipse = sin(theta) * r (pure circle!)
          // As smoothP increases: compresses vertically into an ellipse and then into a straight wave
          const y_ellipse = Math.sin(theta) * r * verticalScale;

          // Voice-sensitive audio oscillation along the straight line
          const envelope = Math.abs(Math.sin(theta));
          const waveH1 = Math.sin(theta * waveFreq1 + elapsed * 3.8 + phaseOffset) * (lineAmp * 1.6);
          const waveH2 = Math.cos(theta * waveFreq2 - elapsed * 2.4 + progress * 2.2) * (lineAmp * 0.75);
          const waveH3 = Math.sin(theta * waveFreq3 + elapsed * 4.2) * (lineAmp * 0.35);
          const voiceWave = (waveH1 + waveH2 + waveH3) * envelope * smoothP + layerYOffset;

          const y = centerY + y_ellipse + voiceWave;

          if (j === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.closePath();
        ctx.stroke();
      }

      // Render 2 Glowing Triangular Bars on the starting & end points of the straight wave
      // to cleanly frame and cap the audio wave endpoints with glowing triangular light chevrons
      if (smoothCapOpacity > 0.005) {
        const barOpacity = smoothCapOpacity;
        const tipRadius = (1 - smoothP) * baseRadius + smoothP * targetWaveRadius;
        const leftX = centerX - tipRadius;
        const rightX = centerX + tipRadius;
        const tipY = centerY;

        // Triangular dimensions (compact vertical height, prominent triangular width)
        const triHeight = 22;
        const triWidth = 14;

        const drawTrianglePath = (cx: number, cy: number, w: number, h: number, dir: 'right' | 'left') => {
          const hw = w / 2;
          const hh = h / 2;
          ctx.beginPath();
          if (dir === 'right') {
            ctx.moveTo(cx + hw, cy);
            ctx.lineTo(cx - hw, cy - hh);
            ctx.lineTo(cx - hw, cy + hh);
          } else {
            ctx.moveTo(cx - hw, cy);
            ctx.lineTo(cx + hw, cy - hh);
            ctx.lineTo(cx + hw, cy + hh);
          }
          ctx.closePath();
        };

        const drawGlowingTriangle = (bx: number, by: number, dir: 'right' | 'left') => {
          ctx.save();
          ctx.globalAlpha = barOpacity;
          ctx.lineJoin = 'round';

          // 1. Broad soft ambient neon glow around the triangle
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 6;
          drawTrianglePath(bx, by, triWidth + 6, triHeight + 6, dir);
          ctx.fill();
          ctx.stroke();

          // Vibrant energy aura
          const auraColor = currentState === 'SPEAKING' 
            ? 'rgba(34, 211, 238, 0.45)' 
            : 'rgba(255, 255, 255, 0.38)';
          ctx.fillStyle = auraColor;
          ctx.strokeStyle = auraColor;
          ctx.lineWidth = 3;
          drawTrianglePath(bx, by, triWidth + 2, triHeight + 2, dir);
          ctx.fill();
          ctx.stroke();

          // 2. High-intensity glowing white core
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          drawTrianglePath(bx, by, triWidth, triHeight, dir);
          ctx.fill();
          ctx.stroke();

          // 3. Crisp bright center specular highlight
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          drawTrianglePath(bx, by, triWidth * 0.55, triHeight * 0.55, dir);
          ctx.fill();

          ctx.restore();
        };

        drawGlowingTriangle(leftX, tipY, 'right');
        drawGlowingTriangle(rightX, tipY, 'left');
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
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
    }, 750);

    onClick();
  };

  const isActive = state === 'LISTENING' || state === 'SPEAKING' || state === 'CONNECTING';
  const scaleMultiplier = 1 + Math.min(0.14, audioLevel * 0.18);

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
    <div className="flex flex-col items-center justify-center select-none relative my-2 w-full">
      {/* Clickable Floating Harmonic Wave Canvas Container */}
      <div
        role="button"
        tabIndex={0}
        aria-label={state === 'IDLE' || state === 'ERROR' ? 'Tap to start voice session' : 'Tap to disconnect voice session'}
        onClick={handleContainerClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className="relative w-full max-w-[720px] h-[340px] sm:h-[380px] md:h-[440px] flex items-center justify-center cursor-pointer group transition-transform duration-300 active:scale-95 will-change-transform outline-none"
      >
        {/* Click Shockwave Ripples */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full pointer-events-none animate-ping bg-slate-900/20"
            style={{
              left: ripple.x - 45,
              top: ripple.y - 45,
              width: 90,
              height: 90,
              filter: 'blur(2px)',
            }}
          />
        ))}

        {/* 1. Subtle Clean Ambient Circular Halo Behind the Waves */}
        <div
          className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full blur-3xl transition-all duration-500 pointer-events-none will-change-transform opacity-30"
          style={{
            background:
              state === 'ERROR'
                ? 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, transparent 70%)'
                : state === 'SPEAKING'
                ? 'radial-gradient(circle, rgba(14, 116, 144, 0.25) 0%, rgba(30, 58, 138, 0.15) 50%, transparent 75%)'
                : isActive
                ? 'radial-gradient(circle, rgba(30, 58, 138, 0.2) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(203, 213, 225, 0.4) 0%, transparent 70%)',
            transform: `scale(${scaleMultiplier * 1.1})`,
            opacity: Math.max(0, 0.3 * (1 - overscrollProgress * 2.0)),
          }}
        />

        {/* 2. HTML5 Canvas Rendering Harmonic Ribbon Waves */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            transform: `scale(${scaleMultiplier})`,
            filter: state === 'ERROR' ? 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.4))' : 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12))',
            opacity: 1.0,
            transition: 'opacity 0.08s ease-out',
          }}
          className="z-10 pointer-events-none transition-transform duration-100 will-change-transform"
        />

        {/* 3. Floating Central Futuristic Gradient Text (Wider Tracking / Longer Span, No Button) */}
        <div 
          style={{
            opacity: Math.max(0, 1 - overscrollProgress * 2.0),
            transition: 'opacity 0.08s ease-out',
          }}
          className="absolute z-20 flex flex-col items-center justify-center text-center pointer-events-none select-none"
        >
          <span
            className="font-mono font-black text-[13px] sm:text-[14px] uppercase bg-gradient-to-r from-blue-900 via-cyan-800 to-indigo-950 dark:from-blue-700 dark:via-cyan-600 dark:to-indigo-800 bg-clip-text text-transparent drop-shadow-xs transition-all duration-300"
            style={{
              fontSize: '13px',
              letterSpacing: '0.52em', // Increased length/width of text span
              paddingLeft: '0.52em', // Centering compensation
            }}
          >
            I.R.I.S
          </span>

          {/* Minimalist Micro Status Dot & Text - PURE SOLID BLACK */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                state === 'SPEAKING'
                  ? 'bg-cyan-700 animate-ping shadow-[0_0_6px_rgba(14,116,144,0.8)]'
                  : state === 'LISTENING'
                  ? 'bg-emerald-700 animate-pulse shadow-[0_0_6px_rgba(4,120,87,0.8)]'
                  : state === 'ERROR'
                  ? 'bg-rose-700 shadow-[0_0_6px_rgba(190,18,60,0.8)]'
                  : 'bg-black shadow-[0_0_4px_rgba(0,0,0,0.5)]'
              }`}
            />
            <span className="text-[8.5px] font-mono font-black tracking-widest uppercase text-black">
              {getStatusLabel()}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-orb Quick Interactive Cue in Solid Pure Black */}
      <div 
        style={{
          opacity: Math.max(0, 1 - overscrollProgress * 2.0),
          transition: 'opacity 0.08s ease-out',
        }}
        className="mt-1 flex flex-col items-center text-center"
      >
        <span className="text-[10px] font-mono font-black uppercase tracking-wider text-black hover:opacity-80 transition-opacity">
          {state === 'IDLE' || state === 'ERROR' ? 'TAP WAVES TO ENGAGE LINK' : 'TAP TO DISCONNECT'}
        </span>
      </div>
    </div>
  );
};

export const IrisOrb = React.memo(IrisOrbComponent);
