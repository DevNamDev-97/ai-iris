/**
 * AudioDecoder
 * Decodes Gemini Live audio responses (raw PCM little-endian 16-bit)
 * into AudioBuffers suitable for Web Audio API playback.
 */

export interface DecodedAudio {
  buffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  channelCount: number;
  byteLength: number;
}

export class AudioDecoder {
  /**
   * Parse sample rate from MIME type (e.g. "audio/pcm;rate=24000")
   */
  static parseSampleRate(mimeType?: string, defaultRate = 24000): number {
    if (!mimeType) return defaultRate;
    const match = mimeType.match(/rate=(\d+)/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return defaultRate;
  }

  /**
   * Decode Base64 string of raw 16-bit PCM into Float32Array and AudioBuffer
   */
  static decodePcmBase64(
    base64Data: string,
    audioCtx: AudioContext,
    mimeType?: string
  ): DecodedAudio {
    console.log(`[AudioDecoder] Base64 decoding started (len: ${base64Data.length})`);
    
    // 1. Decode Base64 to binary string
    let binaryString: string;
    try {
      binaryString = atob(base64Data);
    } catch (e: any) {
      console.error('[AudioDecoder] Base64 decoding failed:', e);
      throw new Error(`Base64 decoding failed: ${e?.message || e}`);
    }
    console.log(`[AudioDecoder] Base64 decoding successful (bytes: ${binaryString.length})`);

    // 2. Convert binary string to Uint8Array
    const byteLength = binaryString.length;
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 3. Convert Uint8Array to Int16Array (16-bit Little Endian PCM)
    console.log('[AudioDecoder] PCM decoding started');
    // Ensure even byte alignment for 16-bit samples
    const sampleCount = Math.floor(byteLength / 2);
    const int16 = new Int16Array(bytes.buffer, 0, sampleCount);
    console.log(`[AudioDecoder] PCM decoding successful, Int16 sample count: ${sampleCount}`);

    // 4. Convert Int16 PCM to Float32 [-1.0, 1.0]
    const float32 = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      // Normalize signed 16-bit integer (-32768 to 32767) to [-1.0, 1.0]
      float32[i] = int16[i] / 32768.0;
    }
    console.log('[AudioDecoder] Int16 to Float32 conversion successful');

    // 5. Determine sample rate & create AudioBuffer
    const sampleRate = this.parseSampleRate(mimeType, 24000);
    const channelCount = 1; // Gemini Live returns mono audio
    const audioBuffer = audioCtx.createBuffer(channelCount, sampleCount, sampleRate);
    audioBuffer.getChannelData(0).set(float32);

    console.log(`[AudioDecoder] AudioBuffer created: duration=${audioBuffer.duration.toFixed(3)}s, sampleRate=${sampleRate}, channels=${channelCount}`);

    return {
      buffer: audioBuffer,
      sampleRate,
      duration: audioBuffer.duration,
      channelCount,
      byteLength,
    };
  }
}
