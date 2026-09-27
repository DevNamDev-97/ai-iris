/**
 * AudioPlaybackQueue
 * Handles sequential, gapless playback of Gemini Live audio chunks,
 * interruption handling, and speaker diagnostic test.
 */

export interface PlaybackStateListener {
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onAudioLevel?: (level: number) => void;
  onError?: (err: Error) => void;
}

export class AudioPlaybackQueue {
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private scheduledEndTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isPlaying = false;
  private listeners: PlaybackStateListener = {};
  private animationFrameId: number | null = null;

  constructor(listeners?: PlaybackStateListener) {
    if (listeners) {
      this.listeners = listeners;
    }
  }

  /**
   * Initializes or resumes the single persistent AudioContext.
   * MUST use browser native hardware sample rate to avoid NotSupportedError on mobile devices.
   */
  async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API is not supported by this browser.');
      }

      console.log('[AudioPlaybackQueue] Creating persistent AudioContext (device native rate)');
      // Do NOT pass sampleRate: 24000 because mobile browsers reject non-standard sample rates
      this.audioCtx = new AudioCtxClass();

      // Create GainNode
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;

      // Create AnalyserNode for audio visualization
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Connect: GainNode -> AnalyserNode -> Destination
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
      console.log(`[AudioPlaybackQueue] Audio graph connected: Gain -> Analyser -> Destination (${this.audioCtx.sampleRate}Hz)`);

      this.startAnalyserLoop();
    }

    console.log(`[AudioPlaybackQueue] AudioContext state: ${this.audioCtx.state}`);
    if (this.audioCtx.state === 'suspended') {
      console.log('[AudioPlaybackQueue] Resuming suspended AudioContext...');
      await this.audioCtx.resume();
      console.log(`[AudioPlaybackQueue] AudioContext resumed. New state: ${this.audioCtx.state}`);
    }

    return this.audioCtx;
  }

  getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  /**
   * Schedules an AudioBuffer for gapless sequential playback.
   */
  async enqueue(audioBuffer: AudioBuffer): Promise<void> {
    const ctx = await this.ensureAudioContext();

    if (!this.gainNode) {
      throw new Error('Audio output GainNode is not initialized.');
    }

    const now = ctx.currentTime;
    // Schedule immediately if queue is empty or has already elapsed,
    // otherwise schedule right after the previous chunk ends.
    const startTime = Math.max(now, this.scheduledEndTime);
    this.scheduledEndTime = startTime + audioBuffer.duration;

    console.log(`[AudioPlaybackQueue] Scheduling audio chunk: start=${startTime.toFixed(3)}s, duration=${audioBuffer.duration.toFixed(3)}s, bufferRate=${audioBuffer.sampleRate}Hz, ctxRate=${ctx.sampleRate}Hz`);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    this.activeSources.push(source);

    if (!this.isPlaying) {
      this.isPlaying = true;
      console.log('[AudioPlaybackQueue] Audio playback started');
      this.listeners.onPlaybackStateChange?.(true);
    }

    source.start(startTime);

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      try {
        source.disconnect();
      } catch (e) {}

      // If no active sources remain, signal playback ended
      if (this.activeSources.length === 0) {
        this.isPlaying = false;
        console.log('[AudioPlaybackQueue] Audio playback ended for all queued chunks');
        this.listeners.onPlaybackStateChange?.(false);
      }
    };
  }

  /**
   * Immediately stops all currently playing and queued response audio (Interruption).
   */
  interrupt(): void {
    console.log(`[AudioPlaybackQueue] Audio playback interrupted! Stopping ${this.activeSources.length} active sources`);
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.scheduledEndTime = this.audioCtx.currentTime;
    } else {
      this.scheduledEndTime = 0;
    }

    if (this.isPlaying) {
      this.isPlaying = false;
      this.listeners.onPlaybackStateChange?.(false);
    }
  }

  /**
   * Speaker Diagnostic Test:
   * Generates a crystal-clear 440Hz tone using OscillatorNode AND GainNode
   * directly connected through the SAME audio graph to AudioContext.destination.
   */
  async testSpeaker(): Promise<{ success: boolean; message: string }> {
    console.log('🧪 [SpeakerDiagnostic] Starting Speaker Diagnostic Test (440Hz)...');
    try {
      const ctx = await this.ensureAudioContext();

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      console.log(`🧪 [SpeakerDiagnostic] AudioContext state: ${ctx.state}, sampleRate: ${ctx.sampleRate}Hz`);

      // 1. Play tone via OscillatorNode directly to GainNode
      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // Standard 440Hz (A4)

      // Smooth attack and release to eliminate clicks
      const now = ctx.currentTime;
      const duration = 0.6; // 600ms
      toneGain.gain.setValueAtTime(0.001, now);
      toneGain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      toneGain.gain.setValueAtTime(0.35, now + duration - 0.1);
      toneGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Connect: Oscillator -> toneGain -> this.gainNode -> Analyser -> Destination
      if (this.gainNode) {
        toneGain.connect(this.gainNode);
      } else {
        toneGain.connect(ctx.destination);
      }
      osc.connect(toneGain);

      osc.start(now);
      osc.stop(now + duration);

      console.log('🧪 [SpeakerDiagnostic] 440Hz test tone started successfully!');

      return {
        success: true,
        message: `440Hz tone played successfully! AudioContext is ${ctx.state} at ${ctx.sampleRate}Hz. If you heard the beep, your device speaker and Web Audio API are working perfectly.`,
      };
    } catch (err: any) {
      console.error('❌ [SpeakerDiagnostic] Speaker test failed:', err);
      return {
        success: false,
        message: `Speaker test error: ${err?.message || err}`,
      };
    }
  }

  private startAnalyserLoop() {
    if (!this.analyserNode) return;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const update = () => {
      if (this.analyserNode && this.isPlaying) {
        this.analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, avg / 128);
        this.listeners.onAudioLevel?.(normalized);
      } else {
        this.listeners.onAudioLevel?.(0);
      }
      this.animationFrameId = requestAnimationFrame(update);
    };

    update();
  }

  cleanup(): void {
    this.interrupt();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
    this.gainNode = null;
    this.analyserNode = null;
  }
}
