/**
 * LiveClient
 * Coordinates real-time voice-to-voice interaction between browser microphone,
 * Gemini Live API WebSocket stream, audio decoding, playback queue, and device actions.
 */

import { AudioStreamer } from './audioStreamer.ts';
import { AudioDecoder } from './audioDecoder.ts';
import { AudioPlaybackQueue } from './audioPlaybackQueue.ts';
import { DeviceActionBridge, ToolExecutionResult } from './deviceActionBridge.ts';
import { toEnglishAlphabets } from '../utils/transliteration.ts';
import { screenShareService } from './screenShareService.ts';
import { speakerMemoryStore } from './speakerMemoryStore.ts';
import { matchSpeakerAcoustic } from '../utils/voiceRecognition.ts';

export type AssistantState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR';

export interface LiveClientCallbacks {
  onStateChange: (state: AssistantState) => void;
  onAudioLevel: (level: number) => void;
  onIrisTranscription: (text: string) => void;
  onUserTranscription: (text: string) => void;
  onToolAction: (actionInfo: { name: string; args: any; result: ToolExecutionResult }) => void;
  onRequestFileUpload?: (data: { fileType: string; message: string }) => void;
  onShowGeneratedContent?: (data: { title: string; contentType: 'code' | 'prompt' | 'text' | 'link'; language?: string; content: string; url?: string; summary?: string }) => void;
  onInterruption?: () => void;
  onAcousticPitch?: (data: { pitchHz: number; spectralCentroid?: number; detectedGender?: 'male' | 'female' | 'ambiguous'; speakerName: string; confidence: number }) => void;
  onError: (errorMsg: string) => void;
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private streamer: AudioStreamer | null = null;
  private playbackQueue: AudioPlaybackQueue;
  private deviceBridge: DeviceActionBridge;
  private callbacks: LiveClientCallbacks;
  private state: AssistantState = 'IDLE';
  private isSpeaking = false;
  private lastUserSpeechTimestamp = 0;
  private turnPendingCompletion = false;
  private lastAcousticSendTime = 0;
  private lastSentSpeakerName = '';

  constructor(callbacks: LiveClientCallbacks) {
    this.callbacks = callbacks;
    this.deviceBridge = new DeviceActionBridge();

    // Initialize AudioPlaybackQueue with state and level listeners
    this.playbackQueue = new AudioPlaybackQueue({
      onPlaybackStateChange: (isPlaying) => {
        this.isSpeaking = isPlaying;
        if (isPlaying) {
          console.log('🗣️ [LiveClient] Iris is SPEAKING');
          this.setState('SPEAKING');
        } else {
          console.log('👂 [LiveClient] Iris finished speaking, returning to LISTENING');
          if (this.state !== 'ERROR' && this.ws?.readyState === WebSocket.OPEN) {
            this.setState('LISTENING');
          }
        }
      },
      onAudioLevel: (level) => {
        if (this.isSpeaking) {
          this.callbacks.onAudioLevel(level);
        }
      },
      onError: (err) => {
        console.error('❌ [LiveClient] Audio playback error:', err);
        this.callbacks.onError(err.message);
      },
    });
  }

  getDeviceBridge(): DeviceActionBridge {
    return this.deviceBridge;
  }

  getPlaybackQueue(): AudioPlaybackQueue {
    return this.playbackQueue;
  }

  getState(): AssistantState {
    return this.state;
  }

  private setState(newState: AssistantState) {
    if (this.state !== newState) {
      console.log(`🔄 [LiveClient] State transition: ${this.state} -> ${newState}`);
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  /**
   * Start the Iris Live Voice Session
   * 1. Initialize persistent AudioContext
   * 2. Connect to WebSocket (/api/live?voice=...)
   * 3. Start microphone capture (16kHz PCM Int16)
   */
  async start(voiceName?: string): Promise<void> {
    if (this.state === 'CONNECTING' || this.state === 'LISTENING' || this.state === 'SPEAKING') {
      return;
    }

    this.setState('CONNECTING');
    console.log(`🚀 [LiveClient] Starting Iris real-time voice session with voice: ${voiceName || 'Leda'}...`);

    try {
      // 1. Mobile AudioContext guarantee: MUST be resumed from user gesture!
      const audioCtx = await this.playbackQueue.ensureAudioContext();
      console.log(`📱 [LiveClient] Output AudioContext state: ${audioCtx.state}`);

      // 2. Connect to server-side Gemini Live via WebSocket with voice & dynamic device location context
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const locInfo = this.deviceBridge.getLocationInfo();
      const activeFolder = speakerMemoryStore.getActiveFolder();
      const params = new URLSearchParams();
      params.set('voice', voiceName || 'Leda');
      if (locInfo.timezone) params.set('tz', locInfo.timezone);
      if (locInfo.city) params.set('city', locInfo.city);
      if (locInfo.formattedTime) params.set('time', locInfo.formattedTime);
      if (locInfo.formattedDate) params.set('date', locInfo.formattedDate);
      if (activeFolder?.name) params.set('speaker', activeFolder.name);
      if (activeFolder?.gender) params.set('speakerGender', activeFolder.gender);
      if (activeFolder?.grammaticalStyle) params.set('speakerGrammar', activeFolder.grammaticalStyle);

      const wsUrl = `${protocol}//${window.location.host}/api/live?${params.toString()}`;
      console.log(`🔌 [LiveClient] Connecting to WebSocket: ${wsUrl}`);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        console.log('⚡ [LiveClient] WebSocket connection established with Iris backend. Awaiting session_ready...');
        // Transmit full registered speaker profiles and initial active folder
        try {
          const allFolders = speakerMemoryStore.getFolders();
          const activeSpk = speakerMemoryStore.getActiveFolder();
          this.ws?.send(
            JSON.stringify({
              type: 'speaker_init',
              activeSpeaker: activeSpk,
              registeredSpeakers: allFolders,
            })
          );
        } catch (e) {
          console.warn('Error sending initial speaker config:', e);
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          await this.handleServerMessage(msg);
        } catch (parseErr) {
          console.error('❌ [LiveClient] Error parsing message from server:', parseErr);
        }
      };

      this.ws.onerror = (err) => {
        console.error('❌ [LiveClient] WebSocket connection error:', err);
        this.setState('ERROR');
        this.callbacks.onError('WebSocket connection error. Please check server connection.');
      };

      this.ws.onclose = (event) => {
        console.log(`🔒 [LiveClient] WebSocket closed (${event.code}, reason: ${event.reason})`);
        const isErrorState = this.state === 'ERROR';
        if (!isErrorState) {
          this.setState('IDLE');
        }
        this.stop(isErrorState);
      };

      // 3. Initialize Microphone Streamer
      try {
        this.streamer = new AudioStreamer({
          onAudioChunk: (base64Pcm) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              // Send 16kHz PCM audio chunk to Gemini Live
              this.ws.send(
                JSON.stringify({
                  type: 'audio',
                  data: base64Pcm,
                })
              );
            }
          },
          onAudioLevel: (level) => {
            if (!this.isSpeaking) {
              this.callbacks.onAudioLevel(level);
            }
          },
          onAcousticData: (data) => {
            const effectivePitch = data.smoothedPitchHz || data.pitchHz;
            if (effectivePitch > 65 && data.confidence > 0.35) {
              const speakers = speakerMemoryStore.getRegisteredSpeakers();
              const match = matchSpeakerAcoustic(effectivePitch, data.spectralCentroid, speakers, data.spectralRatio || 1.3);

              speakerMemoryStore.recordLiveAcoustics(effectivePitch, data.spectralCentroid);

              if (match.isRecognized && match.speaker) {
                speakerMemoryStore.setActiveSpeaker(match.speaker.id);
                speakerMemoryStore.updateLiveAcoustics(match.speaker.id, effectivePitch, data.spectralCentroid);
              }

              this.callbacks.onAcousticPitch?.({
                pitchHz: effectivePitch,
                spectralCentroid: data.spectralCentroid,
                detectedGender: match.detectedGender,
                speakerName: match.speakerName,
                confidence: match.confidence,
              });

              // Transmit live acoustic identity to backend if speaker identity changes or every 1.5s
              const now = Date.now();
              const speakerChanged = match.speakerName !== this.lastSentSpeakerName;
              if ((speakerChanged || now - this.lastAcousticSendTime > 1500) && this.ws?.readyState === WebSocket.OPEN) {
                this.lastAcousticSendTime = now;
                this.lastSentSpeakerName = match.speakerName;
                this.ws.send(
                  JSON.stringify({
                    type: 'speaker_acoustic_telemetry',
                    pitchHz: effectivePitch,
                    spectralCentroid: data.spectralCentroid,
                    spectralRatio: data.spectralRatio || 1.3,
                    speakerName: match.speakerName,
                    isRecognized: match.isRecognized,
                    gender: match.detectedGender,
                    grammaticalStyle: match.grammaticalStyle,
                    confidence: match.confidence,
                    activeSpeakerFolder: speakerMemoryStore.getActiveFolder(),
                  })
                );
              }
            }
          },
          onError: (err) => {
            console.warn('⚠️ [LiveClient] Microphone notice:', err?.message);
            // Allow output voice audio to continue playing even if input mic encounters a permission issue
          },
        });

        // Start microphone capture
        await this.streamer.start();
      } catch (micErr: any) {
        console.warn('⚠️ [LiveClient] Could not start mic streamer:', micErr?.message);
      }

    } catch (err: any) {
      console.error('❌ [LiveClient] Failed to start Live session:', err);
      this.setState('ERROR');
      this.callbacks.onError(err?.message || 'Failed to start Live session');
      this.stop();
    }
  }

  /**
   * Handle server messages from Gemini Live
   */
  private async handleServerMessage(msg: any): Promise<void> {
    console.log(`📨 [LiveClient] Server message received type: ${msg.type}`);

    switch (msg.type) {
      case 'session_ready':
        console.log(`✨ [LiveClient] Gemini Live session ready! Model: ${msg.model}`);
        this.setState('LISTENING');
        break;

      case 'audio': {
        // Model generated native audio!
        console.log(`🎵 [LiveClient] Response contains native audio (mime: ${msg.mimeType || 'unknown'}, len: ${msg.data?.length})`);
        try {
          const audioCtx = await this.playbackQueue.ensureAudioContext();
          const decoded = AudioDecoder.decodePcmBase64(msg.data, audioCtx, msg.mimeType);

          // Enqueue for gapless sequential playback
          await this.playbackQueue.enqueue(decoded.buffer);
        } catch (decErr: any) {
          console.error('❌ [LiveClient] Audio decoding or enqueue error:', decErr);
        }
        break;
      }

      case 'transcription': {
        // Output text from model
        const cleanIrisText = toEnglishAlphabets(msg.text || '');
        console.log(`💬 [LiveClient] Model transcription: "${cleanIrisText}"`);
        this.callbacks.onIrisTranscription(cleanIrisText);
        break;
      }

      case 'userTranscription': {
        // Input text transcribed from user speech - strictly convert to English/Latin alphabets!
        const englishUserText = toEnglishAlphabets(msg.text || '');
        console.log(`🎤 [LiveClient] User speech transcribed (English alphabets): "${englishUserText}"`);
        this.callbacks.onUserTranscription(englishUserText);
        break;
      }

      case 'interrupted': {
        console.log('⚡ [LiveClient] Model was interrupted by user speech');
        this.handleInterruption();
        break;
      }

      case 'turnComplete': {
        console.log('🏁 [LiveClient] Turn complete');
        this.turnPendingCompletion = true;
        break;
      }

      case 'toolCall': {
        console.log('🛠️ [LiveClient] Executing tool call:', msg.functionCalls);
        await this.handleToolCalls(msg.functionCalls);
        break;
      }

      case 'error': {
        console.error('❌ [LiveClient] Server reported error:', msg.message);
        this.setState('ERROR');
        this.callbacks.onError(msg.message);
        break;
      }

      case 'session_closed': {
        console.log('🔒 [LiveClient] Session closed by server');
        this.stop();
        break;
      }

      default:
        console.log('[LiveClient] Unhandled server message:', msg);
        break;
    }
  }

  /**
   * Handle user interruption: instantly stop playback, clear queue, reset state
   */
  private handleInterruption(): void {
    console.log('🛑 [LiveClient] Handling interruption: stopping audio playback and clearing queue');
    this.playbackQueue.interrupt();
    this.isSpeaking = false;
    this.callbacks.onInterruption?.();
    this.setState('LISTENING');
  }

  /**
   * Execute function calls requested by Gemini Live and report responses back
   */
  private async handleToolCalls(functionCalls: any[]): Promise<void> {
    if (!functionCalls || !Array.isArray(functionCalls)) return;

    const functionResponses: any[] = [];

    for (const call of functionCalls) {
      const { id, name, args } = call;
      console.log(`🛠️ [LiveClient] Running tool: ${name} (id: ${id}) with args:`, args);

      try {
        const result = await this.deviceBridge.executeTool(name, args || {});
        console.log(`✅ [LiveClient] Tool ${name} finished:`, result);

        this.callbacks.onToolAction({ name, args, result });

        if (name === 'requestFileUpload') {
          console.log('📷 [LiveClient] Opening live upload popup as requested by Iris');
          this.callbacks.onRequestFileUpload?.({
            fileType: args?.fileType || 'any',
            message: args?.message || 'Iris is ready to see your file or photo.',
          });
        }

        if (name === 'requestScreenShare' || name === 'startScreenShare') {
          console.log('🖥️ [LiveClient] Iris requested live screen view. Initiating screen share picker...');
          this.startScreenShare();
        }

        if (name === 'showGeneratedContent') {
          console.log('✨ [LiveClient] Showing generated content popup modal on user screen');
          this.callbacks.onShowGeneratedContent?.({
            title: args?.title || 'Generated by Iris',
            contentType: args?.contentType || 'code',
            language: args?.language || 'python',
            content: args?.content || '',
            summary: args?.summary || '',
          });
        }

        if (name === 'showLink' || (name === 'openUrl' && result.data?.url)) {
          console.log('🔗 [LiveClient] Showing link popup modal on user screen');
          this.callbacks.onShowGeneratedContent?.({
            title: args?.title || result.data?.title || 'Web Link',
            contentType: 'link',
            content: args?.url || result.data?.url || '',
            url: args?.url || result.data?.url || '',
            summary: args?.description || result.data?.summary || `Direct link: ${args?.url || result.data?.url}`,
          });
        }

        functionResponses.push({
          id,
          name,
          response: {
            output: result,
          },
        });
      } catch (err: any) {
        console.error(`❌ [LiveClient] Tool ${name} failed:`, err);
        const errResult: ToolExecutionResult = {
          success: false,
          action: name,
          error: err?.message || 'Tool execution error',
        };
        this.callbacks.onToolAction({ name, args, result: errResult });

        functionResponses.push({
          id,
          name,
          response: {
            output: errResult,
          },
        });
      }
    }

    // Send tool responses back to Gemini Live
    if (this.ws && this.ws.readyState === WebSocket.OPEN && functionResponses.length > 0) {
      console.log('📤 [LiveClient] Sending tool response to backend WebSocket:', functionResponses);
      this.ws.send(
        JSON.stringify({
          type: 'toolResponse',
          functionResponses,
        })
      );
    }
  }

  /**
   * Send a file, photo, or video to the ongoing Gemini Live session
   */
  sendFile(file: { name: string; mimeType: string; data: string; type: 'image' | 'video' | 'document' }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Voice session is not active. Connect first to send files in real time.');
    }
    console.log(`📤 [LiveClient] Sending file "${file.name}" (${file.mimeType}) to Gemini Live session`);
    this.ws.send(
      JSON.stringify({
        type: 'file_upload',
        file,
      })
    );
  }

  /**
   * Start live screen capture & transmit screen frames with cursor location to Iris
   */
  async startScreenShare(): Promise<boolean> {
    const success = await screenShareService.startScreenShare((frame) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log(`🖥️ [LiveClient] Transmitting screen frame to Iris (Cursor: ${frame.cursor.x}%, ${frame.cursor.y}%)`);
        this.ws.send(
          JSON.stringify({
            type: 'screen_frame',
            data: frame.base64Image,
            cursor: frame.cursor,
            width: frame.width,
            height: frame.height,
            timestamp: frame.timestamp,
          })
        );
      }
    });
    return success;
  }

  /**
   * Stop active screen share
   */
  stopScreenShare(): void {
    screenShareService.stopScreenShare();
  }

  /**
   * Stop the session and clean up all resources
   */
  stop(preserveErrorState = false): void {
    console.log('🛑 [LiveClient] Stopping Iris Live session and cleaning resources');
    if (!preserveErrorState) {
      this.setState('IDLE');
    }
    this.isSpeaking = false;

    this.stopScreenShare();

    if (this.streamer) {
      this.streamer.stop();
      this.streamer = null;
    }

    if (this.playbackQueue) {
      this.playbackQueue.interrupt();
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.callbacks.onAudioLevel(0);
  }

  /**
   * Speaker Diagnostic Test (440Hz test tone)
   */
  async runSpeakerTest(): Promise<{ success: boolean; message: string }> {
    return this.playbackQueue.testSpeaker();
  }

  /**
   * Resumes audio context if suspended when returning to tab
   */
  async ensureAudio(): Promise<void> {
    try {
      await this.playbackQueue.ensureAudioContext();
    } catch (e) {
      console.warn('[LiveClient] AudioContext ensure failed:', e);
    }
  }
}
