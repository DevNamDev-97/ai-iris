/**
 * AudioStreamer
 * Captures microphone audio across desktop and smartphones (iOS Safari, Android Chrome),
 * resamples natively from any device sample rate (44.1kHz / 48kHz) to clean 16kHz 16-bit PCM Little Endian,
 * encodes to Base64, and streams to Gemini Live.
 */

export interface AudioStreamerListeners {
  onAudioChunk: (base64Pcm: string) => void;
  onAudioLevel?: (level: number) => void;
  onError?: (err: Error) => void;
}

export class AudioStreamer {
  private mediaStream: MediaStream | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isStreaming = false;
  private listeners: AudioStreamerListeners;
  private animationFrameId: number | null = null;

  constructor(listeners: AudioStreamerListeners) {
    this.listeners = listeners;
  }

  /**
   * Starts microphone capture and 16kHz PCM streaming.
   */
  async start(): Promise<void> {
    if (this.isStreaming) return;

    console.log('🎤 [AudioStreamer] Requesting microphone access for smartphone/desktop...');
    try {
      // Clean cross-platform audio constraints (avoid fixed sampleRate which breaks mobile OS)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log('🎤 [AudioStreamer] Microphone permission granted!');
    } catch (err: any) {
      console.error('❌ [AudioStreamer] Microphone permission denied or unavailable:', err);
      const error = new Error(`Microphone access denied: ${err?.message || err}`);
      this.listeners.onError?.(error);
      throw error;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      // Allow browser to create AudioContext at device native hardware rate
      this.inputAudioCtx = new AudioCtxClass();
      
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      const nativeSampleRate = this.inputAudioCtx.sampleRate;
      console.log(`🎤 [AudioStreamer] Input AudioContext active at native sample rate: ${nativeSampleRate} Hz`);

      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);

      // Acoustic high-pass filter at 75Hz removes breath noise and phone mic wind
      this.filterNode = this.inputAudioCtx.createBiquadFilter();
      this.filterNode.type = 'highpass';
      this.filterNode.frequency.value = 75;

      // AnalyserNode to measure speech volume for the visualizer
      this.analyserNode = this.inputAudioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.4;

      // ScriptProcessor with buffer size 4096 (works reliably across desktop and mobile)
      this.processorNode = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isStreaming) return;

        const inputData = e.inputBuffer.getChannelData(0);
        if (!inputData || inputData.length === 0) return;

        // 1. Resample from native hardware rate (e.g. 48000Hz or 44100Hz) to 16000Hz
        const resampled16k = this.downsampleTo16000(inputData, nativeSampleRate);

        // 2. Convert to 16-bit PCM Little Endian Base64
        const pcmBase64 = this.convertFloat32ToInt16Base64(resampled16k);

        if (pcmBase64) {
          this.listeners.onAudioChunk(pcmBase64);
        }
      };

      // Correct audio graph wiring:
      // Source -> HighPassFilter -> Analyser
      //                          -> ScriptProcessor -> Destination
      this.sourceNode.connect(this.filterNode);
      this.filterNode.connect(this.analyserNode);
      this.filterNode.connect(this.processorNode);
      this.processorNode.connect(this.inputAudioCtx.destination);

      this.isStreaming = true;
      console.log('🎤 [AudioStreamer] Microphone streaming live at clean 16000Hz PCM Little Endian');

      this.startLevelLoop();
    } catch (err: any) {
      console.error('❌ [AudioStreamer] Failed to initialize microphone audio graph:', err);
      this.stop();
      throw err;
    }
  }

  /**
   * Resamples raw audio from device sample rate to 16000 Hz using box-car averaging.
   */
  private downsampleTo16000(input: Float32Array, inputRate: number): Float32Array {
    if (inputRate === 16000) {
      return input;
    }

    const targetRate = 16000;
    const ratio = inputRate / targetRate;
    const newLength = Math.round(input.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = start; j < end && j < input.length; j++) {
        sum += input[j];
        count++;
      }
      result[i] = count > 0 ? sum / count : 0;
    }

    return result;
  }

  /**
   * Converts Float32Array to 16-bit PCM Little Endian and encodes to Base64
   */
  private convertFloat32ToInt16Base64(float32Array: Float32Array): string {
    const l = float32Array.length;
    const int16 = new Int16Array(l);

    for (let i = 0; i < l; i++) {
      // Clamp sample between -1 and 1
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Convert Int16 buffer to binary string
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  private startLevelLoop() {
    if (!this.analyserNode) return;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const update = () => {
      if (this.analyserNode && this.isStreaming) {
        this.analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, avg / 100);
        this.listeners.onAudioLevel?.(normalized);
      } else {
        this.listeners.onAudioLevel?.(0);
      }
      this.animationFrameId = requestAnimationFrame(update);
    };

    update();
  }

  /**
   * Stops microphone streaming and releases media tracks.
   */
  stop(): void {
    console.log('🛑 [AudioStreamer] Microphone stopped');
    this.isStreaming = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch (e) {}
      this.processorNode = null;
    }

    if (this.filterNode) {
      try {
        this.filterNode.disconnect();
      } catch (e) {}
      this.filterNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.mediaStream = null;
    }
  }
}
