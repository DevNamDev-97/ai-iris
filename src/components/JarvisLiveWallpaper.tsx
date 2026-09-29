import React, { useEffect, useRef } from 'react';
import { triggerHaptic } from '../utils/haptics.ts';

interface JarvisLiveWallpaperProps {
  audioLevel?: number; // 0.0 to 1.0
  isLiveActive?: boolean;
}

interface RealisticWaterRipple {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  amplitude: number;
  decay: number;
  spawnTime: number;
  hasRebounded?: boolean;
}

interface MotionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  size: number;
  baseAlpha: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export const JarvisLiveWallpaper: React.FC<JarvisLiveWallpaperProps> = ({
  audioLevel = 0,
  isLiveActive = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioLevelRef = useRef<number>(audioLevel);
  const isLiveActiveRef = useRef<boolean>(isLiveActive);
  const waterRipplesRef = useRef<RealisticWaterRipple[]>([]);

  // Sync refs without tearing down canvas loop
  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    isLiveActiveRef.current = isLiveActive;
  }, [isLiveActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    // Global Realistic Liquid Water Ripple Pointer Event
    const handlePointerDown = (e: PointerEvent) => {
      const newRipple: RealisticWaterRipple = {
        id: performance.now() + Math.random(),
        x: e.clientX,
        y: e.clientY,
        radius: 2,
        maxRadius: 200 + Math.random() * 60,
        speed: 175 + Math.random() * 35,
        amplitude: 1.0,
        decay: 1.1,
        spawnTime: performance.now(),
        hasRebounded: false,
      };

      if (waterRipplesRef.current.length > 12) {
        waterRipplesRef.current.shift();
      }
      waterRipplesRef.current.push(newRipple);
      triggerHaptic('light');
    };

    window.addEventListener('pointerdown', handlePointerDown);

    // Particle system with 360-degree randomized directional velocity vectors and shimmer controls
    const particleCount = 65;
    const particles: MotionParticle[] = Array.from({ length: particleCount }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.12 + Math.random() * 0.48;
      const baseVx = Math.cos(angle) * speed;
      const baseVy = Math.sin(angle) * speed;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: baseVx,
        vy: baseVy,
        baseVx,
        baseVy,
        size: 1.0 + Math.random() * 2.5,
        baseAlpha: 0.15 + Math.random() * 0.45,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.04 + Math.random() * 0.08, // faster shimmer speeds
      };
    });

    let rotationAngle = 0;
    let gridOffset = 0;
    let smoothAudio = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // high-rate dt capping
      lastTime = now;

      // Silky audio response with dual-rate interpolation
      const targetAudio = audioLevelRef.current;
      smoothAudio += (targetAudio - smoothAudio) * Math.min(1, dt * 16);

      const isActive = isLiveActiveRef.current;
      const cx = width / 2;
      const cy = height / 2;

      // 1. Base Clean White Canvas Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 2. Smooth Radial Sky-Blue Ambient Bloom
      const maxDim = Math.max(width, height);
      const bloomRadius = maxDim * (0.68 + smoothAudio * 0.18);
      const baseGlow = ctx.createRadialGradient(cx, cy, 30, cx, cy, bloomRadius);

      const centerAlpha = 0.09 + smoothAudio * 0.24;
      const midAlpha = 0.035 + smoothAudio * 0.09;

      baseGlow.addColorStop(0, `rgba(14, 165, 233, ${centerAlpha})`);
      baseGlow.addColorStop(0.35, `rgba(59, 130, 246, ${midAlpha})`);
      baseGlow.addColorStop(0.75, `rgba(248, 250, 252, 0.96)`);
      baseGlow.addColorStop(1, '#ffffff');

      ctx.fillStyle = baseGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Subtle Futuristic Cyber Grid with Sub-pixel Smooth Pacing
      ctx.save();
      const gridAlpha = 0.038 + smoothAudio * 0.035;
      ctx.strokeStyle = `rgba(2, 132, 199, ${gridAlpha})`;
      ctx.lineWidth = 0.75;

      const gridSize = 64;
      gridOffset = (gridOffset + dt * 7.5) % gridSize;

      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = gridOffset; y <= height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      ctx.restore();

      // 4. Realistic 3D Liquid Water Ripple Waves with Refractive Motion Blur
      const ripples = waterRipplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed * dt;
        const progress = r.radius / r.maxRadius;

        // Damped fluid wave amplitude decay
        r.amplitude = Math.exp(-progress * r.decay);
        const waveAlpha = Math.max(0, r.amplitude * 0.8);

        if (progress >= 1 || waveAlpha <= 0.01) {
          ripples.splice(i, 1);
          continue;
        }

        // Secondary Rebound Ripple
        if (!r.hasRebounded && r.radius > 38 && ripples.length < 14) {
          r.hasRebounded = true;
          ripples.push({
            id: performance.now() + Math.random(),
            x: r.x,
            y: r.y,
            radius: 2,
            maxRadius: r.maxRadius * 0.65,
            speed: r.speed * 0.88,
            amplitude: r.amplitude * 0.65,
            decay: 1.35,
            spawnTime: now,
            hasRebounded: true,
          });
        }

        // Render Realistic Liquid Wave Crest & Refraction Rings with Motion Blur
        ctx.save();

        // 4a. Water Wave Base Refraction Surface Fill with Motion Blur Gradient
        const waveGradient = ctx.createRadialGradient(
          r.x,
          r.y,
          Math.max(0, r.radius - 16),
          r.x,
          r.y,
          r.radius + 16
        );
        waveGradient.addColorStop(0, `rgba(56, 189, 248, 0)`);
        waveGradient.addColorStop(0.5, `rgba(56, 189, 248, ${waveAlpha * 0.28})`);
        waveGradient.addColorStop(1, `rgba(2, 132, 199, 0)`);

        ctx.fillStyle = waveGradient;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius + 16, 0, Math.PI * 2);
        ctx.fill();

        // 4b. Deep Water Shadow Arc (3D Bottom-Right Water Displacement)
        ctx.strokeStyle = `rgba(2, 132, 199, ${waveAlpha * 0.55})`;
        ctx.lineWidth = Math.max(1, 3.8 * (1 - progress));
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();

        // 4c. Specular Sunlight Water Crest Highlight Arc (Top-Left Reflection)
        ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha * 0.98})`;
        ctx.lineWidth = Math.max(1, 2.8 * (1 - progress));
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius - 1, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();

        // 4d. Primary Outer Water Wave Crest Ring with Motion Blur Softness
        ctx.strokeStyle = `rgba(14, 165, 233, ${waveAlpha * 0.65})`;
        ctx.lineWidth = Math.max(0.75, 2.2 * (1 - progress));
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 4e. Secondary Concentric Harmonic Trough Ring
        if (r.radius > 20) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha * 0.55})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.72, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();

          ctx.strokeStyle = `rgba(2, 132, 199, ${waveAlpha * 0.35})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.72, Math.PI * 0.1, Math.PI * 0.9);
          ctx.stroke();
        }

        ctx.restore();

        // Water Wave Displacement Velocity Impulse on Floating Dust Particles
        particles.forEach((p) => {
          const dx = p.x - r.x;
          const dy = p.y - r.y;
          const dist = Math.hypot(dx, dy);
          if (Math.abs(dist - r.radius) < 26) {
            const pushFactor = (1 - Math.abs(dist - r.radius) / 26) * waveAlpha * 2.4;
            p.vx += (dx / (dist || 1)) * pushFactor * 1.8;
            p.vy += (dy / (dist || 1)) * pushFactor * 1.8;
          }
        });
      }

      // 5. Ambient HUD Dial Rings with Motion Blur Radial Dashes
      ctx.save();
      ctx.translate(cx, cy);
      rotationAngle += (0.14 + smoothAudio * 0.45) * dt;

      const reactorRadius = Math.min(width, height) * 0.35;

      // Outer Dial Ring
      ctx.save();
      ctx.rotate(rotationAngle * 0.38);
      ctx.strokeStyle = `rgba(2, 132, 199, ${0.07 + smoothAudio * 0.1})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([14, 18, 5, 18]);
      ctx.beginPath();
      ctx.arc(0, 0, reactorRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Inner Counter-Rotating Dial Ring with Motion Blur Dashes
      ctx.save();
      ctx.rotate(-rotationAngle * 0.8);
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.06 + smoothAudio * 0.09})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([22, 18, 8, 18]);
      ctx.beginPath();
      ctx.arc(0, 0, reactorRadius * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // 6. Floating Particles with Directional Velocity Motion Blur Streaks
      particles.forEach((p) => {
        // Apply ambient velocity & audio lift with spring damping
        p.vx += (p.baseVx * (1 + smoothAudio * 0.7) - p.vx) * 0.08;
        p.vy += (p.baseVy * (1 + smoothAudio * 0.7) - p.vy) * 0.08;

        p.x += p.vx * (dt * 60);
        p.y += p.vy * (dt * 60);
        p.pulsePhase += p.pulseSpeed * (dt * 60);

        // Responsive wrapping for 360 degree particle drifts
        if (p.y < -20) {
          p.y = height + 15;
          p.x = Math.random() * width;
        } else if (p.y > height + 20) {
          p.y = -15;
          p.x = Math.random() * width;
        }
        if (p.x < -20) {
          p.x = width + 15;
          p.y = Math.random() * height;
        } else if (p.x > width + 20) {
          p.x = -15;
          p.y = Math.random() * height;
        }

        // Shimmer term
        const shimmer = 0.7 + 0.3 * Math.sin(p.pulsePhase * 7.5 + p.x * 0.02);
        const dynamicAlpha = p.baseAlpha * (0.45 + Math.sin(p.pulsePhase) * 0.25) * shimmer + smoothAudio * 0.15;
        const currentAlpha = Math.min(0.7, Math.max(0.08, dynamicAlpha));

        // Compute instantaneous velocity magnitude for dynamic motion blur streak length
        const speedMag = Math.hypot(p.vx, p.vy);
        const blurStretch = Math.min(18, Math.max(1, speedMag * 4.5));
        const effectiveSize = p.size + smoothAudio * 0.85;

        // Render particle with directional velocity motion blur streak
        ctx.save();
        if (blurStretch > 1.8) {
          // Draw directional motion blur speed streak capsule
          const angle = Math.atan2(p.vy, p.vx);
          ctx.translate(p.x, p.y);
          ctx.rotate(angle);

          const streakGrad = ctx.createLinearGradient(-blurStretch, 0, effectiveSize, 0);
          streakGrad.addColorStop(0, `rgba(2, 132, 199, 0)`);
          streakGrad.addColorStop(0.4, `rgba(56, 189, 248, ${currentAlpha * 0.4})`);
          streakGrad.addColorStop(1, `rgba(2, 132, 199, ${currentAlpha})`);

          ctx.fillStyle = streakGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, blurStretch, effectiveSize, 0, 0, Math.PI * 2);
          ctx.fill();

          // Particle Head Core
          ctx.fillStyle = `rgba(186, 230, 253, ${Math.min(1, currentAlpha * 1.4)})`;
          ctx.beginPath();
          ctx.arc(effectiveSize * 0.5, 0, effectiveSize * 0.7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard soft glowing particle
          ctx.fillStyle = `rgba(2, 132, 199, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, effectiveSize, 0, Math.PI * 2);
          ctx.fill();

          // Bright Specular Core
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 0.8})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, effectiveSize * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // 7. Reactive Acoustic Expansion Shockwaves with Motion Blur Halo
      if (smoothAudio > 0.02 || isActive) {
        ctx.save();
        ctx.translate(cx, cy);
        const waveCount = 3;
        for (let i = 0; i < waveCount; i++) {
          const wavePhase = (now * 0.00095 + i * 0.33) % 1;
          const waveRadius = 95 + wavePhase * (Math.min(width, height) * 0.44);
          const waveAlpha = Math.max(0, (1 - wavePhase) * (0.09 + smoothAudio * 0.25));

          ctx.strokeStyle = `rgba(14, 165, 233, ${waveAlpha})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Soft motion-blurred afterglow ring
          ctx.strokeStyle = `rgba(56, 189, 248, ${waveAlpha * 0.45})`;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0, waveRadius - 2), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden select-none bg-white">
      {/* 120fps Smooth Interactive Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Modern Sleek HUD Corner Accents */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-slate-200/80 pointer-events-none rounded-tl-sm transition-colors duration-300" />
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-slate-200/80 pointer-events-none rounded-tr-sm transition-colors duration-300" />
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-slate-200/80 pointer-events-none rounded-bl-sm transition-colors duration-300" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-slate-200/80 pointer-events-none rounded-br-sm transition-colors duration-300" />
    </div>
  );
};

