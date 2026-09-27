/**
 * ScreenShareService
 * Manages live screen capture via getDisplayMedia with cursor tracking
 * and frame extraction for Gemini multimodal vision analysis.
 */

import { triggerHaptic } from '../utils/haptics.ts';

export interface CursorPosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  pxX: number;
  pxY: number;
  lastMoved: number;
}

export interface ScreenFrameData {
  base64Image: string;
  cursor: CursorPosition;
  timestamp: number;
  width: number;
  height: number;
}

export type ScreenShareCallback = (frame: ScreenFrameData) => void;

export class ScreenShareService {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isSharing = false;
  private frameIntervalId: number | null = null;
  private onFrameCallback: ScreenShareCallback | null = null;
  private cursor: CursorPosition = { x: 50, y: 50, pxX: 0, pxY: 0, lastMoved: Date.now() };

  constructor() {
    this.setupCursorTracking();
  }

  private setupCursorTracking() {
    if (typeof window === 'undefined') return;

    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1920;
      const h = window.innerHeight || 1080;
      this.cursor = {
        x: Math.round((e.clientX / w) * 100),
        y: Math.round((e.clientY / h) * 100),
        pxX: e.clientX,
        pxY: e.clientY,
        lastMoved: Date.now(),
      };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
  }

  public getCursorPosition(): CursorPosition {
    return this.cursor;
  }

  public getIsSharing(): boolean {
    return this.isSharing;
  }

  /**
   * Request user permission and start display media capture (entire screen / window / tab)
   */
  public async startScreenShare(onFrame?: ScreenShareCallback): Promise<boolean> {
    if (this.isSharing) {
      console.log('🖥️ [ScreenShareService] Screen sharing is already active.');
      if (onFrame) this.onFrameCallback = onFrame;
      return true;
    }

    try {
      triggerHaptic('double');
      console.log('🖥️ [ScreenShareService] Requesting display media with cursor always visible...');

      // Request screen capture with cursor visible
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // @ts-ignore - cursor hint supported by Chrome / Edge / Opera / Firefox
          cursor: 'always',
          displaySurface: 'monitor',
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 15 },
        },
        audio: false,
      });

      this.mediaStream = stream;
      this.isSharing = true;
      if (onFrame) this.onFrameCallback = onFrame;

      // Handle user ending share from browser floating toolbar
      stream.getVideoTracks()[0].onended = () => {
        console.log('🖥️ [ScreenShareService] User stopped screen share from browser banner');
        this.stopScreenShare();
      };

      // Create hidden video & canvas elements for frame rendering
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.srcObject = stream;

      await new Promise<void>((resolve) => {
        if (!this.videoElement) return resolve();
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play();
          resolve();
        };
      });

      this.canvasElement = document.createElement('canvas');

      // Start frame capture loop (1 frame every 1.5s for real-time live efficiency)
      this.captureFrame(); // Capture first frame immediately
      this.frameIntervalId = window.setInterval(() => {
        this.captureFrame();
      }, 1800);

      console.log('✅ [ScreenShareService] Screen sharing active! Capturing live screen frames.');
      return true;
    } catch (err: any) {
      console.warn('❌ [ScreenShareService] Failed to start screen share:', err?.message || err);
      this.stopScreenShare();
      return false;
    }
  }

  /**
   * Captures current video frame, draws custom cursor indicator overlay, and generates JPEG base64
   */
  public captureFrame(): ScreenFrameData | null {
    if (!this.isSharing || !this.videoElement || !this.canvasElement) return null;

    const v = this.videoElement;
    if (v.readyState < 2) return null; // Not enough video data yet

    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;

    // Scale canvas to reasonable size for Gemini fast vision processing (max width 1280)
    const scale = Math.min(1, 1280 / w);
    const canvasWidth = Math.round(w * scale);
    const canvasHeight = Math.round(h * scale);

    this.canvasElement.width = canvasWidth;
    this.canvasElement.height = canvasHeight;

    const ctx = this.canvasElement.getContext('2d');
    if (!ctx) return null;

    // Draw full video frame onto canvas
    ctx.drawImage(v, 0, 0, canvasWidth, canvasHeight);

    // Draw high-visibility glowing cursor indicator on top of screen frame
    const curX = Math.round((this.cursor.x / 100) * canvasWidth);
    const curY = Math.round((this.cursor.y / 100) * canvasHeight);

    ctx.save();
    // Glowing red/cyan cursor ring
    ctx.shadowColor = '#00f2ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff0055';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;

    // Draw mouse pointer arrow shape
    ctx.beginPath();
    ctx.moveTo(curX, curY);
    ctx.lineTo(curX + 16, curY + 16);
    ctx.lineTo(curX + 8, curY + 18);
    ctx.lineTo(curX, curY + 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pulse dot around cursor
    ctx.fillStyle = 'rgba(0, 242, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Convert to JPEG data URL
    const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.82);
    const base64Image = dataUrl.split(',')[1] || '';

    const frameData: ScreenFrameData = {
      base64Image,
      cursor: { ...this.cursor },
      timestamp: Date.now(),
      width: canvasWidth,
      height: canvasHeight,
    };

    if (this.onFrameCallback) {
      this.onFrameCallback(frameData);
    }

    return frameData;
  }

  /**
   * Stop screen capture and release media tracks
   */
  public stopScreenShare() {
    triggerHaptic('medium');
    this.isSharing = false;

    if (this.frameIntervalId !== null) {
      clearInterval(this.frameIntervalId);
      this.frameIntervalId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.canvasElement = null;
    this.onFrameCallback = null;
    console.log('🛑 [ScreenShareService] Screen share stopped.');
  }
}

export const screenShareService = new ScreenShareService();
