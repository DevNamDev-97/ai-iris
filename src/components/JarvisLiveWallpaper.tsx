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
      // Create realistic liquid water wave displacement
      const newRipple: RealisticWaterRipple = {
        id: performance.now() + Math.random(),
        x: e.clientX,
        y: e.clientY,
        radius: 2,
        maxRadius: 180 + Math.random() * 60,
        speed: 160 + Math.random() * 30,
        amplitude: 1.0,
        decay: 1.15,
        spawnTime: performance.now(),
        hasRebounded: false,
      };

      // Cap max concurrent active water ripples for optimal 60fps performance
      if (waterRipplesRef.current.length > 10) {
        waterRipplesRef.current.shift();
      }
      waterRipplesRef.current.push(newRipple);
      triggerHaptic('light');
    };

    window.addEventListener('pointerdown', handlePointerDown);

    // Particle system (floating smooth blue water dust particles)
    const particleCount = 45;
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      baseVx: (Math.random() - 0.5) * 0.35,
      baseVy: -0.2 - Math.random() * 0.4,
      size: 1.2 + Math.random() * 2.2,
      baseAlpha: 0.12 + Math.random() * 0.3,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.02,
    }));

    let rotationAngle = 0;
    let gridOffset = 0;
    let smoothAudio = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1); // delta time capped
      lastTime = now;

      // Smooth audio interpolation for silky 60fps fluid response
      const targetAudio = audioLevelRef.current;
      smoothAudio += (targetAudio - smoothAudio) * Math.min(1, dt * 14);

      const isActive = isLiveActiveRef.current;
      const cx = width / 2;
      const cy = height / 2;

      // 1. Base Clean White Canvas Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 2. Smooth Radial Sky-Blue Ambient Bloom
      const maxDim = Math.max(width, height);
      const bloomRadius = maxDim * (0.65 + smoothAudio * 0.15);
      const baseGlow = ctx.createRadialGradient(cx, cy, 30, cx, cy, bloomRadius);

      const centerAlpha = 0.08 + smoothAudio * 0.22;
      const midAlpha = 0.03 + smoothAudio * 0.08;

      baseGlow.addColorStop(0, `rgba(14, 165, 233, ${centerAlpha})`);
      baseGlow.addColorStop(0.35, `rgba(59, 130, 246, ${midAlpha})`);
      baseGlow.addColorStop(0.75, `rgba(248, 250, 252, 0.95)`);
      baseGlow.addColorStop(1, '#ffffff');

      ctx.fillStyle = baseGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Subtle Futuristic Cyber Grid
      ctx.save();
      const gridAlpha = 0.035 + smoothAudio * 0.03;
      ctx.strokeStyle = `rgba(2, 132, 199, ${gridAlpha})`;
      ctx.lineWidth = 0.75;

      const gridSize = 64;
      gridOffset = (gridOffset + dt * 6) % gridSize;

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

      // 4. Realistic 3D Liquid Water Ripple Wave Physics
      const ripples = waterRipplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed * dt;
        const progress = r.radius / r.maxRadius;
        
        // Damped fluid wave amplitude decay
        r.amplitude = Math.exp(-progress * r.decay);
        const waveAlpha = Math.max(0, r.amplitude * 0.75);

        if (progress >= 1 || waveAlpha <= 0.01) {
          ripples.splice(i, 1);
          continue;
        }

        // Water Drop Center Rebound Secondary Ripple
        if (!r.hasRebounded && r.radius > 35 && ripples.length < 12) {
          r.hasRebounded = true;
          ripples.push({
            id: performance.now() + Math.random(),
            x: r.x,
            y: r.y,
            radius: 2,
            maxRadius: r.maxRadius * 0.6,
            speed: r.speed * 0.85,
            amplitude: r.amplitude * 0.6,
            decay: 1.4,
            spawnTime: now,
            hasRebounded: true,
          });
        }

        // Render Realistic Liquid Wave Crest & Refraction Rings
        ctx.save();

        // 4a. Water Wave Base Refraction Surface Fill
        const waveGradient = ctx.createRadialGradient(
          r.x,
          r.y,
          Math.max(0, r.radius - 12),
          r.x,
          r.y,
          r.radius + 12
        );
        waveGradient.addColorStop(0, `rgba(56, 189, 248, 0)`);
        waveGradient.addColorStop(0.5, `rgba(56, 189, 248, ${waveAlpha * 0.25})`);
        waveGradient.addColorStop(1, `rgba(2, 132, 199, 0)`);

        ctx.fillStyle = waveGradient;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius + 12, 0, Math.PI * 2);
        ctx.fill();

        // 4b. Deep Water Shadow Arc (3D Bottom-Right Water Displacement)
        ctx.strokeStyle = `rgba(2, 132, 199, ${waveAlpha * 0.5})`;
        ctx.lineWidth = Math.max(1, 3.5 * (1 - progress));
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();

        // 4c. Specular Sunlight Water Crest Highlight Arc (Top-Left Reflection)
        ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha * 0.95})`;
        ctx.lineWidth = Math.max(1, 2.5 * (1 - progress));
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius - 1, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();

        // 4d. Primary Outer Water Wave Crest Ring
        ctx.strokeStyle = `rgba(14, 165, 233, ${waveAlpha * 0.6})`;
        ctx.lineWidth = Math.max(0.75, 2 * (1 - progress));
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 4e. Secondary Concentric Harmonic Trough Ring
        if (r.radius > 20) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.72, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();

          ctx.strokeStyle = `rgba(2, 132, 199, ${waveAlpha * 0.3})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 0.72, Math.PI * 0.1, Math.PI * 0.9);
          ctx.stroke();
        }

        ctx.restore();

        // Water Wave Displacement Push on Floating Dust Particles
        particles.forEach((p) => {
          const dx = p.x - r.x;
          const dy = p.y - r.y;
          const dist = Math.hypot(dx, dy);
          if (Math.abs(dist - r.radius) < 22) {
            const pushFactor = (1 - Math.abs(dist - r.radius) / 22) * waveAlpha * 1.8;
            p.x += (dx / (dist || 1)) * pushFactor;
            p.y += (dy / (dist || 1)) * pushFactor;
          }
        });
      }

      // 5. Ambient Dial Rings
      ctx.save();
      ctx.translate(cx, cy);
      rotationAngle += (0.12 + smoothAudio * 0.4) * dt;

      const reactorRadius = Math.min(width, height) * 0.35;

      ctx.save();
      ctx.rotate(rotationAngle * 0.35);
      ctx.strokeStyle = `rgba(2, 132, 199, ${0.06 + smoothAudio * 0.09})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([12, 18, 4, 18]);
      ctx.beginPath();
      ctx.arc(0, 0, reactorRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.rotate(-rotationAngle * 0.75);
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.05 + smoothAudio * 0.08})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([20, 16, 6, 16]);
      ctx.beginPath();
      ctx.arc(0, 0, reactorRadius * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // 6. Floating Data Particles
      particles.forEach((p) => {
        p.x += p.baseVx * (1 + smoothAudio * 0.5) * (dt * 60);
        p.y += (p.baseVy - smoothAudio * 0.8) * (dt * 60);
        p.pulsePhase += p.pulseSpeed * (dt * 60);

        if (p.y < -15) {
          p.y = height + 15;
          p.x = Math.random() * width;
        }
        if (p.x < -15) p.x = width + 15;
        if (p.x > width + 15) p.x = -15;

        const dynamicAlpha = p.baseAlpha * (0.6 + Math.sin(p.pulsePhase) * 0.4) + smoothAudio * 0.15;
        ctx.fillStyle = `rgba(2, 132, 199, ${Math.min(0.55, dynamicAlpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + smoothAudio * 0.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // 7. Reactive Acoustic Waves
      if (smoothAudio > 0.02 || isActive) {
        ctx.save();
        ctx.translate(cx, cy);
        const waveCount = 3;
        for (let i = 0; i < waveCount; i++) {
          const wavePhase = (now * 0.0009 + i * 0.33) % 1;
          const waveRadius = 90 + wavePhase * (Math.min(width, height) * 0.42);
          const waveAlpha = Math.max(0, (1 - wavePhase) * (0.08 + smoothAudio * 0.22));

          ctx.strokeStyle = `rgba(14, 165, 233, ${waveAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
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
      {/* 60fps Smooth Interactive Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Modern Sleek HUD Corner Accents */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-slate-200/80 pointer-events-none rounded-tl-sm transition-colors duration-300" />
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-slate-200/80 pointer-events-none rounded-tr-sm transition-colors duration-300" />
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-slate-200/80 pointer-events-none rounded-bl-sm transition-colors duration-300" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-slate-200/80 pointer-events-none rounded-br-sm transition-colors duration-300" />
    </div>
  );
};
