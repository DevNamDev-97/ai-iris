/**
 * ScreenShareService
 * Manages display media capture (screen/window sharing), canvas frame extraction,
 * and mouse cursor tracking coordinates for Iris Multimodal Live Vision.
 */

export interface CursorPosition {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  pxX: number;
  pxY: number;
  lastMoved?: number;
}

export interface ScreenFrameData {
  base64Image: string;
  cursor: CursorPosition;
  width: number;
  height: number;
  timestamp: number;
}

export type ScreenFrameCallback = (frame: ScreenFrameData) => void;

class ScreenShareService {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private frameIntervalTimer: number | null = null;
  private isSharing = false;
  private frameCallback: ScreenFrameCallback | null = null;

  // Track cursor position in percentage of viewport / screen
  private currentCursor: CursorPosition = {
    x: 50,
    y: 50,
    pxX: 0,
    pxY: 0,
    lastMoved: Date.now(),
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', (e) => {
        const vw = window.innerWidth || document.documentElement.clientWidth || 1920;
        const vh = window.innerHeight || document.documentElement.clientHeight || 1080;
        this.currentCursor = {
          x: Math.min(100, Math.max(0, Math.round((e.clientX / vw) * 100))),
          y: Math.min(100, Math.max(0, Math.round((e.clientY / vh) * 100))),
          pxX: Math.round(e.clientX),
          pxY: Math.round(e.clientY),
          lastMoved: Date.now(),
        };
      });
    }
  }

  public getIsSharing(): boolean {
    return this.isSharing;
  }

  public getCursorPosition(): CursorPosition {
    return { ...this.currentCursor };
  }

  /**
   * Request display media from the user and start periodic frame transmission
   */
  public async startScreenShare(onFrame: ScreenFrameCallback): Promise<boolean> {
    if (this.isSharing) {
      this.frameCallback = onFrame;
      return true;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        console.warn('⚠️ [ScreenShare] getDisplayMedia not supported in this browser environment');
        return false;
      }

      console.log('🖥️ [ScreenShare] Requesting user display capture...');
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { max: 5 },
        } as MediaTrackConstraints,
        audio: false,
      });

      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.srcObject = this.mediaStream;

      await this.videoElement.play();

      this.canvasElement = document.createElement('canvas');
      this.frameCallback = onFrame;
      this.isSharing = true;

      // Handle stream end when user clicks browser's native "Stop sharing" button
      const videoTrack = this.mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('🖥️ [ScreenShare] User ended screen share stream');
          this.stopScreenShare();
        };
      }

      // Capture initial frame immediately
      this.captureAndEmitFrame();

      // Transmit screen frames every 1000ms (1 FPS) for instant live vision streaming
      this.frameIntervalTimer = window.setInterval(() => {
        this.captureAndEmitFrame();
      }, 1000);

      console.log('✅ [ScreenShare] Live screen sharing active and capturing frames');
      return true;
    } catch (err: any) {
      console.warn('⚠️ [ScreenShare] Failed to start display capture:', err?.message || err);
      this.stopScreenShare();
      return false;
    }
  }

  private lastSentTime = 0;

  private captureAndEmitFrame(): void {
    if (!this.isSharing || !this.videoElement || !this.canvasElement || !this.frameCallback) {
      return;
    }

    try {
      const video = this.videoElement;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      // Scale to optimal dimensions for crisp text OCR and rapid streaming (max width 1024)
      const scale = Math.min(1, 1024 / video.videoWidth);
      const targetW = Math.round(video.videoWidth * scale);
      const targetH = Math.round(video.videoHeight * scale);

      this.canvasElement.width = targetW;
      this.canvasElement.height = targetH;

      const ctx = this.canvasElement.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, targetW, targetH);

      // Convert to JPEG base64 (quality 0.60 for crystal-clear readability and sub-second transmission)
      const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.60);
      const base64Image = dataUrl.includes(';base64,') ? dataUrl.split(';base64,')[1] : dataUrl;

      this.lastSentTime = Date.now();
      this.frameCallback({
        base64Image,
        cursor: { ...this.currentCursor },
        width: targetW,
        height: targetH,
        timestamp: this.lastSentTime,
      });
    } catch (err) {
      console.warn('⚠️ [ScreenShare] Error capturing screen frame:', err);
    }
  }

  public stopScreenShare(): void {
    if (this.frameIntervalTimer) {
      clearInterval(this.frameIntervalTimer);
      this.frameIntervalTimer = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.canvasElement = null;
    this.frameCallback = null;
    this.isSharing = false;
    console.log('🔒 [ScreenShare] Stopped screen share');
  }
}

export const screenShareService = new ScreenShareService();
