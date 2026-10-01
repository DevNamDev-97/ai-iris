/**
 * Cross-Session Memory & Learned Knowledge Database
 * Automatically learns, indexes, and persists all previous chats, voice speech logs,
 * user facts/preferences, file locations, and discussion topics across sessions.
 */

export interface StoredFileMemory {
  id: string;
  name: string;
  originalName: string;
  extension: string;
  category: 'document' | 'image' | 'video' | 'code' | 'archive' | 'other';
  lastKnownLocation: string; // e.g. "Downloads folder in Google Files"
  folderPath: string; // e.g. "Downloads/PDF 1.pdf"
  appSource: string; // e.g. "Google Files", "Files by Google", "Downloads"
  associatedAction?: string;
  contentSnippet?: string;
  sizeDescription?: string;
  mimeType: string;
  lastAccessed: number;
  sessionNotes?: string;
}

export interface StoredInteractionMemory {
  id: string;
  timestamp: number;
  role: 'user' | 'iris';
  type: 'speech_log' | 'chat';
  text: string;
  speakerName?: string;
  personFolder?: string; // The folder this interaction belongs to (e.g. "Dev", "Unidentified Person", "Rohit")
  isTemporary?: boolean;
  expiresAt?: number;
  entities?: {
    files?: string[];
    apps?: string[];
    topics?: string[];
    locations?: string[];
    facts?: string[];
  };
}

export interface LearnedFact {
  id: string;
  key: string;
  value: string;
  category: 'personal' | 'preference' | 'work' | 'file' | 'schedule' | 'general';
  timestamp: number;
  sourceText?: string;
}

export interface MemorySearchResult {
  found: boolean;
  file?: StoredFileMemory;
  relevantInteractions: StoredInteractionMemory[];
  relevantFacts: LearnedFact[];
  summary: string;
}

const STORAGE_KEY_FILES = 'iris_memory_files_v2';
const STORAGE_KEY_INTERACTIONS = 'iris_memory_interactions_v2';
const STORAGE_KEY_FACTS = 'iris_memory_facts_v2';

// Default clean initial memory (No mock files or fake memories)
const DEFAULT_FILES: StoredFileMemory[] = [];
const DEFAULT_FACTS: LearnedFact[] = [];
const DEFAULT_INTERACTIONS: StoredInteractionMemory[] = [];

export class CrossSessionMemoryEngine {
  private files: StoredFileMemory[] = [];
  private interactions: StoredInteractionMemory[] = [];
  private facts: LearnedFact[] = [];
  private syncDebounceTimer: any = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof window === 'undefined') return;

      const savedFiles = localStorage.getItem(STORAGE_KEY_FILES);
      if (savedFiles) {
        try {
          const parsed = JSON.parse(savedFiles);
          this.files = Array.isArray(parsed) ? parsed.filter((f: any) => !f.id?.startsWith('file-pdf') && !f.name?.includes('PDF 1')) : [];
        } catch {
          this.files = [];
        }
      } else {
        this.files = [];
        this.saveFiles();
      }

      const savedInteractions = localStorage.getItem(STORAGE_KEY_INTERACTIONS);
      if (savedInteractions) {
        try {
          const parsed = JSON.parse(savedInteractions);
          const now = Date.now();
          this.interactions = Array.isArray(parsed)
            ? parsed.filter((i: StoredInteractionMemory) => {
                if (i.text?.includes('PDF 1')) return false;
                // Auto-cleanup temporary 15-day guest entries
                if (i.isTemporary && i.expiresAt && now > i.expiresAt) return false;
                return true;
              })
            : [];
        } catch {
          this.interactions = [];
        }
      } else {
        this.interactions = [];
        this.saveInteractions();
      }

      const savedFacts = localStorage.getItem(STORAGE_KEY_FACTS);
      if (savedFacts) {
        try {
          const parsed = JSON.parse(savedFacts);
          this.facts = Array.isArray(parsed) ? parsed.filter((f: any) => !f.key?.includes('PDF') && !f.value?.includes('PDF 1')) : [];
        } catch {
          this.facts = [];
        }
      } else {
        this.facts = [];
        this.saveFacts();
      }

      // Initial server sync
      this.triggerServerSync();
    } catch (e) {
      console.warn('Could not load cross-session memory from storage:', e);
      this.files = [];
      this.interactions = [];
      this.facts = [];
    }
  }

  private saveFiles(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(this.files));
      }
    } catch (e) {
      console.warn('Failed to save memory files:', e);
    }
  }

  private saveInteractions(): void {
    try {
      if (typeof window !== 'undefined') {
        // Keep up to 500 recent conversation turns in local cache
        localStorage.setItem(STORAGE_KEY_INTERACTIONS, JSON.stringify(this.interactions.slice(-500)));
      }
    } catch (e) {
      console.warn('Failed to save memory interactions:', e);
    }
  }

  private saveFacts(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_FACTS, JSON.stringify(this.facts));
      }
    } catch (e) {
      console.warn('Failed to save memory facts:', e);
    }
  }

  /**
   * Debounced background sync with the backend database
   */
  private triggerServerSync(): void {
    if (typeof window === 'undefined') return;
    if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);

    this.syncDebounceTimer = setTimeout(async () => {
      try {
        await fetch('/api/memory/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interactions: this.interactions.slice(-100),
            facts: this.facts,
            files: this.files,
          }),
        });
      } catch (err) {
        // Non-blocking sync error
        console.debug('Memory server sync warning:', err);
      }
    }, 1200);
  }

  /**
   * Automatically extracts and learns key facts from natural language
   */
  private extractAndLearnFacts(role: 'user' | 'iris', text: string): string[] {
    const extracted: string[] = [];
    if (!text || role !== 'user') return extracted;

    const lower = text.toLowerCase();

    // 1. "My name is X" / "Mera naam X hai"
    const nameMatch = text.match(/(?:my name is|mera naam|i am called)\s+([A-Za-z0-9\s]+)/i);
    if (nameMatch && nameMatch[1]) {
      const name = nameMatch[1].trim().split(/[.,!]/)[0];
      this.learnFact('User Name', `User's name is ${name}`, 'personal', text);
      extracted.push(`User Name: ${name}`);
      this.transferTemporaryHistoryToPerson(name);
      if (typeof window !== 'undefined') {
        (window as any).__irisActiveSpeakerName = name;
      }
    }

    // 2. "My favorite X is Y" / "Mera favorite X Y hai"
    const favMatch = text.match(/(?:my favorite|mera favorite|mujhe sabse jyada|i love)\s+([a-zA-Z\s]+?)\s+(?:is|hai|hota hai)\s+([a-zA-Z0-9\s]+)/i);
    if (favMatch && favMatch[1] && favMatch[2]) {
      const item = favMatch[1].trim();
      const val = favMatch[2].trim().split(/[.,!]/)[0];
      this.learnFact(`Favorite ${item}`, `User's favorite ${item} is ${val}`, 'preference', text);
      extracted.push(`Favorite ${item}: ${val}`);
    }

    // 3. "I am working on X" / "Mera project X hai"
    const projectMatch = text.match(/(?:i am working on|mera project|we are building|working on project)\s+([a-zA-Z0-9\s_-]+)/i);
    if (projectMatch && projectMatch[1]) {
      const proj = projectMatch[1].trim().split(/[.,!]/)[0];
      this.learnFact('Current Project', `User is working on: ${proj}`, 'work', text);
      extracted.push(`Current Project: ${proj}`);
    }

    // 4. "Remember that X" / "Yaad rakhna X" / "Note kar lo X"
    const rememberMatch = text.match(/(?:remember that|yaad rakhna|yaad rakh|note this down|keep in mind that)\s+([^\n\r.]+)/i);
    if (rememberMatch && rememberMatch[1]) {
      const note = rememberMatch[1].trim();
      this.learnFact('User Note', note, 'general', text);
      extracted.push(`Note: ${note}`);
    }

    // 5. "I live in X" / "Main X mein rehta hoon"
    const liveMatch = text.match(/(?:i live in|main\s+([a-zA-Z\s]+)\s+mein rehta hoon|from\s+([a-zA-Z\s]+))/i);
    if (liveMatch) {
      const city = (liveMatch[1] || liveMatch[2] || '').trim().split(/[.,!]/)[0];
      if (city) {
        this.learnFact('User Location', `User lives in or is from ${city}`, 'personal', text);
        extracted.push(`Location: ${city}`);
      }
    }

    return extracted;
  }

  /**
   * Explicitly learns and persists a fact
   */
  learnFact(key: string, value: string, category: LearnedFact['category'] = 'general', sourceText?: string): LearnedFact {
    const existingIndex = this.facts.findIndex((f) => f.key.toLowerCase() === key.toLowerCase());
    const fact: LearnedFact = {
      id: existingIndex >= 0 ? this.facts[existingIndex].id : `fact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      key,
      value,
      category,
      timestamp: Date.now(),
      sourceText,
    };

    if (existingIndex >= 0) {
      this.facts[existingIndex] = fact;
    } else {
      this.facts.unshift(fact);
    }

    this.saveFacts();
    this.triggerServerSync();
    return fact;
  }

  /**
   * Records a live voice speech log turn
   */
  recordSpeechLog(role: 'user' | 'iris', text: string, speakerName?: string, isTemporary?: boolean): void {
    if (!text || !text.trim()) return;
    this.recordInteractionInternal(role, 'speech_log', text.trim(), undefined, speakerName, isTemporary);
  }

  /**
   * Records a chat interaction turn
   */
  recordInteraction(role: 'user' | 'iris', text: string, attachedFiles?: Array<{ name: string; mimeType: string }>, speakerName?: string, isTemporary?: boolean): void {
    if (!text && (!attachedFiles || attachedFiles.length === 0)) return;

    const fileNames: string[] = [];
    if (attachedFiles) {
      attachedFiles.forEach((f) => {
        fileNames.push(f.name);
        this.indexFileReference({
          name: f.name.replace(/\.[^/.]+$/, ''),
          originalName: f.name,
          extension: f.name.split('.').pop() || '',
          category: f.mimeType.startsWith('image/') ? 'image' : f.mimeType.startsWith('video/') ? 'video' : 'document',
          lastKnownLocation: 'Uploaded in Iris Chat / Downloads',
          folderPath: `Downloads/${f.name}`,
          appSource: 'Google Files (Downloads)',
          mimeType: f.mimeType,
          sessionNotes: `Uploaded during interaction on ${new Date().toLocaleDateString()}`,
        });
      });
    }

    this.recordInteractionInternal(role, 'chat', text, fileNames, speakerName, isTemporary);
  }

  private recordInteractionInternal(
    role: 'user' | 'iris',
    type: 'speech_log' | 'chat',
    text: string,
    attachedFileNames?: string[],
    explicitSpeakerName?: string,
    explicitIsTemp?: boolean
  ): void {
    const lower = text.toLowerCase();
    let detectedLocation = '';
    if (lower.includes('google files') || lower.includes('downloads folder') || lower.includes('download')) {
      detectedLocation = 'Downloads folder in Google Files';
    } else if (lower.includes('google drive') || lower.includes('drive')) {
      detectedLocation = 'Google Drive';
    } else if (lower.includes('documents folder') || lower.includes('documents')) {
      detectedLocation = 'Documents folder';
    }

    const learnedFacts = this.extractAndLearnFacts(role, text);

    // Determine the active conversation partner (person folder)
    let activePartner: string | null = null;
    if (explicitSpeakerName && explicitSpeakerName !== 'I.R.I.S.' && explicitSpeakerName !== 'iris') {
      activePartner = explicitSpeakerName;
    } else if (typeof window !== 'undefined') {
      if ((window as any).__irisActiveSpeakerName) {
        activePartner = (window as any).__irisActiveSpeakerName;
      } else if ((window as any).__irisIsDeveloper) {
        activePartner = 'Dev';
      }
    }

    // If person's name is not yet identified, save to temporary "Unidentified Person" folder
    if (!activePartner || activePartner.toLowerCase() === 'unknown' || activePartner.toLowerCase() === 'guest') {
      activePartner = 'Unidentified Person';
    }

    const isTemporary = explicitIsTemp !== undefined 
      ? explicitIsTemp 
      : (activePartner === 'Unidentified Person');
    const expiresAt = isTemporary ? Date.now() + 15 * 24 * 60 * 60 * 1000 : undefined; // 15-day dump lifecycle

    const finalSpeakerName = role === 'iris' ? 'I.R.I.S.' : activePartner;

    const newMem: StoredInteractionMemory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      role,
      type,
      text,
      speakerName: finalSpeakerName,
      personFolder: activePartner,
      isTemporary,
      expiresAt,
      entities: {
        files: attachedFileNames && attachedFileNames.length > 0 ? attachedFileNames : undefined,
        locations: detectedLocation ? [detectedLocation] : undefined,
        facts: learnedFacts.length > 0 ? learnedFacts : undefined,
      },
    };

    this.interactions.push(newMem);
    this.saveInteractions();
    this.triggerServerSync();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iris-history-updated'));
    }
  }

  /**
   * Transfers all interactions currently in the temporary "Unidentified Person" folder
   * to the newly identified person folder (e.g. "Dev" or "Rohit") when the name becomes known.
   */
  public transferTemporaryHistoryToPerson(targetPersonName: string): number {
    const cleanTarget = (targetPersonName || 'Dev').trim();
    if (!cleanTarget || cleanTarget.toLowerCase() === 'unidentified person') return 0;

    let transferredCount = 0;
    this.interactions = this.interactions.map((turn) => {
      const folder = (turn.personFolder || turn.speakerName || '').trim();
      const isUnidentified =
        folder.toLowerCase() === 'unidentified person' ||
        folder.toLowerCase() === 'unknown' ||
        folder.toLowerCase() === 'guest' ||
        turn.isTemporary;

      if (isUnidentified) {
        transferredCount++;
        return {
          ...turn,
          personFolder: cleanTarget,
          speakerName: turn.role === 'iris' ? 'I.R.I.S.' : cleanTarget,
          isTemporary: false,
          expiresAt: undefined,
        };
      }
      return turn;
    });

    if (transferredCount > 0) {
      this.saveInteractions();
      this.triggerServerSync();
      if (typeof window !== 'undefined') {
        (window as any).__irisActiveSpeakerName = cleanTarget;
        window.dispatchEvent(new CustomEvent('iris-history-updated'));
      }
      console.log(`📦 [CrossSessionMemory] Transferred ${transferredCount} turns from "Unidentified Person" to "${cleanTarget}".`);
    }

    return transferredCount;
  }

  /**
   * Delete chat history for a specific person or all (both user turns and Iris turns)
   */
  public deleteInteractionsForPerson(personName: string): number {
    const initialLen = this.interactions.length;
    const cleanName = (personName || '').trim().toLowerCase();

    if (cleanName === 'all' || cleanName === '*' || cleanName === 'everyone') {
      this.interactions = [];
    } else {
      this.interactions = this.interactions.filter((i) => {
        const folder = (i.personFolder || (i.speakerName !== 'I.R.I.S.' ? i.speakerName : '') || '').toLowerCase().trim();
        const speaker = (i.speakerName || '').toLowerCase().trim();

        if (cleanName === 'unidentified person' || cleanName === 'unknown' || cleanName === 'guest') {
          if (folder === 'unidentified person' || folder === 'unknown' || folder === 'guest' || i.isTemporary) return false;
          if (speaker === 'unknown' || speaker === 'unidentified person' || speaker === 'guest') return false;
        }

        if (cleanName === 'dev') {
          if (folder === 'dev' || speaker === 'dev' || speaker === 'you') return false;
        }

        if (folder === cleanName || speaker === cleanName) return false;
        return true;
      });
    }

    const removedCount = initialLen - this.interactions.length;
    this.saveInteractions();
    this.triggerServerSync();

    // Also call server memory deletion endpoint
    try {
      fetch('/api/memory/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personName }),
      }).catch((err) => console.debug('Server memory delete non-blocking error:', err));
    } catch (e) {
      // Non-blocking
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iris-history-updated'));
    }

    console.log(`🗑️ [CrossSessionMemory] Deleted ${removedCount} interactions for "${personName}".`);
    return removedCount;
  }

  /**
   * Explicitly index or update a file's location in cross-session memory
   */
  indexFileReference(fileData: Partial<StoredFileMemory> & { name: string; originalName: string }): StoredFileMemory {
    const existingIndex = this.files.findIndex(
      (f) =>
        f.name.toLowerCase() === fileData.name.toLowerCase() ||
        f.originalName.toLowerCase() === fileData.originalName.toLowerCase()
    );

    const updatedFile: StoredFileMemory = {
      id: existingIndex >= 0 ? this.files[existingIndex].id : `file-${Date.now()}`,
      name: fileData.name,
      originalName: fileData.originalName,
      extension: fileData.extension || fileData.originalName.split('.').pop() || 'pdf',
      category: fileData.category || 'document',
      lastKnownLocation: fileData.lastKnownLocation || 'Downloads folder in Google Files',
      folderPath: fileData.folderPath || `Downloads/${fileData.originalName}`,
      appSource: fileData.appSource || 'Google Files (Files by Google)',
      associatedAction: fileData.associatedAction || 'openApp: Google Files',
      contentSnippet: fileData.contentSnippet || 'Stored document in device memory.',
      sizeDescription: fileData.sizeDescription || 'File on device',
      mimeType: fileData.mimeType || 'application/pdf',
      lastAccessed: Date.now(),
      sessionNotes: fileData.sessionNotes || 'Indexed from conversation history.',
    };

    if (existingIndex >= 0) {
      this.files[existingIndex] = updatedFile;
    } else {
      this.files.unshift(updatedFile);
    }

    this.saveFiles();
    this.triggerServerSync();
    return updatedFile;
  }

  /**
   * Search cross-session memory by analyzing previous chat interactions, speech logs, files, and learned facts.
   */
  searchInteractionMemory(query: string): MemorySearchResult {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) {
      return {
        found: false,
        relevantInteractions: [],
        relevantFacts: [],
        summary: 'No search term provided.',
      };
    }

    // 1. Direct file name match
    let matchedFile = this.files.find((f) => {
      const fName = f.name.toLowerCase();
      const fOrig = f.originalName.toLowerCase();
      const fNorm = fName.replace(/\s+/g, '');
      const qNorm = cleanQuery.replace(/\s+/g, '');

      return (
        cleanQuery.includes(fName) ||
        cleanQuery.includes(fOrig) ||
        fName.includes(cleanQuery) ||
        qNorm.includes(fNorm) ||
        (cleanQuery.includes('pdf') && (cleanQuery.includes('1') || cleanQuery.includes('one')) && fName.includes('pdf 1'))
      );
    });

    // 2. Search through learned facts
    const relevantFacts = this.facts.filter((fact) => {
      const keyLow = fact.key.toLowerCase();
      const valLow = fact.value.toLowerCase();
      return (
        keyLow.includes(cleanQuery) ||
        valLow.includes(cleanQuery) ||
        cleanQuery.includes(keyLow) ||
        cleanQuery.split(/\s+/).some((word) => word.length > 3 && (keyLow.includes(word) || valLow.includes(word)))
      );
    });

    // 3. Search through interaction history & speech logs
    const keywords = cleanQuery.split(/\s+/).filter((w) => w.length > 2);
    const relevantInteractions = this.interactions.filter((turn) => {
      const turnLower = turn.text.toLowerCase();
      if (turnLower.includes(cleanQuery)) return true;
      if (matchedFile && (turnLower.includes(matchedFile.name.toLowerCase()) || turnLower.includes(matchedFile.originalName.toLowerCase()))) return true;
      if (keywords.length > 0 && keywords.every((kw) => turnLower.includes(kw))) return true;
      return false;
    });

    const hasResults = !!matchedFile || relevantFacts.length > 0 || relevantInteractions.length > 0;

    let summary = '';
    if (matchedFile) {
      matchedFile.lastAccessed = Date.now();
      this.saveFiles();
      summary += `Found file "${matchedFile.originalName}" in memory (Location: ${matchedFile.lastKnownLocation}, Path: ${matchedFile.folderPath}). `;
    }
    if (relevantFacts.length > 0) {
      summary += `Found ${relevantFacts.length} learned fact(s): ${relevantFacts.map((f) => `[${f.key}: ${f.value}]`).join('; ')}. `;
    }
    if (relevantInteractions.length > 0) {
      summary += `Found ${relevantInteractions.length} previous conversation turn(s) matching your query.`;
    }

    if (!hasResults) {
      summary = `No previous conversation or memory found matching "${query}".`;
    }

    return {
      found: hasResults,
      file: matchedFile,
      relevantInteractions,
      relevantFacts,
      summary: summary.trim(),
    };
  }

  /**
   * Retrieves a file directly using cross-session memory
   */
  retrieveFile(fileNameOrQuery: string): {
    success: boolean;
    file?: StoredFileMemory;
    location: string;
    message: string;
    actionPayload: any;
  } {
    const searchRes = this.searchInteractionMemory(fileNameOrQuery);

    if (searchRes.found && searchRes.file) {
      const file = searchRes.file;
      return {
        success: true,
        file,
        location: file.lastKnownLocation,
        message: `Maine previous chat interactions se check kiya—tera "${file.originalName}" ${file.lastKnownLocation} mein saved hai! Main abhi isko direct retrieve karke open kar rahi hoon bina full path mange.`,
        actionPayload: {
          fileId: file.id,
          fileName: file.originalName,
          category: file.category,
          path: file.folderPath,
          location: file.lastKnownLocation,
          app: file.appSource,
          mimeType: file.mimeType,
          previewSnippet: file.contentSnippet,
        },
      };
    }

    return {
      success: false,
      location: 'Unknown',
      message: `Memory database mein "${fileNameOrQuery}" ki previous location nahi mili. Please specify folder ya Google Files check kar na.`,
      actionPayload: null,
    };
  }

  /**
   * Compact summary of learned knowledge to seed prompts
   */
  getMemoryDigest(): string {
    const factLines = this.facts.slice(0, 10).map((f) => `- ${f.key}: ${f.value}`);
    const recentTurns = this.interactions.slice(-6).map((t) => `[${t.type === 'speech_log' ? 'Voice' : 'Chat'} ${t.role.toUpperCase()}]: ${t.text}`);

    return [
      'LEARNED FACTS & USER PREFERENCES:',
      factLines.length > 0 ? factLines.join('\n') : '- No explicit custom facts yet.',
      '\nRECENT CONVERSATION TURNS FROM DATABASE:',
      recentTurns.length > 0 ? recentTurns.join('\n') : '- No previous conversation turns.',
    ].join('\n');
  }

  getStats(): {
    interactionsCount: number;
    speechLogsCount: number;
    chatCount: number;
    factsCount: number;
    filesCount: number;
  } {
    const speechLogsCount = this.interactions.filter((i) => i.type === 'speech_log').length;
    const chatCount = this.interactions.filter((i) => i.type === 'chat').length;

    return {
      interactionsCount: this.interactions.length,
      speechLogsCount,
      chatCount,
      factsCount: this.facts.length,
      filesCount: this.files.length,
    };
  }

  getAllFiles(): StoredFileMemory[] {
    return [...this.files];
  }

  getAllInteractions(): StoredInteractionMemory[] {
    return [...this.interactions];
  }

  getAllFacts(): LearnedFact[] {
    return [...this.facts];
  }

  clearMemory(): void {
    this.files = [...DEFAULT_FILES];
    this.interactions = [...DEFAULT_INTERACTIONS];
    this.facts = [...DEFAULT_FACTS];
    this.saveFiles();
    this.saveInteractions();
    this.saveFacts();
    this.triggerServerSync();
  }
}

// Global Singleton for easy app-wide access
export const crossSessionMemory = new CrossSessionMemoryEngine();
