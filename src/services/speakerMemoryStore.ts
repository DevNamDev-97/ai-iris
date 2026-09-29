/**
 * Person-Specific Memory Folders & Permanent Multi-Speaker Voice Profile Store
 * Manages isolated memory folders for each speaker, dynamic voice registration,
 * continuous acoustic profile learning, and grammar/gender rules.
 * Starts completely from scratch (empty), learning and remembering each speaker's
 * unique voice tone forever.
 */

import { RegisteredSpeaker, AcousticVoiceProfile, classifyAcousticGender } from '../utils/voiceRecognition.ts';
import { crossSessionMemory } from './crossSessionMemory.ts';

export interface PersonMemoryItem {
  id: string;
  key: string;
  value: string;
  category: 'file' | 'personal' | 'preference' | 'reminder' | 'work' | 'general';
  timestamp: number;
  sourceText?: string;
}

export interface PersonMemoryFolder {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'non-binary' | 'unknown';
  grammaticalStyle: 'masculine' | 'feminine' | 'respectful'; // 'masculine' -> "chahta hai", 'feminine' -> "chahti hai", 'respectful' -> "chahte hain"
  pronounLabel: string; // e.g. "Male (chahta hai / karega)" or "Female (chahti hai / karegi)"
  relationship?: string;
  avatarColor: string;
  voiceProfile: AcousticVoiceProfile;
  memories: PersonMemoryItem[];
  conversationLogs: Array<{
    id: string;
    role: 'user' | 'iris';
    text: string;
    timestamp: number;
  }>;
  createdAt: number;
  lastSpokenAt: number;
}

const STORAGE_KEY_PERSON_FOLDERS = 'iris_person_memory_folders_v4';
const STORAGE_KEY_ACTIVE_SPEAKER_ID = 'iris_active_speaker_id_v4';

// Seed Initial State: Only Dev's voice memory is preserved, everyone else is cleared
const DEV_FOLDER: PersonMemoryFolder = {
  id: 'person-dev',
  name: 'Dev',
  gender: 'male',
  grammaticalStyle: 'masculine',
  pronounLabel: 'Male (chahta hai / karega)',
  relationship: 'Creator',
  avatarColor: '#2563eb',
  voiceProfile: {
    estimatedPitchHz: 142.5,
    pitchRange: [120, 165],
    spectralCentroid: 3590,
    timbreRange: [3400, 3780],
    instantaneousPitchHz: 142.5,
    instantaneousTimbreHz: 3590,
    pitchSamples: [120, 130, 142.5, 150, 160, 165],
    timbreSamples: [3400, 3500, 3590, 3650, 3700, 3780],
    voiceTimbre: 'tenor',
    detectedAcousticGender: 'male',
    confidence: 0.98,
    sampleCount: 6,
    lastAnalyzedAt: Date.now(),
  },
  memories: [
    {
      id: 'mem-dev-creator',
      key: 'Creator',
      value: 'Dev is Iris\'s creator and best friend.',
      category: 'personal',
      timestamp: Date.now() - 1000 * 60 * 60 * 24 * 7,
    },
    {
      id: 'mem-dev-tu-tadak',
      key: 'Language Tone',
      value: 'Tu-tadak close-friend tone ("tu", "karega", "yaar") is strictly reserved for Dev only.',
      category: 'preference',
      timestamp: Date.now(),
    },
  ],
  conversationLogs: [],
  createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  lastSpokenAt: Date.now(),
};

const DEFAULT_FOLDERS: PersonMemoryFolder[] = [];

class SpeakerMemoryStore {
  private folders: PersonMemoryFolder[] = [];
  private activeSpeakerId: string = '';
  private listeners: Set<() => void> = new Set();
  public latestObservedPitch: number = 0;
  public latestObservedCentroid: number = 0;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PERSON_FOLDERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.folders = parsed;
        } else {
          this.folders = [];
        }
      } else {
        this.folders = [];
      }
      this.activeSpeakerId = localStorage.getItem(STORAGE_KEY_ACTIVE_SPEAKER_ID) || '';
      if (this.folders.length > 0 && !this.activeSpeakerId) {
        this.activeSpeakerId = this.folders[0].id;
      }
      this.saveToStorage();
    } catch (e) {
      console.warn('Failed to load speaker folders from storage:', e);
      this.folders = [];
      this.activeSpeakerId = '';
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_PERSON_FOLDERS, JSON.stringify(this.folders));
      localStorage.setItem(STORAGE_KEY_ACTIVE_SPEAKER_ID, this.activeSpeakerId);
      this.syncWithServer();
    } catch (e) {
      console.warn('Failed to save speaker folders:', e);
    }
    this.notify();
  }

  public async syncWithServer() {
    try {
      await fetch('/api/speaker/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folders: this.folders,
          activeSpeakerId: this.activeSpeakerId,
        }),
      });
    } catch {
      // Offline fallback
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Record real-time acoustic telemetry from audio stream
  public recordLiveAcoustics(pitchHz: number, centroid: number): void {
    if (pitchHz > 60) {
      this.latestObservedPitch = pitchHz;
      this.latestObservedCentroid = centroid;
    }
  }

  // Get All Folders
  public getFolders(): PersonMemoryFolder[] {
    return [...this.folders];
  }

  // Purge all voice recognition data including Dev profile
  public purgeAllVoiceData(): void {
    this.folders = [];
    this.activeSpeakerId = '';
    this.latestObservedPitch = 0;
    this.latestObservedCentroid = 0;

    try {
      localStorage.setItem(STORAGE_KEY_PERSON_FOLDERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_ACTIVE_SPEAKER_ID, '');
      localStorage.removeItem('iris_person_memory_folders_v4');
      localStorage.removeItem('iris_person_memory_folders_v3');
      localStorage.removeItem('iris_person_memory_folders_v2');
      localStorage.removeItem('iris_person_memory_folders_v1');
      localStorage.removeItem('iris_registered_speakers_v3');
      localStorage.removeItem('iris_registered_speakers_v2');
    } catch (e) {
      console.warn('Failed clearing localStorage keys:', e);
    }

    try {
      fetch('/api/speaker/purge-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    } catch {
      // offline
    }

    this.notify();
    console.log('[SpeakerMemoryStore] Wiped all speaker profiles and voice memory.');
  }

  public resetToDefaults(): void {
    this.purgeAllVoiceData();
  }

  public deleteAllFolders(): void {
    this.purgeAllVoiceData();
  }

  // Delete an individual person folder
  public deleteFolder(folderId: string): boolean {
    const idx = this.folders.findIndex((f) => f.id === folderId);
    if (idx >= 0) {
      const removed = this.folders.splice(idx, 1)[0];
      if (this.activeSpeakerId === folderId) {
        this.activeSpeakerId = this.folders.length > 0 ? this.folders[0].id : '';
      }
      this.saveToStorage();
      console.log(`🗑️ [SpeakerMemoryStore] Deleted folder: "${removed.name}"`);
      return true;
    }
    return false;
  }

  // Get Active Speaker Folder (Null-safe fallback for empty state)
  public getActiveFolder(): PersonMemoryFolder {
    const active = this.folders.find((f) => f.id === this.activeSpeakerId);
    if (active) return active;
    if (this.folders.length > 0) return this.folders[0];

    // Clean placeholder when database is starting from scratch
    return {
      id: 'guest',
      name: 'Unknown Voice',
      gender: 'unknown',
      grammaticalStyle: 'respectful',
      pronounLabel: 'Unknown Voice (Aap)',
      relationship: 'Guest / Unregistered User',
      avatarColor: '#64748b',
      voiceProfile: {
        estimatedPitchHz: this.latestObservedPitch || 0,
        pitchRange: [0, 0],
        spectralCentroid: this.latestObservedCentroid || 0,
        timbreRange: [0, 0],
        instantaneousPitchHz: 0,
        instantaneousTimbreHz: 0,
        pitchSamples: [],
        timbreSamples: [],
        voiceTimbre: 'unvoiced_or_noise',
        detectedAcousticGender: 'ambiguous',
        confidence: 0,
        sampleCount: 0,
        lastAnalyzedAt: Date.now(),
      },
      memories: [],
      conversationLogs: [],
      createdAt: Date.now(),
      lastSpokenAt: Date.now(),
    };
  }

  // Switch Active Speaker
  public setActiveSpeaker(speakerId: string): PersonMemoryFolder | null {
    const folder = this.folders.find((f) => f.id === speakerId);
    if (folder) {
      this.activeSpeakerId = speakerId;
      folder.lastSpokenAt = Date.now();
      this.saveToStorage();
      return folder;
    }
    return null;
  }

  // Continuous Biometric Adaptation: Updates running voice profile when recognized
  public updateLiveAcoustics(speakerId: string, livePitch: number, liveCentroid: number): void {
    const folder = this.folders.find((f) => f.id === speakerId);
    if (!folder || livePitch < 65) return;

    const vp = folder.voiceProfile;
    // Exponential Moving Average with slight adaptation rate (alpha = 0.08)
    const alpha = 0.08;
    vp.estimatedPitchHz = Math.round((vp.estimatedPitchHz * (1 - alpha) + livePitch * alpha) * 10) / 10;
    vp.spectralCentroid = Math.round(vp.spectralCentroid * (1 - alpha) + liveCentroid * alpha);
    vp.pitchRange = [
      Math.min(vp.pitchRange[0], Math.round(livePitch * 0.9)),
      Math.max(vp.pitchRange[1], Math.round(livePitch * 1.1)),
    ];
    vp.sampleCount += 1;
    vp.lastAnalyzedAt = Date.now();
    folder.lastSpokenAt = Date.now();

    // Silently persist updated biometric calibration
    try {
      localStorage.setItem(STORAGE_KEY_PERSON_FOLDERS, JSON.stringify(this.folders));
    } catch {
      // Storage quota or busy
    }
  }

  // Update Speaker Details (Grammar, Relationship, Name)
  public updateSpeakerDetails(
    folderId: string,
    updates: Partial<{
      name: string;
      gender: 'male' | 'female' | 'non-binary' | 'unknown';
      grammaticalStyle: 'masculine' | 'feminine' | 'respectful';
      relationship: string;
      pronounLabel: string;
    }>
  ): PersonMemoryFolder | null {
    const folder = this.folders.find((f) => f.id === folderId);
    if (!folder) return null;
    if (updates.name) folder.name = updates.name.trim();
    if (updates.gender) folder.gender = updates.gender;
    if (updates.grammaticalStyle) {
      folder.grammaticalStyle = updates.grammaticalStyle;
      folder.pronounLabel =
        updates.grammaticalStyle === 'feminine'
          ? 'Female (chahti hai / karegi)'
          : updates.grammaticalStyle === 'respectful'
          ? 'Respectful (chahte hain / karenge)'
          : 'Male (chahta hai / karega)';
    }
    if (updates.relationship) folder.relationship = updates.relationship;
    this.saveToStorage();
    return folder;
  }

  // Register New Speaker or Update Existing - Remembers voice tone forever!
  // CRITICAL SECURITY & BIOMETRIC AUTHENTICITY RULE:
  // Once a voice memory is initiated for a person (e.g. Dev or any registered profile),
  // no strange/unmatched voice can overwrite or save their voice as that person!
  public registerOrUpdateSpeaker(params: {
    name: string;
    gender?: 'male' | 'female' | 'non-binary' | 'unknown';
    grammaticalStyle?: 'masculine' | 'feminine' | 'respectful';
    relationship?: string;
    pitchHz?: number;
    spectralCentroid?: number;
    notes?: string;
  }): { folder: PersonMemoryFolder | null; rejected: boolean; reason?: string } {
    const cleanName = params.name.trim();
    const existing = this.folders.find(
      (f) => f.name.toLowerCase() === cleanName.toLowerCase()
    );

    // Use live acoustic measurement if not explicitly passed
    const pitch = params.pitchHz || (this.latestObservedPitch > 65 ? this.latestObservedPitch : 125);
    const centroid = params.spectralCentroid || (this.latestObservedCentroid > 400 ? this.latestObservedCentroid : 1200);
    const classified = classifyAcousticGender(pitch, centroid);

    const gender = params.gender || (classified.gender !== 'ambiguous' ? classified.gender : 'male');
    const gramm = params.grammaticalStyle || (gender === 'female' ? 'feminine' : 'masculine');

    const pronounLabel =
      gramm === 'feminine'
        ? 'Female (chahti hai / karegi)'
        : gramm === 'respectful'
        ? 'Respectful (chahte hain / karenge)'
        : 'Male (chahta hai / karega)';

    if (existing) {
      // 🔒 BIOMETRIC INTEGRITY CHECK:
      // If this speaker already has a calibrated voice profile (> 0 samples),
      // verify that the speaking voice actually resembles them acoustically!
      if (existing.voiceProfile && existing.voiceProfile.sampleCount > 0) {
        const targetPitch = existing.voiceProfile.estimatedPitchHz;
        const targetCentroid = existing.voiceProfile.spectralCentroid;
        const pitchDiff = Math.abs(pitch - targetPitch);
        const centroidDiff = Math.abs(centroid - targetCentroid);

        // Discrepancy threshold:
        // A strange voice with wildly different fundamental pitch (> 45 Hz diff)
        // or completely different vocal tract timbre (> 750 Hz diff) cannot claim to be this person!
        const isPitchMismatch = pitchDiff > 45;
        const isCentroidMismatch = centroidDiff > 750;
        const isGenderMismatch =
          classified.confidence > 0.8 &&
          classified.gender !== 'ambiguous' &&
          classified.gender !== (existing.gender === 'female' ? 'female' : 'male');

        if ((isPitchMismatch && isCentroidMismatch) || isGenderMismatch || (pitchDiff > 65)) {
          const reason = `Voice biometric mismatch: Speaking voice (~${Math.round(pitch)} Hz, timbre ${Math.round(centroid)} Hz) does not match ${existing.name}'s calibrated profile (~${Math.round(targetPitch)} Hz). Impersonation rejected.`;
          console.warn(`🛡️ [SpeakerMemoryStore] Security rejection: ${reason}`);
          return {
            folder: null,
            rejected: true,
            reason: `Aapki aawaz ${existing.name} ki registered aawaz se match nahi ho rahi hai. Aap ${existing.name} nahi hain, kripya confirm kijiye ki aap kaun bol rahe hain?`,
          };
        }
      }

      existing.name = cleanName;
      if (params.gender) existing.gender = params.gender;
      if (params.grammaticalStyle) existing.grammaticalStyle = params.grammaticalStyle;
      existing.pronounLabel = pronounLabel;
      if (params.relationship) existing.relationship = params.relationship;

      // Refine voice tone calibration with moving average
      existing.voiceProfile.estimatedPitchHz = Math.round(((existing.voiceProfile.estimatedPitchHz + pitch) / 2) * 10) / 10;
      existing.voiceProfile.spectralCentroid = Math.round((existing.voiceProfile.spectralCentroid + centroid) / 2);
      existing.voiceProfile.pitchRange = [
        Math.min(existing.voiceProfile.pitchRange[0], Math.round(pitch * 0.88)),
        Math.max(existing.voiceProfile.pitchRange[1], Math.round(pitch * 1.12)),
      ];
      existing.voiceProfile.sampleCount += 1;
      existing.voiceProfile.lastAnalyzedAt = Date.now();
      existing.lastSpokenAt = Date.now();

      this.activeSpeakerId = existing.id;
      this.saveToStorage();

      // Persist permanently in cross-session memory database
      crossSessionMemory.learnFact(
        `Voice Tone Profile - ${cleanName}`,
        `${cleanName}'s voice is calibrated at ~${existing.voiceProfile.estimatedPitchHz} Hz (timbre: ${existing.voiceProfile.spectralCentroid} Hz, ${existing.gender}, grammar: ${existing.grammaticalStyle}). Remembered forever.`,
        'personal'
      );

      console.log(`🎙️ [SpeakerMemoryStore] Updated & remembered voice profile for "${cleanName}": ~${existing.voiceProfile.estimatedPitchHz} Hz, Timbre: ${existing.voiceProfile.spectralCentroid} Hz`);
      return { folder: existing, rejected: false };
    }

    // Create New Folder for a genuinely new person
    const id = `person-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
    const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#db2777'];
    const avatarColor = colors[this.folders.length % colors.length];

    const newFolder: PersonMemoryFolder = {
      id,
      name: cleanName,
      gender,
      grammaticalStyle: gramm,
      pronounLabel,
      relationship: params.relationship || (cleanName.toLowerCase() === 'dev' ? 'Creator' : 'User'),
      avatarColor,
      voiceProfile: {
        estimatedPitchHz: Math.round(pitch * 10) / 10,
        pitchRange: [Math.round(pitch * 0.88), Math.round(pitch * 1.12)],
        spectralCentroid: Math.round(centroid),
        timbreRange: [Math.round(centroid * 0.85), Math.round(centroid * 1.15)],
        instantaneousPitchHz: Math.round(pitch * 10) / 10,
        instantaneousTimbreHz: Math.round(centroid),
        pitchSamples: [Math.round(pitch * 0.9), Math.round(pitch), Math.round(pitch * 1.1)],
        timbreSamples: [Math.round(centroid * 0.9), Math.round(centroid), Math.round(centroid * 1.1)],
        voiceTimbre: classified.timbre,
        detectedAcousticGender: classified.gender,
        confidence: classified.confidence,
        sampleCount: 1,
        lastAnalyzedAt: Date.now(),
      },
      memories: [],
      conversationLogs: [],
      createdAt: Date.now(),
      lastSpokenAt: Date.now(),
    };

    this.folders.push(newFolder);
    this.activeSpeakerId = newFolder.id;
    this.saveToStorage();

    // Persist permanently in cross-session memory database
    crossSessionMemory.learnFact(
      `Voice Tone Profile - ${cleanName}`,
      `${cleanName}'s voice tone is registered at ~${newFolder.voiceProfile.estimatedPitchHz} Hz (timbre: ${newFolder.voiceProfile.spectralCentroid} Hz, ${gender}, style: ${gramm}). Remembered forever.`,
      'personal'
    );

    console.log(`🎙️ [SpeakerMemoryStore] Registered NEW voice profile for "${cleanName}": ~${newFolder.voiceProfile.estimatedPitchHz} Hz, Timbre: ${newFolder.voiceProfile.spectralCentroid} Hz. Stored forever.`);
    return { folder: newFolder, rejected: false };
  }

  // Add Memory into a Specific Person's Folder
  public addMemory(params: {
    folderId?: string;
    key: string;
    value: string;
    category?: PersonMemoryItem['category'];
    sourceText?: string;
  }): PersonMemoryItem {
    const targetFolder = params.folderId
      ? this.folders.find((f) => f.id === params.folderId) || this.getActiveFolder()
      : this.getActiveFolder();

    const existingIdx = targetFolder.memories.findIndex(
      (m) => m.key.toLowerCase() === params.key.toLowerCase()
    );

    const memoryItem: PersonMemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key: params.key,
      value: params.value,
      category: params.category || 'general',
      timestamp: Date.now(),
      sourceText: params.sourceText,
    };

    if (existingIdx >= 0) {
      targetFolder.memories[existingIdx] = memoryItem;
    } else {
      targetFolder.memories.unshift(memoryItem);
    }

    this.saveToStorage();
    return memoryItem;
  }

  // Delete Memory from a Person's Folder
  public deleteMemory(folderId: string, memoryId: string): boolean {
    const targetFolder = this.folders.find((f) => f.id === folderId);
    if (!targetFolder) return false;

    const initialLen = targetFolder.memories.length;
    targetFolder.memories = targetFolder.memories.filter((m) => m.id !== memoryId);

    if (targetFolder.memories.length !== initialLen) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // Record Conversation Turn in Active Person's Folder
  public recordTurn(role: 'user' | 'iris', text: string): void {
    const active = this.getActiveFolder();
    if (active.id === 'guest') return;

    active.conversationLogs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      role,
      text,
      timestamp: Date.now(),
    });

    if (active.conversationLogs.length > 50) {
      active.conversationLogs.shift();
    }

    active.lastSpokenAt = Date.now();
    this.saveToStorage();
  }

  // Get Registered Speakers formatted for Voice Recognition matcher
  public getRegisteredSpeakers(): RegisteredSpeaker[] {
    return this.folders.map((f) => ({
      id: f.id,
      name: f.name,
      gender: f.gender,
      grammaticalStyle: f.grammaticalStyle,
      voiceProfile: f.voiceProfile,
      relationship: f.relationship,
      avatarColor: f.avatarColor,
      createdAt: f.createdAt,
      lastSpokenAt: f.lastSpokenAt,
    }));
  }
}

export const speakerMemoryStore = new SpeakerMemoryStore();
