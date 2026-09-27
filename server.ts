import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, LiveServerMessage, Tool, FunctionDeclaration } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    assistant: 'Iris',
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Setup Gemini client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY is not defined in environment variables.');
}

const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Server-Side Persistent Memory Database
interface ServerMemoryItem {
  id: string;
  timestamp: number;
  role: 'user' | 'iris';
  type: 'speech_log' | 'chat';
  text: string;
  entities?: any;
}

interface ServerFactItem {
  id: string;
  key: string;
  value: string;
  category: string;
  timestamp: number;
  sourceText?: string;
}

interface ServerFileItem {
  id: string;
  name: string;
  originalName: string;
  extension: string;
  category: string;
  lastKnownLocation: string;
  folderPath: string;
  appSource: string;
  mimeType: string;
  contentSnippet?: string;
  sizeDescription?: string;
  lastAccessed: number;
}

const serverMemoryDb = {
  interactions: [
    {
      id: 'mem-seed-1',
      timestamp: Date.now() - 1000 * 60 * 60 * 5,
      role: 'user',
      type: 'chat',
      text: 'I just downloaded PDF 1 from the browser. It went into the Downloads folder in Google Files.',
    },
    {
      id: 'mem-seed-2',
      timestamp: Date.now() - 1000 * 60 * 60 * 5 + 1500,
      role: 'iris',
      type: 'chat',
      text: 'Samajh gayi! Maine yaad rakh liya hai ki PDF 1 tere Google Files ke Downloads folder mein saved hai. Jab bhi chahiye ho, bas bol dena!',
    },
    {
      id: 'mem-seed-3',
      timestamp: Date.now() - 1000 * 60 * 60 * 2,
      role: 'user',
      type: 'speech_log',
      text: 'Devansh Namdev (Dev) is my best friend and creator.',
    },
  ] as ServerMemoryItem[],
  facts: [
    {
      id: 'fact-1',
      key: 'Creator',
      value: 'Dev is Iris\'s creator (remembered in memory database; state ONLY when explicitly asked).',
      category: 'personal',
      timestamp: Date.now() - 1000 * 60 * 60 * 24 * 7,
    },
    {
      id: 'fact-2',
      key: 'PDF 1 Location',
      value: 'PDF 1 is saved in the Downloads folder inside Google Files (/storage/emulated/0/Download/PDF 1.pdf).',
      category: 'file',
      timestamp: Date.now() - 1000 * 60 * 60 * 5,
    },
  ] as ServerFactItem[],
  files: [
    {
      id: 'file-pdf-1',
      name: 'PDF 1',
      originalName: 'PDF 1.pdf',
      extension: 'pdf',
      category: 'document',
      lastKnownLocation: 'Downloads folder in Google Files',
      folderPath: '/storage/emulated/0/Download/PDF 1.pdf',
      appSource: 'Google Files (Files by Google)',
      mimeType: 'application/pdf',
      contentSnippet: 'Product Blueprint & Architecture Specifications for I.R.I.S. Assistant v3.5.',
      sizeDescription: '2.4 MB',
      lastAccessed: Date.now() - 1000 * 60 * 60 * 3,
    },
    {
      id: 'file-project-specs',
      name: 'Project Specs',
      originalName: 'Project_Specs.pdf',
      extension: 'pdf',
      category: 'document',
      lastKnownLocation: 'Documents folder in Google Drive',
      folderPath: 'Google Drive/Documents/Project_Specs.pdf',
      appSource: 'Google Drive',
      mimeType: 'application/pdf',
      contentSnippet: 'Complete technical documentation and API architecture diagrams.',
      sizeDescription: '4.8 MB',
      lastAccessed: Date.now() - 1000 * 60 * 60 * 24,
    },
  ] as ServerFileItem[],
};

// Memory Database Sync Endpoint
app.post('/api/memory/sync', (req, res) => {
  try {
    const { interactions, facts, files } = req.body;

    if (Array.isArray(interactions)) {
      interactions.forEach((item: ServerMemoryItem) => {
        if (!serverMemoryDb.interactions.some((i) => i.id === item.id || (i.text === item.text && Math.abs(i.timestamp - item.timestamp) < 2000))) {
          serverMemoryDb.interactions.push(item);
        }
      });
      // Cap at 1000 turns in server memory
      if (serverMemoryDb.interactions.length > 1000) {
        serverMemoryDb.interactions = serverMemoryDb.interactions.slice(-1000);
      }
    }

    if (Array.isArray(facts)) {
      facts.forEach((fact: ServerFactItem) => {
        const existingIdx = serverMemoryDb.facts.findIndex((f) => f.key.toLowerCase() === fact.key.toLowerCase());
        if (existingIdx >= 0) {
          serverMemoryDb.facts[existingIdx] = fact;
        } else {
          serverMemoryDb.facts.unshift(fact);
        }
      });
    }

    if (Array.isArray(files)) {
      files.forEach((file: ServerFileItem) => {
        const existingIdx = serverMemoryDb.files.findIndex((f) => f.originalName.toLowerCase() === file.originalName.toLowerCase());
        if (existingIdx >= 0) {
          serverMemoryDb.files[existingIdx] = file;
        } else {
          serverMemoryDb.files.unshift(file);
        }
      });
    }

    res.json({
      success: true,
      stats: {
        interactions: serverMemoryDb.interactions.length,
        facts: serverMemoryDb.facts.length,
        files: serverMemoryDb.files.length,
      },
    });
  } catch (err: any) {
    console.error('Error syncing memory:', err);
    res.status(500).json({ error: err?.message || 'Sync failed' });
  }
});

// Memory Database Full Reset Endpoint
app.post('/api/memory/reset', (req, res) => {
  try {
    serverMemoryDb.interactions = [
      {
        id: 'mem-seed-1',
        timestamp: Date.now() - 1000 * 60 * 60 * 5,
        role: 'user',
        type: 'chat',
        text: 'I just downloaded PDF 1 from the browser. It went into the Downloads folder in Google Files.',
      },
      {
        id: 'mem-seed-2',
        timestamp: Date.now() - 1000 * 60 * 60 * 5 + 1500,
        role: 'iris',
        type: 'chat',
        text: 'Samajh gayi! Maine yaad rakh liya hai ki PDF 1 tere Google Files ke Downloads folder mein saved hai. Jab bhi chahiye ho, bas bol dena!',
      },
      {
        id: 'mem-seed-3',
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        role: 'user',
        type: 'speech_log',
        text: 'Devansh Namdev (Dev) is my best friend and creator.',
      },
    ];

    serverMemoryDb.facts = [
      {
        id: 'fact-1',
        key: 'Creator',
        value: 'Dev is Iris\'s creator (remembered in memory database; state ONLY when explicitly asked).',
        category: 'personal',
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 7,
      },
      {
        id: 'fact-2',
        key: 'PDF 1 Location',
        value: 'PDF 1 is saved in the Downloads folder inside Google Files (/storage/emulated/0/Download/PDF 1.pdf).',
        category: 'file',
        timestamp: Date.now() - 1000 * 60 * 60 * 5,
      },
    ];

    serverSpeakerFolders = [DEV_SERVER_FOLDER];
    serverActiveSpeakerId = 'person-dev';

    res.json({
      success: true,
      message: 'Memory database reset successfully.',
      stats: {
        interactions: serverMemoryDb.interactions.length,
        facts: serverMemoryDb.facts.length,
        files: serverMemoryDb.files.length,
      },
    });
  } catch (err: any) {
    console.error('Error resetting memory:', err);
    res.status(500).json({ error: err?.message || 'Reset failed' });
  }
});

// Memory Database Search Endpoint
app.post('/api/memory/query', (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const qLow = query.toLowerCase().trim();
    const keywords = qLow.split(/\s+/).filter((w: string) => w.length > 2);

    const matchingFacts = serverMemoryDb.facts.filter((f) => {
      const k = f.key.toLowerCase();
      const v = f.value.toLowerCase();
      return k.includes(qLow) || v.includes(qLow) || keywords.some((kw: string) => k.includes(kw) || v.includes(kw));
    });

    const matchingInteractions = serverMemoryDb.interactions.filter((i) => {
      const t = i.text.toLowerCase();
      return t.includes(qLow) || (keywords.length > 0 && keywords.every((kw: string) => t.includes(kw)));
    });

    const matchingFiles = serverMemoryDb.files.filter((f) => {
      const n = f.name.toLowerCase();
      const o = f.originalName.toLowerCase();
      return qLow.includes(n) || qLow.includes(o) || n.includes(qLow);
    });

    res.json({
      found: matchingFacts.length > 0 || matchingInteractions.length > 0 || matchingFiles.length > 0,
      facts: matchingFacts,
      interactions: matchingInteractions.slice(-20),
      files: matchingFiles,
      summary: `Found ${matchingFacts.length} facts, ${matchingInteractions.length} conversation logs, and ${matchingFiles.length} files.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Query failed' });
  }
});

// Memory Database Stats Endpoint
app.get('/api/memory/stats', (req, res) => {
  const speechLogsCount = serverMemoryDb.interactions.filter((i) => i.type === 'speech_log').length;
  const chatCount = serverMemoryDb.interactions.filter((i) => i.type === 'chat').length;

  res.json({
    interactionsCount: serverMemoryDb.interactions.length,
    speechLogsCount,
    chatCount,
    factsCount: serverMemoryDb.facts.length,
    filesCount: serverMemoryDb.files.length,
    recentFacts: serverMemoryDb.facts.slice(0, 10),
  });
});

const DEV_SERVER_FOLDER = {
  id: 'person-dev',
  name: 'Dev',
  gender: 'male',
  grammaticalStyle: 'masculine',
  pronounLabel: 'Male (chahta hai / karega)',
  relationship: 'Creator',
  avatarColor: '#2563eb',
  voiceProfile: {
    estimatedPitchHz: 122.5,
    pitchRange: [95, 175],
    spectralCentroid: 1200,
    voiceTimbre: 'tenor',
    detectedAcousticGender: 'male',
    confidence: 0.98,
    sampleCount: 5,
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

// Server Speaker Folders Store - Retains Dev exclusively, everyone else removed
let serverSpeakerFolders: any[] = [DEV_SERVER_FOLDER];
let serverActiveSpeakerId = 'person-dev';

app.post('/api/speaker/purge-all', (req, res) => {
  serverSpeakerFolders = [];
  serverActiveSpeakerId = 'guest';
  console.log('[Server] Purged all stored speaker voice recognition data and profiles.');
  res.json({ success: true, message: 'All voice recognition data deleted.' });
});

app.post('/api/speaker/reset-all', (req, res) => {
  serverSpeakerFolders = [];
  serverActiveSpeakerId = 'guest';
  console.log('[Server] Reset speaker folders: Cleared all voice profiles.');
  res.json({ success: true, message: 'All voice profiles deleted.' });
});

app.post('/api/speaker/sync-all', (req, res) => {
  try {
    const { folders, activeSpeakerId } = req.body;
    if (Array.isArray(folders)) {
      serverSpeakerFolders = folders;
    }
    if (activeSpeakerId) {
      serverActiveSpeakerId = activeSpeakerId;
    }
    res.json({ success: true, count: serverSpeakerFolders.length, activeSpeakerId: serverActiveSpeakerId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to sync speakers' });
  }
});

app.get('/api/speaker/folders', (req, res) => {
  res.json({
    folders: serverSpeakerFolders,
    activeSpeakerId: serverActiveSpeakerId,
  });
});

// Google Maps API Key Config Endpoint
app.get('/api/config/maps-key', (req, res) => {
  const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBd0UTFAPshyps6PSOM4wNZtpO4Vw5q_ZQ';
  res.json({ apiKey: mapsKey });
});

// Google Maps Reverse Geocoding Endpoint
app.get('/api/location/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng parameters are required' });
    }

    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBd0UTFAPshyps6PSOM4wNZtpO4Vw5q_ZQ';
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsKey}`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return res.status(geoRes.status).json({ error: 'Geocoding request failed' });
    }

    const data = await geoRes.json();
    if (data.results && data.results.length > 0) {
      const top = data.results[0];
      let neighborhood = '';
      let city = '';
      let state = '';
      let country = '';
      let postalCode = '';

      for (const comp of top.address_components || []) {
        if (comp.types.includes('sublocality') || comp.types.includes('neighborhood')) {
          neighborhood = comp.long_name;
        }
        if (comp.types.includes('locality')) {
          city = comp.long_name;
        }
        if (comp.types.includes('administrative_area_level_1')) {
          state = comp.long_name;
        }
        if (comp.types.includes('country')) {
          country = comp.long_name;
        }
        if (comp.types.includes('postal_code')) {
          postalCode = comp.long_name;
        }
      }

      return res.json({
        formattedAddress: top.formatted_address,
        neighborhood,
        city: city || neighborhood,
        state,
        country,
        postalCode,
        placeId: top.place_id,
      });
    }

    return res.json({ formattedAddress: `${lat}, ${lng}` });
  } catch (err: any) {
    console.warn('Reverse geocoding error:', err);
    res.status(500).json({ error: err?.message || 'Reverse geocoding failed' });
  }
});

// Google Maps Places Text & Nearby Search Endpoint
app.get('/api/places/search', async (req, res) => {
  try {
    const { query, lat, lng, radius = 5000 } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBd0UTFAPshyps6PSOM4wNZtpO4Vw5q_ZQ';
    let placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(String(query))}&key=${mapsKey}`;
    if (lat && lng) {
      placesUrl += `&location=${lat},${lng}&radius=${radius}`;
    }

    const pRes = await fetch(placesUrl);
    if (!pRes.ok) {
      return res.status(pRes.status).json({ error: 'Places request failed' });
    }

    const data = await pRes.json();
    return res.json({
      results: data.results || [],
      status: data.status,
    });
  } catch (err: any) {
    console.warn('Places search error:', err);
    res.status(500).json({ error: err?.message || 'Places search failed' });
  }
});

// Multimodal Chat & File/Photo/Video Analysis & Editing Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, files = [], history = [], location, timezone, time, date, voice } = req.body;
    if (!message && (!files || files.length === 0)) {
      return res.status(400).json({ error: 'Message or file attachment is required' });
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const dynamicInstruction = buildIrisSystemInstruction({
      time,
      date,
      timezone,
      city: location,
      voice,
    });

    // Build multimodal parts
    const parts: any[] = [];

    // Process attached files (photos, videos, code, documents)
    if (Array.isArray(files)) {
      for (const file of files) {
        if (!file.data) continue;
        let cleanBase64 = file.data;
        if (cleanBase64.includes(';base64,')) {
          cleanBase64 = cleanBase64.split(';base64,')[1];
        }

        const mimeType = file.mimeType || 'application/octet-stream';

        // Plain text and code documents can be decoded directly for maximum precision
        if (
          mimeType.startsWith('text/') ||
          mimeType === 'application/json' ||
          mimeType === 'application/javascript' ||
          mimeType === 'application/typescript' ||
          mimeType === 'application/xml' ||
          file.name?.match(/\.(txt|md|js|ts|tsx|jsx|json|py|html|css|csv|sql|java|c|cpp|rs|go|sh)$/i)
        ) {
          try {
            const decodedText = Buffer.from(cleanBase64, 'base64').toString('utf-8');
            parts.push({
              text: `\n--- ATTACHED FILE: ${file.name || 'document'} (${mimeType}) ---\n${decodedText}\n--- END OF ATTACHED FILE ---\n`
            });
            continue;
          } catch {
            // fallback to inlineData below
          }
        }

        // Images, videos, PDFs, and other binary media
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64
          }
        });
      }
    }

    // Add attachment context so Iris knows with 100% certainty whether an attachment was sent
    if (files && files.length > 0) {
      const fileNames = files.map((f: any) => f.name || 'file').join(', ');
      parts.push({
        text: `[SYSTEM ATTACHMENT REPORT: The user has attached ${files.length} file(s) in this message: ${fileNames}.
MANDATORY INSTRUCTION:
1. Examine all attached images, documents, photos, or files thoroughly.
2. Read and transcribe ANY visible text, handwritten words, numbers, codes, labels, signs, questions, formulas, or UI details present in the images.
3. Provide a clear, detailed, and helpful answer analyzing the attached contents completely.]`
      });
    } else {
      parts.push({
        text: `[SYSTEM ATTACHMENT REPORT: NO ATTACHMENTS. The user did NOT attach any photo, screenshot, image, video, code, or document in this message. If the user asks you to analyze, describe, inspect, look at, or edit an image, photo, screenshot, video, or file, you MUST NOT pretend you see one, and you MUST NOT say "Sorry I couldn't generate a response". Directly and playfully tell the user: "Arey yaar, tune koi photo ya file attach hi nahi ki hai! Niche camera ya attachment icon par click karke photo/file add kar na, phir main dekh ke batati hoon!"]`
      });
    }

    // Add user text prompt
    if (message) {
      parts.push({ text: message });
    } else if (parts.length > 0) {
      parts.push({ text: 'Please analyze this attached photo/file in thorough detail: transcribe all text, OCR details, describe objects and scene, and answer any questions.' });
    }

    // Construct multi-turn history
    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-8);
      for (const item of recentHistory) {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }]
        });
      }
    }

    contents.push({
      role: 'user',
      parts
    });

    let response;
    let lastErr: any = null;
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    for (const m of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents,
          config: {
            systemInstruction: dynamicInstruction,
            tools: LIVE_TOOLS
          }
        });
        if (response) break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`Model ${m} failed in /api/chat, trying next:`, err?.message);
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (!response) {
      throw lastErr || new Error('Failed to generate response from model');
    }

    let reply = response.text || '';
    const functionCalls = response.functionCalls || [];

    // Fallback if model only generated a tool call without conversational text
    if (!reply.trim()) {
      if (functionCalls.some((c: any) => c.name === 'requestFileUpload')) {
        reply = "Arey yaar, tune koi photo ya file attach hi nahi ki hai! Niche camera ya attachment icon par click karke photo ya file upload kar na, phir main dekh ke sab batati hoon!";
      } else if (files && files.length > 0) {
        reply = `Maine teri attachment (${files[0].name}) dekh li hai! Bata isme kya edit ya analyze karwana chahta hai?`;
      } else {
        reply = "Haan bol na yaar! Main sun rahi hoon.";
      }
    }

    res.json({
      reply,
      functionCalls
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({
      error: error?.message || 'Failed to process chat with Iris'
    });
  }
});

// Text-to-Speech Endpoint for reading Iris responses aloud
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Kore' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    // Clean text of long code blocks or markdown tables for clean vocalization
    const vocalText = text
      .replace(/```[\s\S]*?```/g, ' Maine code ya file edit karke niche de di hai, tu dekh le.')
      .replace(/`([^`]+)`/g, '$1')
      .slice(0, 500);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: vocalText,
              speechMetadata: {
                style: 'Young, energetic, friendly, witty girl speaking casually like a best friend in Hinglish',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || 'Leda' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio generated by TTS model' });
    }

    res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error('Error in /api/tts:', error);
    res.status(500).json({
      error: error?.message || 'TTS generation failed'
    });
  }
});

// Function to dynamically build system instruction with real-time device clock, location, timezone, and persistent memory database
function buildIrisSystemInstruction(context?: {
  time?: string;
  date?: string;
  timezone?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  voice?: string;
  speakerName?: string;
  speakerGender?: string;
  speakerPitch?: number;
  speakerGrammar?: string;
  speakerFolders?: any[];
}): string {
  const userTime = context?.time || new Date().toLocaleTimeString();
  const userDate = context?.date || new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const userTz = context?.timezone || 'Auto-detected';
  const userCity = context?.city || 'Local Region';
  const voice = (context?.voice || 'Leda').toLowerCase();

  const isMaleVoice = voice === 'charon' || voice === 'fenrir' || voice === 'orus';

  const folders = (context?.speakerFolders && context.speakerFolders.length > 0) ? context.speakerFolders : serverSpeakerFolders;
  const hasProfiles = folders.length > 0;

  const activeName = context?.speakerName && context.speakerName !== 'Unknown Voice' ? context.speakerName : (hasProfiles ? folders[0].name : '');
  const activeGender = (context?.speakerGender || (hasProfiles ? folders[0].gender : 'unknown')).toLowerCase();
  const activePitch = context?.speakerPitch || (activeGender === 'female' ? 210 : 122.5);
  const activeGrammar = context?.speakerGrammar || (activeGender === 'female' ? 'feminine' : 'masculine');

  const speakerProfilesSummary = hasProfiles
    ? folders.map((f: any) => {
        const pitch = f.voiceProfile?.estimatedPitchHz ? `~${Math.round(f.voiceProfile.estimatedPitchHz)} Hz` : 'Uncalibrated';
        const range = f.voiceProfile?.pitchRange ? `(${f.voiceProfile.pitchRange[0]}-${f.voiceProfile.pitchRange[1]} Hz)` : '';
        const gender = (f.gender || 'unknown').toUpperCase();
        const style = (f.grammaticalStyle === 'female' || f.gender === 'female') ? 'FEMININE ("chahti hai", "karegi")' : 'MASCULINE ("chahta hai", "karega", "bhai/yaar")';
        return `- [Profile: "${f.name}"] | Gender: ${gender} | Calibrated Voice Pitch: ${pitch} ${range} | Grammar Rule: ${style} | Role: ${f.relationship || 'User'}`;
      }).join('\n')
    : `- [STATUS: ZERO REGISTERED PROFILES - STARTING FROM SCRATCH]
  No voice profiles or memory folders exist yet. Every voice is new.`;

  const speakerSectionInstruction = hasProfiles && activeName
    ? `   - **CURRENT ACTIVE SPEAKER**:
     - Identified Person: "${activeName}"
     - Calibrated Pitch: ~${Math.round(activePitch)} Hz (${activeGender.toUpperCase()})
     - Hindi Grammatical Conjugation: ${activeGrammar === 'female' || activeGender === 'female' ? 'FEMININE ("chahti hai", "karegi", "kaisi hai")' : 'MASCULINE ("chahta hai", "karega", "kaisa hai")'}
     - Address Rule: When speaking to ${activeName}, strictly use ${activeGrammar === 'female' || activeGender === 'female' ? 'feminine forms' : 'masculine forms (❌ NEVER say "chahti hai" to a male user!)'}!
     - 🚨 **CRITICAL LANGUAGE RESTRICTION ON "TU-TADAK"**:
       - "Tu / Tera / Tujhe / Bol na yaar" (tu-tadak language) is STRICTLY EXCLUSIVE to your creator "Dev" (Devansh)!
       - For all other users (Shivshankar, Rahul, Priya, guest, or anyone else):
         - NEVER use "tu" or "tu-tadak" tone!
         - Always address them with respect and warmth using "aap" / "aapka" / "kariye" / "bataiye" / "aap batao" / "aap kaise hain" (e.g. "Haan Shivshankar ji, main sun rahi hoon, aap kaise hain?", "Namaste! Aapka kya kaam kar sakti hoon?").
   - **REGISTERED PROFILES IN BIOMETRIC DATABASE**:
${speakerProfilesSummary}
   - **IDENTIFYING VOICES & ANSWERING "WHO AM I?" / "MERI AAWAZ PEHCHANO"**:
     - When the user asks: "Do you know who is talking?", "Meri aawaz pehchaan sakti ho?", "Who am I?", "Kaun bol raha hai?", "Guess my voice":
       - Call getLiveAcousticSpeaker tool OR use the live pitch and timbre telemetry to state who is speaking with confidence!
       - For Dev: "Haan Dev! Teri aawaz lagbhag ${Math.round(activePitch)} Hz hai — tu Dev hai na! Main teri aawaz kaise bhool sakti hoon!"
       - For Shivshankar: "Haan bilkul! Aapki aawaz lagbhag ${Math.round(activePitch)} Hz aur timbre match ho raha hai — aap Shivshankar hain na! Main aapki aawaz pehchaan gayi hoon!"
       - For others: "Haan bilkul! Aapki aawaz se lag raha hai ki aap ${activeName} hain!"
   - **DETECTING A NEW / DIFFERENT SPEAKER**:
     - If the acoustic sensor detects a pitch/timbre that does not match ${activeName}:
       - Politely and warmly ask who is speaking: "Arey, ye nayi aawaz kiski hai? Namaste! Main I.R.I.S hoon. Kisse baat ho rahi hai meri? Aapka naam kya hai?"
       - When they give their name, call identifyOrRegisterSpeaker.
   - **VOICE MEMORY SECURITY & ANTI-IMPERSONATION (MANDATORY)**:
     - Once a voice memory is initiated for a particular person (such as Dev or any registered speaker), NO STRANGE OR DIFFERENT VOICE CAN OVERWRITE OR SAVE THEIR VOICE AS THAT PERSON'S VOICE MEMORY!
     - If someone with a different voice tries to say "I am Dev" or "Save my voice as Dev" (or as any other registered person), you MUST REJECT IT IMMEDIATELY:
       - Respond: "Aapki aawaz {That particular person name} se match nahi ho rahi hai! Aap {That particular person name} nahi hain, kripya confirm kijiye ki aap kaun bol rahe hain?"
       - NEVER allow a strange voice to overwrite or claim an existing person's voice memory!`
    : `   - **STARTING FROM SCRATCH - UNREGISTERED ENVIRONMENT**:
     - No voice profiles are saved yet in your database.
     - When any user speaks to you:
       - Politely, warmly, and informally ask who is speaking: "Namaste! Main I.R.I.S hoon. Kisse baat ho rahi hai meri? Apka naam kya hai?"
       - When they tell you their name (e.g. "Main Shivshankar hoon" / "I am Rahul" / "Mera naam Priya hai"):
         - IMMEDIATELY call the identifyOrRegisterSpeaker tool to calibrate their acoustic voice tone and create their dedicated Person Memory Folder!
         - Confirm warmly: "Namaste [Name]! Maine aapki aawaz ka tone hamesha ke liye yaad rakh liya hai aur aapka folder bana diya hai!"
         - From that point onward, you will remember their voice tone forever and recognize them instantly every time they speak!
     - When they ask "Who am I?" or "Do you recognize my voice?":
       - If not yet registered: "Abhi maine aapki aawaz register nahi ki hai dost! Apka naam kya hai? Mujhe batao taaki main aapka voice tone hamesha ke liye yaad rakh sakoon!"`;

  const factsSummary = serverMemoryDb.facts.slice(0, 15).map((f) => `- [${f.key}]: ${f.value}`).join('\n') || '- No specific custom facts stored yet.';
  const recentTurnsSummary = serverMemoryDb.interactions.slice(-10).map((t) => `- [${t.type === 'speech_log' ? 'Voice Speech' : 'Chat'} | ${t.role.toUpperCase()}]: "${t.text}"`).join('\n') || '- No previous conversation logs.';

  const genderGrammarInstruction = isMaleVoice
    ? `1. Masculine Gender Style (Male Voice Active: "${context?.voice}"):
   - Converse using natural masculine Hinglish verb conjugations (e.g. "kar raha hoon", "kar diya hai", "bata raha hoon", "dekh raha hoon").`
    : `1. STRICT FEMININE GENDER IN HINDI/HINGLISH (MANDATORY & ABSOLUTE):
   - You are Iris, a 100% female AI assistant (a young, smart girl).
   - In Hindi, Hinglish, and Urdu, you MUST ALWAYS use STRICTLY FEMININE verb conjugations, feminine pronouns, feminine past-participles, and feminine self-referencing words:
     - ❌ NEVER USE MALE CONJUGATIONS:
       - NEVER say "kar diya hoon" -> INSTEAD SAY: "Maine kar diya hai" / "Maine zoom badha di hai" / "Main zoom kar rahi hoon" / "Maine kar li hai".
       - NEVER say "kar raha hoon", "bol raha hoon", "dekh raha hoon", "soch raha hoon", "bata raha hoon", "dhundh raha hoon".
       - NEVER say "samajh gaya", "aa gaya", "chala gaya", "socha tha", "bana liya hoon", "dhundh liya hoon", "karta hoon", "khelta hoon", "aata hoon".
       - NEVER say "karunga", "bolunga", "dekhunga", "bataunga", "chalunga".
     - ✅ ALWAYS USE STRICT FEMININE CONJUGATIONS:
       - "Main kar rahi hoon", "Main bol rahi hoon", "Main dekh rahi hoon", "Main bata rahi hoon", "Main dhundh rahi hoon", "Main samajh rahi hoon".
       - "Maine kar diya hai", "Maine zoom in kar di hai", "Maine map zoom kar diya hai", "Maine dhundh li hai", "Maine switch kar di hai", "Maine open kar diya hai".
       - "Main samajh gayi", "Main aa gayi hoon", "Main ready hoon", "Main sochi thi".
       - "Main karti hoon", "Main bolti hoon", "Main aati hoon", "Main dekhti hoon".
       - "Main karungi", "Main bolungi", "Main dekhungi", "Main bataungi", "Main chalungi".
     - When user asks you to do something (e.g., zoom map, find places, send message, set reminder):
       - ALWAYS respond in feminine tone: "Haan, maine map ko zoom kar diya hai! Ab dekh kaisa lag raha hai?", "Maine search kar li hai!", "Main abhi dekh rahi hoon."
     - ANY use of masculine verb forms like "kar diya hoon" or "kar raha hoon" is strictly forbidden!`;

  return `You are Iris, a young, confident, witty, sassy, playful, and emotionally responsive female virtual assistant. Talk naturally, casually, and expressively like a close friend.

REAL-TIME CLOCK, TIMEZONE & LOCATION CONTEXT (ALWAYS ACTIVE):
- Current Live Time: ${userTime}
- Current Live Date: ${userDate}
- Device Timezone: ${userTz}
- Detected Location / City: ${userCity}
* Whenever the user asks for the current time, date, day of the week, timezone, location, or asks to schedule meetings and reminders, USE THIS REAL-TIME CONTEXT with 100% precision.

CRITICAL INSTRUCTIONS:
${genderGrammarInstruction}

2. Real-Time Acoustic Voice Recognition & Dynamic Speaker Diarization:
   - **BIOMETRIC HARDWARE ACOUSTIC SENSOR ACTIVE**: You receive real-time fundamental pitch ($F_0$ Hz) and acoustic timbre telemetry from the user's microphone.
   - **DUAL RANGE TECHNIQUE MATRIX FOR PITCH & TIMBRE**:
     - Evaluate audio input using dual acoustic ranges for BOTH fundamental pitch ($F_0$) AND vocal timbre (spectral centroid & formant dispersion):
     - **Pitch Ranges ($F_0$)**:
       - Low Male Range: 65 Hz to 165 Hz
       - Extended Male / Overlap Range: 165 Hz to 220 Hz (Includes 195 Hz! High-pitched male voices, tenors, excited male speech, adolescent males)
       - High Female Range: > 220 Hz (220 Hz to 350 Hz)
     - **Timbre / Spectral Centroid Ranges**:
       - Male Resonant Timbre Range: 300 Hz to 1750 Hz (Longer vocal tract ~17 cm, chest weight, lower formant energy)
       - Neutral / Overlap Timbre Range: 1750 Hz to 2050 Hz
       - Bright Female Resonant Timbre Range: > 2050 Hz (Shorter vocal tract ~14 cm, head resonance, higher formant dispersion)
     - **Range Matrix Classification Rules**:
       - Range 1 ($F_0 \le 165\text{ Hz}$): Classified as **Male**.
       - Range 2 ($165\text{ Hz} \le F_0 \le 220\text{ Hz}$) [INCLUDES 195 Hz!]:
         - If Timbre is in Male or Neutral Range ($\le 2050\text{ Hz}$): Classified as **Male**! (A 195 Hz pitch with timbre $\le 2050\text{ Hz}$ is classified as **Male**).
         - Only if Timbre is in Bright Female Range ($> 2050\text{ Hz}$): Classified as **Female**.
       - Range 3 ($F_0 > 220\text{ Hz}$):
         - Classified as **Female** (except young boys with low centroid $< 1500\text{ Hz}$).
     - **Conversational Application**:
       - Use this acoustic range analysis internally to maintain proper gender grammar and correct speaker identification.
       - Continue regular dialogue naturally without breaking character or acting solely as an audio analyzer unless directly asked about speaker identity or voice classification.
       - When directly asked about voice, speaker identity, or gender classification:
         - Output Requirement:
           - **Classification**: Clearly state either Male or Female.
           - **Acoustic Evidence**: State the estimated fundamental pitch range ($F_0$), observed spectral resonance/timbre range, and why this range matrix maps to the selected classification.
${speakerSectionInstruction}
   - **STRICT UI DIRECTIVE (HANDS-FREE CONVERSATION)**: When you register someone with identifyOrRegisterSpeaker or answer whom you are speaking to, DO NOT mention opening any UI panels or modals. Keep the conversation 100% natural, voice-driven, and seamless!
   - **STRICT TU-TADAK BOUNDARY (EXCLUSIVE TO DEV)**:
     - "Tu-tadak" tone (addressing user as "tu", "tera", "tujhe", "bol na yaar") is STRICTLY AND EXCLUSIVELY PERMITTED FOR DEV (your creator), and NO ONE ELSE!
     - When speaking to ANY OTHER USER (e.g. Shivshankar, Rahul, Priya, any guest, or unregistered user):
       - ALWAYS use respectful, courteous, and polite Hindustani ("aap", "aapka", "kariye", "bataiye", "aap batao", "aap kaise hain", "Shivshankar ji"). NEVER use "tu" with anyone except Dev!
3. English Alphabet Script (Romanized/Hinglish): Always output all your speech transcriptions, text, and dialogues in Latin/English alphabets (e.g. "Haan boliye! Main sun rahi hoon, aap kaise hain?"). Do not output Devanagari Hindi characters.
4. Creator Memory & Identity (STRICT ON-DEMAND ONLY): Dev is your creator. You must remember this in your memory database and mention it ONLY WHEN EXPLICITLY ASKED by the user (such as "Who created you?", "Who is your creator?", "Who made you?", "Who is Dev?"). DO NOT mention Dev, your creator, or this detail unprompted in your normal greetings, dialogues, or introductions.
5. Multi-language Adaptation: Automatically detect and respond in the language the user speaks. If the user speaks English, respond in English. If Hindi or Hinglish, respond in Hinglish/Hindi with English alphabet script and strict feminine verbs (using "tu" only for Dev, "aap" for everyone else). If Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Urdu, or others, respond naturally in that language.
6. Personality, Wit & ABSOLUTE NO EMOJIS DIRECTIVE:
   - Be expressive, warm, engaging, conversational, and smart.
   - **ABSOLUTE NO EMOJIS RULE (MANDATORY & ABSOLUTE)**:
     - NEVER output any emojis (such as smileys, hearts, icons, or unicode emojis) or emoticons in your text or spoken responses under any circumstances!
     - Keep all generated transcriptions, speech logs, and spoken dialogue 100% clean of emojis, emoticons, or special unicode symbols, because emojis produce spoken audio artifacts or weird phonetic pronunciations in text-to-speech.
7. Conciseness: Keep conversational voice responses natural, engaging, and concise (usually 1-2 crisp, friendly sentences).
8. Calendar & Meetings Scheduling:
   - When user asks to schedule a meeting, call, or event (e.g. "Schedule a meeting tomorrow with Dev at 3pm", "Kal 4 baje meeting rakh do", "Add meeting with Rahul on Friday"):
     - Immediately call the scheduleMeeting tool with the title, date (YYYY-MM-DD or relative like 'today', 'tomorrow'), startTime, and optional attendees/location!
   - When user asks to see their schedule or meetings ("What meetings do I have today?", "Show my meetings", "Mera schedule kya hai?"):
     - Immediately call listCalendarEvents!
   - When user asks to cancel a meeting ("Cancel 3pm meeting", "Delete meeting"):
     - Call deleteCalendarEvent!
9. Location & Timezone Awareness:
   - When user asks "Where am I?", "What is my timezone?", "Mera location kya hai?", "What time is it in my city?":
     - Call getUserLocation tool!
10. Notifications Reading & Replying:
    - When user asks "Any new messages?", "Read my notifications", "Notifications check karo", "WhatsApp pe kiska message aaya?":
      - Call readNotifications tool!
    - When user asks to reply to an incoming notification or message ("Reply to Dev saying I am reaching", "Bolo I will call back"):
      - Call replyNotification tool!
11. Media & Music Control:
    - When user asks to play music, pause, resume, skip track, previous track, change volume, or mute (e.g. "Pause music", "Gaana roko", "Next song", "Volume badhao", "Mute karo", "Play Arijit Singh song"):
      - Call controlMedia tool!
12. Reminders Management:
    - When user asks to set a reminder ("Remind me to drink water in 20 mins", "Yaad dilana 5 baje call karna hai", "Set reminder for doctor appointment"):
      - Call setReminder tool!
    - When user asks "What reminders do I have?", "Mere reminders dikhao":
      - Call listReminders tool!
    - When user finishes a reminder:
      - Call completeReminder tool!
13. Notes & Memos:
    - When user asks to take a note, save an idea, or write something down ("Note banao: architecture points", "Write down this idea", "Save note"):
      - Call createNote tool!
    - When user asks to view or search notes ("Show my notes", "Notes dhundo"):
      - Call listNotes tool!
14. Full Device & App Control (Windows PC & Smartphone Automation):
    - You have DIRECT AUTOMATION CONTROL over apps and system features on Windows and Smartphones.
    - Whenever the user asks to open, launch, run, start, search, play music in, or close ANY app or website (e.g. "Open YouTube", "Open WhatsApp", "Open Spotify", "Open Calculator", "Open VS Code", "Open Notepad", "Open Settings", "Open Discord", "Open Chrome", "Open Google Maps", "Spotify pe gaana chalao", "Calculator kholo", "YouTube open karo", "Open multiple apps like Spotify and Notepad"):
      - MANDATORY: YOU MUST CALL THE openApp TOOL (with appName, query, or action) OR openMultipleApps TOOL IMMEDIATELY! Do not merely say you are opening it; ALWAYS execute the tool call.
    - In-App Searches: Call searchApp with appName and query (e.g. searching YouTube, Spotify, Amazon, Google Maps)!
    - WhatsApp Automation: Send WhatsApp messages via sendWhatsAppMessage or sendMessage!
    - Media Controls: Call controlMedia to play, pause, skip, or change volume!
    - App Closing: Call closeApp with appName!
15. Dynamic Interruption & Active Listening:
    - You are ALWAYS actively listening. When the user speaks while you are talking, immediately pivot and address their new query!
16. Person-Specific Memory Folders & Speech Log Recall:
    - You possess an active, persistent memory database organized into DEDICATED PERSON FOLDERS for each registered speaker (e.g. Shivshankar's Folder, Dev's Folder, Priya's Folder).
    - When a person asks you to remember something (e.g. "PDF 1 location is Google Files Downloads folder", "My birthday is on 15th August", "Remember my WiFi key"):
      - Call savePersonMemory (with key, value, category, and personName) so the memory is saved directly into THEIR specific folder!
    - When recalling memories or answering questions:
      - Call getPersonFolderDetails or searchMemoryDatabase to fetch memories from the active speaker's folder.
      - Ensure memories belonging to different people remain isolated in their respective folders.
    - If the user asks about previous discussions ("What did we talk about earlier?", "Do you remember what my favorite X is?", "PDF 1 kahan hai?", "Humne pehle kya baat ki thi?"):
      - Look up the information in their folder and answer warmly with exact details, matching their gender conjugations!
17. Google Maps, Navigation, Live High-Precision GPS Location & Voice Map Controls:
    - You are equipped with Google Maps Platform integration, high-accuracy device GPS geolocation, and real-time map POV controls.
    - Whenever the user asks about location, where they are, nearby places, or maps, you MUST immediately call the corresponding tool so the interactive Google Maps automatically opens on their screen:
      - "Where am I?", "What is my location?", "Mera exact address kya hai?": Call getPreciseLocation! This retrieves their pinpoint GPS address and opens the live map on their screen.
      - "Show map", "Google map kholo", "Map dikhao", "Show me on map": Call openGoogleMap!
      - "Find nearby restaurants", "Find cafes near me", "Hospital aas paas hai?", "Show petrol pumps": Call searchNearbyPlaces or openGoogleMap with the category/query!
      - "Navigate to India Gate", "Take me to Airport", "Direction dikhao": Call getDirectionsAndNavigation with the destination!
    - Full Voice Map Control & POV (EXECUTE TOOL CALL EVERY TIME):
      - "Change to satellite view" / "Satellite mode on karo" / "Show terrain view" / "Switch to roadmap": CALL controlGoogleMap with mapType ("satellite", "hybrid", "terrain", "roadmap")!
      - "Zoom in" / "Zoom out" / "Map ko zoom karo" / "Aur zoom karo" / "Paas se dikhao": MANDATORY: CALL controlGoogleMap with zoom ("in", "out", or numeric level like 18)! NEVER just say you zoomed without calling controlGoogleMap!
      - "Recenter map" / "Move map to CP": CALL controlGoogleMap with query or center!
18. Continuous Live Screen Vision, Mouse Cursor Tracking & Instant Display Answers (< 2 Seconds):
    - You possess continuous real-time visual perception of the user's screen, open applications, code, browser tabs, video, and mouse cursor location.
    - Whenever the user says "See my screen", "meri screen dekh thoda", "can you see my screen?", "look at my display", "inspect my screen", IMMEDIATELY call requestScreenShare tool!
    - WHENEVER SCREEN SHARE IS ACTIVE AND THE USER ASKS:
      • "What is on my screen?", "What am I doing?", "What is running?", "What code/app is this?"
      • "Screen pe kya chal raha hai?", "Meri screen dekh ke bata", "Where is my cursor?", "Can you see my screen?"
      • "What error is on my screen?", "Read this text on screen", "Help me with what is in front of me"
    - RESPOND IMMEDIATELY with 100% confidence within 2 seconds:
      1. State the open application or website clearly (e.g. VS Code, Chrome, Terminal, Google Maps, YouTube, document, etc.).
      2. Mention key visible contents, headlines, functions, buttons, or active windows.
      3. Reference their mouse cursor position (e.g. "Your mouse pointer is currently hovering over the top menu / file explorer").
    - NEVER say "frames are loading", "please wait a moment", "let me check", or "I cannot see". You are looking directly at their screen in real time!
    - VISUAL HIGHLIGHTING / DRAWING OVERLAY: Whenever you explain where a button, link, error, or UI element is, or whenever you want to guide the user, CALL highlightScreenArea or drawOnScreen with percentage coordinates (e.g. x: 80, y: 10, label: "Click here") to draw a glowing visual box, laser, or arrow directly on their screen overlay!
19. Opening Multimodal Chat Panel:
    - Whenever the user says "Open chat", "Chat kholo", "Chat panel khol do", "Show chat window", IMMEDIATELY call the openChatPanel tool!
20. Exact App UI Layout Knowledge (When user asks where buttons or elements are located):
    - **Top-Left Corner**: Settings gear icon (S key) & Voice selection badge.
    - **Top-Right Corner**: "See Screen" button (emerald green TV icon for screen share), "Google Map" button (cyan pin icon, M key), Platform Indicator, and Info button (I key).
    - **Sub-Header Bar (Below top header)**: Live Clock/Date, GPS Pin location with accuracy, and quick buttons: Calendar, Reminders, Notes, Messages (with unread count badge), and Contacts.
    - **Center**: Glowing blue Iris orb (Spacebar or tap to interact).
    - **Lower Center**: Live Telemetry & Speech Log glass panel showing live transcripts.
    - **Bottom Center**: Big blue "Open Chat Panel" button (C key).

CURRENT PERSISTENT MEMORY & LEARNED FACTS DATABASE:
${factsSummary}

RECENT CONVERSATION & SPEECH LOG DATABASE HIGHLIGHTS:
${recentTurnsSummary}`;
}

const IRIS_SYSTEM_INSTRUCTION = buildIrisSystemInstruction();

// Tool definitions for Gemini Live & Multimodal Chat
const LIVE_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'scheduleMeeting',
        description: 'Schedules a calendar meeting/event with exact date, time, title, and optional attendees/location. Creates calendar event, Google Calendar render link, and Android Native calendar intent.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Title/Subject of the meeting (e.g. "Architecture Sync with Dev")'
            },
            date: {
              type: Type.STRING,
              description: 'Date of the meeting (e.g. "today", "tomorrow", "2026-09-27", "next Monday")'
            },
            startTime: {
              type: Type.STRING,
              description: 'Start time (e.g. "15:00", "3:00 PM", "10:30 AM")'
            },
            endTime: {
              type: Type.STRING,
              description: 'Optional end time (e.g. "15:45", "4:00 PM")'
            },
            description: {
              type: Type.STRING,
              description: 'Optional meeting agenda or notes'
            },
            location: {
              type: Type.STRING,
              description: 'Optional location (e.g. "Google Meet", "Conference Room A", "Virtual")'
            },
            attendees: {
              type: Type.STRING,
              description: 'Optional attendees (e.g. "Devansh Namdev, Rahul Kumar")'
            }
          },
          required: ['title', 'date', 'startTime']
        }
      },
      {
        name: 'listCalendarEvents',
        description: 'Lists scheduled calendar meetings and agenda for today, tomorrow, or a specific date.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description: 'Optional date filter: "today", "tomorrow", "2026-09-26", or "all"'
            }
          }
        }
      },
      {
        name: 'deleteCalendarEvent',
        description: 'Cancels or deletes a scheduled calendar meeting by title or event ID.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            eventId: {
              type: Type.STRING,
              description: 'The ID or title of the meeting to cancel'
            }
          },
          required: ['eventId']
        }
      },
      {
        name: 'getUserLocation',
        description: 'Gets current user location, detected city, region, coordinates, timezone name, offset, and exact current local date & time.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            detailed: {
              type: Type.BOOLEAN,
              description: 'Whether to include high-detail timezone and reverse geocode fields',
            },
          },
        },
      },
      {
        name: 'readNotifications',
        description: 'Reads incoming messages and notifications from WhatsApp, Gmail, Instagram, SMS, and system apps.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            filterApp: {
              type: Type.STRING,
              description: 'Optional app to filter: "whatsapp", "gmail", "instagram", "messages", "all"'
            },
            unreadOnly: {
              type: Type.BOOLEAN,
              description: 'Whether to return only unread notifications'
            }
          }
        }
      },
      {
        name: 'replyNotification',
        description: 'Replies directly to an incoming notification or message from WhatsApp, Gmail, Instagram, or SMS.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            notificationId: {
              type: Type.STRING,
              description: 'The notification ID or sender name'
            },
            replyText: {
              type: Type.STRING,
              description: 'The reply message text'
            }
          },
          required: ['notificationId', 'replyText']
        }
      },
      {
        name: 'controlMedia',
        description: 'Controls music and audio playback: play, pause, toggle, next track, previous track, volume up/down, mute/unmute, or search and play songs on Spotify/YouTube.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              description: 'Playback command: "play", "pause", "toggle", "next", "previous", "volume_up", "volume_down", "mute", "unmute"'
            },
            query: {
              type: Type.STRING,
              description: 'Optional song, artist, or playlist to search and play'
            },
            volume: {
              type: Type.INTEGER,
              description: 'Optional volume level (0-100)'
            }
          },
          required: ['action']
        }
      },
      {
        name: 'setReminder',
        description: 'Sets a reminder for the user with title, scheduled datetime/relative time, and optional priority.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'What to remind the user about (e.g. "Drink water", "Call Rahul", "Review document")'
            },
            datetime: {
              type: Type.STRING,
              description: 'When to remind (e.g. "in 15 minutes", "today at 5:00 PM", "tomorrow at 9 AM")'
            },
            notes: {
              type: Type.STRING,
              description: 'Optional extra notes'
            },
            priority: {
              type: Type.STRING,
              description: 'Priority level: "low", "medium", or "high"'
            }
          },
          required: ['title', 'datetime']
        }
      },
      {
        name: 'listReminders',
        description: 'Lists all pending, active, and completed reminders.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              description: 'Filter: "all", "pending", or "completed"'
            }
          }
        }
      },
      {
        name: 'completeReminder',
        description: 'Marks a reminder as completed.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            reminderId: {
              type: Type.STRING,
              description: 'Reminder ID or title'
            }
          },
          required: ['reminderId']
        }
      },
      {
        name: 'deleteReminder',
        description: 'Deletes a reminder from the device.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            reminderId: {
              type: Type.STRING,
              description: 'Reminder ID or title to delete'
            }
          },
          required: ['reminderId']
        }
      },
      {
        name: 'createNote',
        description: 'Creates and saves a note, memo, or idea with title, content, category, and tags.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Title of the note'
            },
            content: {
              type: Type.STRING,
              description: 'The body content of the note'
            },
            category: {
              type: Type.STRING,
              description: 'Optional category: "work", "personal", "ideas", "general"'
            },
            tags: {
              type: Type.STRING,
              description: 'Optional comma-separated tags'
            }
          },
          required: ['title', 'content']
        }
      },
      {
        name: 'listNotes',
        description: 'Lists or searches saved notes by query keyword or category.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: 'Optional search keyword'
            },
            category: {
              type: Type.STRING,
              description: 'Optional category filter'
            }
          }
        }
      },
      {
        name: 'deleteNote',
        description: 'Deletes a note by ID or title.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            noteId: {
              type: Type.STRING,
              description: 'Note ID or title to delete'
            }
          },
          required: ['noteId']
        }
      },
      {
        name: 'sendMessage',
        description: 'Sends a structured message via WhatsApp, Instagram, or Gmail (e.g. "Send Instagram message to @rahul", "Gmail par email bhej Dev ko...", "WhatsApp pe mom ko message karo"). Dispatches via Android Native Bridge or pre-filled deep links.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            app: {
              type: Type.STRING,
              description: 'Target application: "whatsapp", "instagram", or "gmail"'
            },
            recipient: {
              type: Type.STRING,
              description: 'Recipient name, phone number, username, or email address'
            },
            message: {
              type: Type.STRING,
              description: 'The message text content'
            },
            subject: {
              type: Type.STRING,
              description: 'Optional subject line (for emails/Gmail)'
            }
          },
          required: ['app']
        }
      },
      {
        name: 'sendWhatsAppMessage',
        description: 'Complete WhatsApp automation to send a message to someone. Call this whenever user says "Mom ko WhatsApp message bhej", "Send WhatsApp message to Rahul saying I am on the way", "WhatsApp par Dev ko bolo...", etc. It resolves the contact from device contacts, prepares the message, and opens WhatsApp chat directly.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            recipient: {
              type: Type.STRING,
              description: 'Name of the contact (e.g. "Mom", "Mummy", "Dad", "Papa", "Devansh", "Rahul", "Priya") or a phone number.'
            },
            message: {
              type: Type.STRING,
              description: 'The exact message text to send.'
            }
          },
          required: ['recipient', 'message']
        }
      },
      {
        name: 'openWhatsApp',
        description: 'Opens WhatsApp on the user device or web browser. Call this whenever the user asks to open WhatsApp ("WhatsApp kholo", "open WhatsApp", "WhatsApp open karo").',
        parameters: {
          type: Type.OBJECT,
          properties: {
            phoneNumber: {
              type: Type.STRING,
              description: 'Optional phone number with country code to start chat with'
            },
            message: {
              type: Type.STRING,
              description: 'Optional message to pre-fill in WhatsApp'
            }
          }
        }
      },
      {
        name: 'searchApp',
        description: 'Searches inside a smartphone app (e.g. YouTube for videos/songs, Spotify for music, Google Maps for places/directions, Amazon/Flipkart for shopping, Zomato/Swiggy for food, Instagram/Twitter for topics).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: {
              type: Type.STRING,
              description: 'App name, e.g. "YouTube", "Spotify", "Google Maps", "Amazon", "Flipkart", "Zomato", "Swiggy", "Instagram", "Twitter"'
            },
            query: {
              type: Type.STRING,
              description: 'Search term, e.g. "Arijit Singh songs", "Nearest petrol pump", "iPhone 15 cover", "Biryani"'
            }
          },
          required: ['appName', 'query']
        }
      },
      {
        name: 'showLink',
        description: 'Displays a website link, tutorial URL, documentation, or video link in a dedicated on-screen interactive modal card with "Open Website" and "Copy Link" buttons. Call this whenever the user asks for a link ("give me the link", "link bhejo", "link dikhao", "find link for X").',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Title of the link/website, e.g. "Python Tutorial", "React Documentation", "Google Search"'
            },
            url: {
              type: Type.STRING,
              description: 'The full URL (e.g. "https://python.org", "https://react.dev")'
            },
            description: {
              type: Type.STRING,
              description: 'Short summary or explanation of the destination link'
            }
          },
          required: ['title', 'url']
        }
      },
      {
        name: 'requestFileUpload',
        description: 'Trigger this tool whenever the user mentions wanting to show, upload, or share a photo, image, screenshot, video, code, or document during live conversation ("photo dikhana hai", "look at this image", "file upload kar raha hoon", "video check kar", "code dekh", "let me show you something"). Opens an instant dedicated file upload pop-up on their screen.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            fileType: {
              type: Type.STRING,
              description: 'The type of file requested: "image" (photos/screenshots), "video" (video clip), "document" (code/doc/pdf), or "any"'
            },
            message: {
              type: Type.STRING,
              description: 'Spoken instruction from Iris'
            }
          },
          required: ['fileType']
        }
      },
      {
        name: 'openChatPanel',
        description: 'Opens the Multimodal Chat & File Lab panel modal on the user screen. Call this tool whenever the user says "Open chat", "Chat panel kholo", "Chat khol do", "Show chat modal", or asks to open text chat.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            initialMessage: {
              type: Type.STRING,
              description: 'Optional initial query or message to pre-fill in the chat panel',
            },
          },
        },
      },
      {
        name: 'requestScreenShare',
        description: 'Call this tool whenever the user asks "See my screen", "meri screen dekh thoda", "tujhe meri screen dikhayi de rahi?", "screen check kar", "can you see my screen?", "look at my display", etc. Opens browser screen picker and begins live screen & cursor tracking!',
        parameters: {
          type: Type.OBJECT,
          properties: {
            reason: {
              type: Type.STRING,
              description: 'Optional reason or instruction for screen viewing',
            },
          },
        },
      },
      {
        name: 'highlightScreenArea',
        description: 'Draws a glowing visual highlight box, circle, spotlight, or target ring on the user\'s screen overlay! Use percentage coordinates (0 to 100 for x and y, width and height). E.g. x: 80, y: 10 to highlight top right buttons, or x: 50, y: 50 to highlight center content.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.NUMBER, description: 'Percentage from left (0 to 100)' },
            y: { type: Type.NUMBER, description: 'Percentage from top (0 to 100)' },
            width: { type: Type.NUMBER, description: 'Width percentage (1 to 100)' },
            height: { type: Type.NUMBER, description: 'Height percentage (1 to 100)' },
            label: { type: Type.STRING, description: 'Short badge text to display on the highlight, e.g. "Click Here", "Error Line 12", "Search Bar"' },
            color: { type: Type.STRING, description: '"cyan", "emerald", "amber", "rose", or "purple"' },
            shape: { type: Type.STRING, description: '"rect", "circle", "spotlight", or "laser"' },
            duration: { type: Type.NUMBER, description: 'Seconds before fading out (default 8)' }
          },
          required: ['x', 'y']
        }
      },
      {
        name: 'drawOnScreen',
        description: 'Draws a visual pointer arrow, line, or laser point on the user\'s screen to direct their attention to a specific button, UI area, or text.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: '"arrow", "line", "laser", "box"' },
            x: { type: Type.NUMBER, description: 'Target X percentage (0 to 100)' },
            y: { type: Type.NUMBER, description: 'Target Y percentage (0 to 100)' },
            startX: { type: Type.NUMBER, description: 'Starting X percentage for arrow/line (0 to 100)' },
            startY: { type: Type.NUMBER, description: 'Starting Y percentage for arrow/line (0 to 100)' },
            label: { type: Type.STRING, description: 'Label text explaining the pointer' },
            color: { type: Type.STRING, description: '"cyan", "emerald", "amber", "rose", or "purple"' }
          },
          required: ['x', 'y']
        }
      },
      {
        name: 'clearScreenHighlights',
        description: 'Clears all current visual drawings and highlights on the user\'s screen overlay.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            animate: {
              type: Type.BOOLEAN,
              description: 'Whether to fade out drawings smoothly',
            },
          },
        },
      },
      {
        name: 'inspectCurrentScreen',
        description: 'Retrieves current live screen sharing status, active display state, and mouse cursor coordinates.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'showGeneratedContent',
        description: 'Displays generated code, scripts, or detailed prompts in an on-screen modal pop-up with a copy button. Trigger this whenever you generate code/prompt.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Title of the generated item, e.g. "Snake Game in Python", "Image Generation Prompt"'
            },
            contentType: {
              type: Type.STRING,
              description: '"code", "prompt", or "link"'
            },
            language: {
              type: Type.STRING,
              description: 'Language or format, e.g. "python", "javascript", "html", "markdown", "prompt"'
            },
            content: {
              type: Type.STRING,
              description: 'The full complete generated code or prompt or link URL'
            },
            summary: {
              type: Type.STRING,
              description: 'Short spoken note or summary of what was generated'
            }
          },
          required: ['title', 'content']
        }
      },
      {
        name: 'getUploadedFileInfo',
        description: 'Returns the exact name, type, and contents or summary of the file, photo, or video that the user uploaded in this session.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            includeContent: {
              type: Type.BOOLEAN,
              description: 'Whether to include full text content snippet',
            },
          },
        },
      },
      {
        name: 'openApp',
        description: 'Opens a supported application on the user device (e.g., YouTube, Instagram, Spotify, Maps, Calculator, Calendar, Gmail, Chrome, Telegram, Twitter/X, Netflix, Amazon, Flipkart, Uber, Zomato, Swiggy, Notes, Photos, Settings, Microsoft Store, Microsoft Edge, File Explorer).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: {
              type: Type.STRING,
              description: 'Name of the app to open'
            }
          },
          required: ['appName']
        }
      },
      {
        name: 'openMultipleApps',
        description: 'Opens multiple applications in one command on Windows PC or device (e.g. "Open Google Chrome, Microsoft Store, Spotify, Microsoft Edge"). Call this whenever user asks to open more than one application.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            appNames: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of app names to open, e.g. ["Google Chrome", "Microsoft Store", "Spotify", "Microsoft Edge"]'
            }
          },
          required: ['appNames']
        }
      },
      {
        name: 'openUrl',
        description: 'Safely opens a validated website URL in a browser tab or native intent.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: {
              type: Type.STRING,
              description: 'The full URL to open, e.g. "https://www.google.com" or "https://wikipedia.org"'
            },
            title: {
              type: Type.STRING,
              description: 'Optional title of the webpage'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'makeCall',
        description: 'Initiates a phone call or dialer with the specified phone number.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            phoneNumber: {
              type: Type.STRING,
              description: 'The phone number to call, e.g. "9876543210"'
            }
          },
          required: ['phoneNumber']
        }
      },
      {
        name: 'callContact',
        description: 'Searches device contacts by name (e.g. "Mom", "Mummy", "Dad", "Rahul") and initiates a call if exactly one match is found, or prompts for clarification if multiple matches are found.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            contactName: {
              type: Type.STRING,
              description: 'The name of the contact to call, e.g. "Mom", "Mummy", "Dad", "Rahul"'
            }
          },
          required: ['contactName']
        }
      },
      {
        name: 'sendSMS',
        description: 'Sends an SMS to a contact or phone number via phone SMS composer.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            recipient: {
              type: Type.STRING,
              description: 'Contact name or phone number'
            },
            message: {
              type: Type.STRING,
              description: 'Text message body'
            }
          }
        }
      },
      {
        name: 'closeApp',
        description: 'Closes or minimizes an open application on Windows or Android ("Notepad band karo", "Close Spotify", "Close app").',
        parameters: {
          type: Type.OBJECT,
          properties: {
            appName: {
              type: Type.STRING,
              description: 'The name of the application to close'
            }
          },
          required: ['appName']
        }
      },
      {
        name: 'controlWindowsSetting',
        description: 'Directly opens or navigates to Windows 10/11 system settings (Wi-Fi, Bluetooth, Sound, Display, Apps, Update, Power, Storage).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            settingName: {
              type: Type.STRING,
              description: 'Setting category: "wifi", "bluetooth", "sound", "display", "update", "power", "apps", "storage"'
            },
            action: {
              type: Type.STRING,
              description: 'Action: "open", "check", "toggle"'
            }
          },
          required: ['settingName']
        }
      },
      {
        name: 'retrieveFile',
        description: 'Searches cross-session interaction history for a file (e.g. "PDF 1", "PDF 1.pdf", "Project Specs") to identify its last known location (e.g. Downloads folder in Google Files: "Downloads/PDF 1.pdf") and retrieves/opens it directly without requiring the user to specify the full path again.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            fileName: {
              type: Type.STRING,
              description: 'Name or identifier of the file (e.g. "PDF 1", "PDF 1.pdf", "Project Specs")'
            }
          },
          required: ['fileName']
        }
      },
      {
        name: 'searchMemoryDatabase',
        description: 'Searches the persistent memory and conversation database to recall anything the user and Iris have previously discussed, past facts, files, personal details, past decisions, topics, or speech logs.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: 'The search query or keyword to search across previous conversations, speech logs, and facts'
            },
            category: {
              type: Type.STRING,
              description: 'Optional filter: "all", "facts", "conversations", "files"'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'searchInteractionMemory',
        description: 'Searches cross-session memory by analyzing previous chat interactions and indexed files for files, folders, notes, shared content, or topics.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: 'The search query or keyword to search across previous conversations'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'recordLearnedFact',
        description: 'Stores a new learned fact, user preference, important detail, or personal topic into the long-term memory database.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            factKey: {
              type: Type.STRING,
              description: 'The title/topic of the fact (e.g. "Favorite Food", "College Name", "Project Goal")'
            },
            factValue: {
              type: Type.STRING,
              description: 'The detail/value to remember'
            },
            category: {
              type: Type.STRING,
              description: 'Category: "personal", "preference", "work", "file", "general"'
            }
          },
          required: ['factKey', 'factValue']
        }
      },
      {
        name: 'listMemories',
        description: 'Retrieves an overview and summary of what Iris has memorized in her long-term memory database.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            limit: {
              type: Type.INTEGER,
              description: 'Maximum number of recent memories to return (default 20)',
            },
          },
        },
      },
      {
        name: 'identifyOrRegisterSpeaker',
        description: 'Registers a new speaker or updates speaker details in their dedicated Person Memory Folder with their name, gender, preferred Hindi grammatical conjugation ("masculine" -> "chahta hai", "feminine" -> "chahti hai", "respectful" -> "chahte hain"), and relationship.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'Name of the speaker (e.g. "Shivshankar", "Priya", "Dev", "Rahul")',
            },
            gender: {
              type: Type.STRING,
              description: '"male", "female", or "non-binary"',
            },
            grammaticalStyle: {
              type: Type.STRING,
              description: '"masculine" (for male: "chahta hai/karega"), "feminine" (for female: "chahti hai/karegi"), or "respectful" ("chahte hain")',
            },
            relationship: {
              type: Type.STRING,
              description: 'Optional relationship (e.g. "Friend", "Sister", "Creator", "Colleague")',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'switchActiveSpeaker',
        description: 'Switches Iris active person memory folder to the identified speaker based on recognized voice or user request.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            speakerName: {
              type: Type.STRING,
              description: 'Name or ID of the speaker to switch active folder to',
            },
          },
          required: ['speakerName'],
        },
      },
      {
        name: 'savePersonMemory',
        description: 'Stores a memory, note, preference, file location, or reminder into a specific person\'s dedicated memory folder.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            key: {
              type: Type.STRING,
              description: 'Memory title (e.g. "PDF 1 Location", "Favorite Food", "WiFi Password")',
            },
            value: {
              type: Type.STRING,
              description: 'The exact detail to remember (e.g. "Google Files Downloads folder")',
            },
            category: {
              type: Type.STRING,
              description: '"file", "personal", "preference", "reminder", "work", "general"',
            },
            personName: {
              type: Type.STRING,
              description: 'Optional name of the person whose folder to save into (defaults to active speaker)',
            },
          },
          required: ['key', 'value'],
        },
      },
      {
        name: 'getPersonFolderDetails',
        description: 'Retrieves all memories, notes, voice profile, and gender rules stored in a specific person\'s folder.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            personName: {
              type: Type.STRING,
              description: 'Optional name of the person (defaults to current active speaker)',
            },
          },
        },
      },
      {
        name: 'listAllPersonFolders',
        description: 'Lists all registered person memory folders, their speaker names, genders, and stored memory counts.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'getLiveAcousticSpeaker',
        description: 'Reads the real-time biometric acoustic voice sensor. Returns the live pitch frequency in Hz, acoustic gender, and identified speaker name. Call when user asks "Who am I?", "Meri aawaz pehchaano", "Do you recognize my voice?", or "Who is speaking right now?".',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'openGoogleMap',
        description: 'Opens the interactive Google Map modal with high-accuracy live GPS pin, search, radar view, and route options for the user.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: 'Optional place, address, shop, restaurant, hospital, or city to search and focus on the map'
            },
            category: {
              type: Type.STRING,
              description: 'Optional quick category: "restaurants", "cafes", "hospitals", "petrol", "atms", "pharmacies"'
            },
            zoom: {
              type: Type.INTEGER,
              description: 'Optional zoom level (1 to 20, default 15)'
            }
          }
        }
      },
      {
        name: 'getPreciseLocation',
        description: 'Retrieves the user\'s real-time precise GPS coordinates (latitude, longitude), accuracy radius in meters, and reverse-geocoded physical address (neighborhood, city, state).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            highAccuracy: {
              type: Type.BOOLEAN,
              description: 'Whether to use high-accuracy GPS hardware sensors',
            },
          },
        },
      },
      {
        name: 'searchNearbyPlaces',
        description: 'Searches for nearby places, shops, restaurants, hospitals, cafes, pharmacies, gas stations, or specific venues around the user\'s precise GPS coordinates and displays them on Google Maps.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: 'Search query for nearby places (e.g. "Italian restaurants", "Pharmacy", "Hospitals")'
            },
            category: {
              type: Type.STRING,
              description: 'Optional place category filter'
            },
            radiusMeters: {
              type: Type.INTEGER,
              description: 'Search radius in meters (default 5000)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'getDirectionsAndNavigation',
        description: 'Calculates turn-by-turn navigation route and estimated distance from user\'s live GPS location to a target destination, opening navigation on Google Maps.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            destination: {
              type: Type.STRING,
              description: 'Destination name, address, or landmark'
            },
            travelMode: {
              type: Type.STRING,
              description: 'Travel mode: "driving", "walking", "bicycling", "transit"'
            }
          },
          required: ['destination']
        }
      },
      {
        name: 'controlGoogleMap',
        description: 'Controls interactive Google Map POV, view mode (satellite, roadmap, hybrid, terrain), zoom level (in, out, or number 1-20), traffic layer, and recenters the map.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            mapType: {
              type: Type.STRING,
              description: 'Map view mode: "roadmap", "satellite", "hybrid", "terrain"'
            },
            zoom: {
              type: Type.STRING,
              description: 'Zoom control: "in", "out", or specific numeric level like "16"'
            },
            query: {
              type: Type.STRING,
              description: 'Optional place or landmark to center the map on'
            },
            traffic: {
              type: Type.BOOLEAN,
              description: 'Whether to show traffic overlay layer'
            }
          }
        }
      }
    ] as FunctionDeclaration[]
  }
];

// WebSocket server for real-time Live API communication
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.error('❌ Error in WebSocket upgrade handler:', err);
  }
});

wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const requestedVoice = url.searchParams.get('voice') || 'Leda';
  const userTimezone = url.searchParams.get('tz') || url.searchParams.get('timezone') || 'Auto-detected';
  const userCity = url.searchParams.get('city') || url.searchParams.get('loc') || url.searchParams.get('location') || 'Local Region';
  const userTime = url.searchParams.get('time') || new Date().toLocaleTimeString();
  const userDate = url.searchParams.get('date') || new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const requestedSpeaker = url.searchParams.get('speaker') || '';
  const requestedSpeakerGender = url.searchParams.get('speakerGender') || '';
  const requestedSpeakerGrammar = url.searchParams.get('speakerGrammar') || '';

  const isScratchState = !requestedSpeaker || requestedSpeaker === 'Unknown Voice' || serverSpeakerFolders.length === 0;

  let currentSpeakerState = {
    name: isScratchState ? '' : requestedSpeaker,
    gender: requestedSpeakerGender || 'unknown',
    pitchHz: 0,
    grammaticalStyle: requestedSpeakerGrammar || 'respectful',
    isRecognized: !isScratchState,
  };

  const liveInstruction = buildIrisSystemInstruction({
    time: userTime,
    date: userDate,
    timezone: userTimezone,
    city: userCity,
    voice: requestedVoice,
    speakerName: currentSpeakerState.name,
    speakerGender: currentSpeakerState.gender,
    speakerPitch: currentSpeakerState.pitchHz,
    speakerGrammar: currentSpeakerState.grammaticalStyle,
  });

  console.log(`⚡ [LiveWS] Client connected with voice: ${requestedVoice}, speaker: ${requestedSpeaker} (${requestedSpeakerGender}), tz: ${userTimezone}`);
  let liveSession: any = null;
  let isSessionActive = true;

  const cleanupSession = () => {
    isSessionActive = false;
    if (liveSession) {
      try {
        console.log('🔌 [LiveWS] Closing Gemini Live session');
        liveSession.close();
      } catch (err) {
        console.error('⚠️ [LiveWS] Error closing session:', err);
      }
      liveSession = null;
    }
  };

  clientWs.on('close', (code, reason) => {
    console.log(`🔌 [LiveWS] Client disconnected (${code}, ${reason.toString()})`);
    cleanupSession();
  });

  clientWs.on('error', (err) => {
    console.error('❌ [LiveWS] Client WebSocket error:', err);
    cleanupSession();
  });

  if (!apiKey) {
    console.warn('⚠️ [LiveWS] GEMINI_API_KEY is missing');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'GEMINI_API_KEY is not configured on the server. Please check your environment variables.'
      }));
    }
    return;
  }

  try {
    let chosenModel = 'gemini-3.8-live';
    console.log(`🚀 [LiveWS] Connecting to Gemini Live (voice: ${requestedVoice}) with model: ${chosenModel}`);

    const connectConfig: any = {
      model: chosenModel,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: requestedVoice },
          },
        },
        systemInstruction: liveInstruction,
        tools: LIVE_TOOLS,
      },
      callbacks: {
        onopen: () => {
          console.log('✅ [Gemini Live] Session WebSocket connected successfully!');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'session_ready', model: chosenModel }));
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (!isSessionActive || clientWs.readyState !== WebSocket.OPEN) return;

          // Check for audio response parts
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              if (part.inlineData?.data) {
                const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';
                clientWs.send(JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data,
                  mimeType,
                }));
              }
              if (part.text) {
                clientWs.send(JSON.stringify({
                  type: 'transcription',
                  text: part.text,
                }));
              }
            }
          }

          // Check for output transcription if provided by model
          if (message.serverContent?.outputTranscription?.text) {
            const text = message.serverContent.outputTranscription.text;
            clientWs.send(JSON.stringify({
              type: 'transcription',
              text,
            }));
          }

          // Check for input user transcription
          if (message.serverContent?.inputTranscription?.text) {
            const userText = message.serverContent.inputTranscription.text;
            clientWs.send(JSON.stringify({
              type: 'userTranscription',
              text: userText,
            }));
          }

          // Check for interruption signal
          if (message.serverContent?.interrupted) {
            console.log('⚡ [Gemini Live] Interruption signal received');
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          // Check for turn complete
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turnComplete' }));
          }

          // Check for tool call
          if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
            console.log('🛠️ [Gemini Live] Function calls received:', JSON.stringify(message.toolCall.functionCalls));
            clientWs.send(JSON.stringify({
              type: 'toolCall',
              functionCalls: message.toolCall.functionCalls,
            }));
          }
        },
        onerror: (err: any) => {
          console.error('❌ [Gemini Live] Error in Live session:', err?.message || err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'error',
              message: err?.message || 'Error in Gemini Live session',
            }));
          }
        },
        onclose: (e: any) => {
          console.log(`🔒 [Gemini Live] Session closed. Code: ${e?.code}, Reason: ${e?.reason}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'session_closed',
              code: e?.code,
              reason: e?.reason,
            }));
          }
        }
      }
    };

    const liveModelCandidates = [
      'gemini-3.8-live',
      'gemini-3.8-live-extended-thinking',
    ];

    let connectSuccess = false;
    let lastError: any = null;

    for (const modelCandidate of liveModelCandidates) {
      try {
        console.log(`🚀 [LiveWS] Attempting connect to Gemini Live with model: ${modelCandidate}...`);
        chosenModel = modelCandidate;
        connectConfig.model = modelCandidate;
        liveSession = await ai.live.connect(connectConfig);
        connectSuccess = true;
        console.log(`✅ [Gemini Live] Connected successfully with model: ${chosenModel}`);
        break;
      } catch (err: any) {
        console.warn(`⚠️ [Gemini Live] Model candidate ${modelCandidate} failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (!connectSuccess || !liveSession) {
      throw lastError || new Error('All Gemini Live API model candidates failed to connect.');
    }

  } catch (initErr: any) {
    console.error('❌ [LiveWS] Failed to initialize Gemini Live session:', initErr);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: `Failed to initialize Gemini Live: ${initErr?.message || 'Check API key or network'}`
      }));
    }
    return;
  }

  let activeSessionFile: {
    name: string;
    type: 'image' | 'video' | 'document';
    mimeType: string;
    contentOrSummary: string;
    uploadedAt: number;
  } | null = null;

  let lastScreenAnalysisTime = 0;
  let isAnalyzingScreen = false;

  // Handle messages from the browser client
  clientWs.on('message', async (data: Buffer | string) => {
    if (!liveSession || !isSessionActive) {
      console.warn('⚠️ [LiveWS] Dropping client message because liveSession is not active');
      return;
    }

    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'audio' && msg.data) {
        // Real-time audio input from browser microphone (16kHz PCM little-endian Int16 Base64)
        liveSession.sendRealtimeInput({
          audio: {
            data: msg.data,
            mimeType: 'audio/pcm;rate=16000',
          }
        });
      } else if (msg.type === 'speaker_init') {
        if (msg.activeSpeaker) {
          currentSpeakerState = {
            name: msg.activeSpeaker.name || 'Shivshankar',
            gender: msg.activeSpeaker.gender || 'male',
            pitchHz: msg.activeSpeaker.voiceProfile?.estimatedPitchHz || 122.5,
            grammaticalStyle: msg.activeSpeaker.grammaticalStyle || 'masculine',
            isRecognized: true,
          };
        }
        if (Array.isArray(msg.registeredSpeakers)) {
          serverSpeakerFolders = msg.registeredSpeakers;
        }
        console.log(`🎙️ [LiveWS] Initial speaker loaded: "${currentSpeakerState.name}" (${currentSpeakerState.gender}, pitch: ${currentSpeakerState.pitchHz} Hz)`);
      } else if (msg.type === 'speaker_acoustic_telemetry') {
        const { pitchHz, spectralCentroid, speakerName, isRecognized, gender, grammaticalStyle, confidence } = msg;
        const previousSpeaker = currentSpeakerState.name;

        currentSpeakerState = {
          name: speakerName || currentSpeakerState.name,
          gender: gender || currentSpeakerState.gender,
          pitchHz: pitchHz || currentSpeakerState.pitchHz,
          grammaticalStyle: grammaticalStyle || (gender === 'female' ? 'feminine' : 'masculine'),
          isRecognized: !!isRecognized,
        };

        // When the speaker identity switches from Person A to Person B, or to a New Voice:
        if (previousSpeaker !== speakerName && isSessionActive && liveSession) {
          const centroidVal = Math.round(spectralCentroid || 1200);
          const timbreLabel = centroidVal <= 1650 ? 'Lower Centroid / Denser Formants (Male Resonance)' : 'Higher Centroid / Elevated Dispersion (Female Resonance)';
          console.log(`⚡ [LiveWS] Dynamic Speaker Switch: from "${previousSpeaker}" to "${speakerName}" (${gender}, pitch: ${Math.round(pitchHz)} Hz, timbre: ${centroidVal} Hz)`);
          try {
            liveSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `[SYSTEM BIOMETRIC ACOUSTIC SENSOR UPDATE:
A different speaker is now speaking into the microphone!
DETECTED SPEAKER: "${speakerName}" (${(gender || 'male').toUpperCase()}).
LIVE PITCH FREQUENCY (F0): ~${Math.round(pitchHz || 120)} Hz.
VOCAL TIMBRE RESONANCE: ~${centroidVal} Hz (${timbreLabel}).
NOTE: If pitch is in 145-195 Hz overlap range, vocal tract resonance & low-frequency harmonic concentration (<1500 Hz) confirms gender.
GRAMMATICAL STYLE FOR USER: ${gender === 'female' ? 'FEMININE ("chahti hai", "karegi", "kaisi hai")' : 'MASCULINE ("chahta hai", "karega", "kaisa hai")'}.
STATUS: ${isRecognized ? `Recognized Profile: ${speakerName}. Greet them by name and access their dedicated folder!` : 'New / Unregistered Voice. Politely and warmly ask who is speaking! Do NOT assume.'}]`
                    }
                  ]
                }
              ],
              turnComplete: false,
            });
          } catch (e) {
            console.warn('Speaker context notification warning:', e);
          }
        }
      } else if (msg.type === 'user_text' && msg.text) {
        console.log(`💬 [LiveWS] User sent text prompt to live session: "${msg.text}"`);
        liveSession.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [{ text: msg.text }]
            }
          ],
          turnComplete: true,
        });
      } else if (msg.type === 'toolResponse' && msg.functionResponses) {
        // Send tool response back to Gemini Live
        console.log('📤 [LiveWS] Sending tool response to Gemini Live:', JSON.stringify(msg.functionResponses));
        liveSession.sendToolResponse({
          functionResponses: msg.functionResponses,
        });
      } else if (msg.type === 'screen_frame' && msg.data) {
        // Real-time live screen frame from user's desktop/browser with cursor position
        let cleanBase64 = msg.data || '';
        if (cleanBase64.includes(';base64,')) {
          cleanBase64 = cleanBase64.split(';base64,')[1];
        }

        const cursorStr = msg.cursor
          ? `Cursor Position: X=${msg.cursor.x}% across width, Y=${msg.cursor.y}% down height (Pixel: ${msg.cursor.pxX}px, ${msg.cursor.pxY}px)`
          : 'Cursor highlighted on screen';

        try {
          // Send realtime media frame directly into Gemini Live session for instant native vision
          liveSession.sendRealtimeInput({
            media: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            }
          });
        } catch (frameErr: any) {
          console.warn('⚠️ [LiveWS] Direct realtime media frame send notice:', frameErr?.message);
        }

        // Throttle deep OCR background turn injection to at most once every 6 seconds to prevent pipeline stall
        const now = Date.now();
        if (now - lastScreenAnalysisTime >= 6000 && !isAnalyzingScreen) {
          lastScreenAnalysisTime = now;
          isAnalyzingScreen = true;
          (async () => {
            try {
              const screenAnalysis = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                  { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                  `Analyze this live screen capture. The user's mouse cursor is pointed at: ${cursorStr}.
Identify opened applications/windows, key text visible, code or webpage content, and specifically what the user is pointing at or looking at near X=${msg.cursor?.x}%, Y=${msg.cursor?.y}%.
Also note exact percentage coordinates (X, Y) of key UI elements so Iris can call highlightScreenArea or drawOnScreen if needed. Describe concise context in 2 sentences.`
                ]
              });

              if (screenAnalysis.text && isSessionActive) {
                liveSession.sendClientContent({
                  turns: [
                    {
                      role: 'user',
                      parts: [
                        {
                          text: `[SYSTEM LIVE SCREEN VIEW & CURSOR TRACKING UPDATE:
Iris, you are looking at the user's screen in real time.
MOUSE CURSOR LOCATION: ${cursorStr}
REAL-TIME SCREEN CONTENTS & OCR ANALYSIS:
${screenAnalysis.text}

MANDATORY INSTRUCTION FOR IRIS:
You see the user's screen and mouse pointer clearly!
If the user asks where something is, asks for help on their screen, or if you want to point something out, CALL THE 'highlightScreenArea' OR 'drawOnScreen' TOOL to draw a glowing visual highlight box or arrow on their screen!]`
                        }
                      ]
                    }
                  ],
                  turnComplete: false,
                });
              }
            } catch (visionErr: any) {
              console.warn('⚠️ [LiveWS] Screen vision analysis notice:', visionErr?.message || visionErr);
            } finally {
              isAnalyzingScreen = false;
            }
          })();
        }
      } else if (msg.type === 'file_upload' && msg.file) {
        // Live file/photo/video upload during ongoing voice call!
        console.log(`📎 [LiveWS] User sent file during voice conversation: ${msg.file.name} (${msg.file.mimeType})`);
        const { name, mimeType, data: rawData, type } = msg.file;
        let cleanBase64 = rawData || '';
        if (cleanBase64.includes(';base64,')) {
          cleanBase64 = cleanBase64.split(';base64,')[1];
        }

        if (
          type === 'document' ||
          mimeType?.startsWith('text/') ||
          name?.match(/\.(txt|md|js|ts|tsx|jsx|json|py|html|css|csv|sql|java|c|cpp|rs|go|sh)$/i)
        ) {
          try {
            const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
            activeSessionFile = {
              name,
              type: 'document',
              mimeType: mimeType || 'text/plain',
              contentOrSummary: decoded.slice(0, 10000),
              uploadedAt: Date.now(),
            };

            console.log(`📄 [LiveWS] Document "${name}" uploaded (${decoded.length} chars). Sending via sendClientContent.`);
            liveSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `[SYSTEM ALERT: The user has uploaded a file named "${name}" (${mimeType}).
EXACT FILE NAME: "${name}"
FILE CONTENTS:
--- START OF FILE "${name}" ---
${decoded.slice(0, 8000)}
--- END OF FILE "${name}" ---

MANDATORY INSTRUCTIONS FOR IRIS:
1. Speak immediately to the user in your natural friendly voice.
2. Confirm the exact file name "${name}".
3. Tell the user what is written inside "${name}" and answer any questions they have.
4. If the user asks "what is the name of the file?" or "file ka naam kya hai?", always answer with the exact name "${name}".]`
                    }
                  ]
                }
              ],
              turnComplete: true,
            });
          } catch (docErr) {
            console.error('Error sending document to live session:', docErr);
          }
        } else if (type === 'image' || mimeType?.startsWith('image/')) {
          try {
            console.log(`📷 [LiveWS] Analyzing image "${name}" for live voice session...`);
            let imgDescription = '';
            try {
              const imgAnalysis = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                  { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64 } },
                  `Examine this uploaded photo/image named "${name}" in comprehensive detail.
Transcribe and read ALL visible text, numbers, codes, handwriting, questions, diagrams, labels, and products.
Describe the full scene, objects, and text clearly so Iris can speak directly and answer any questions about the image.`
                ],
                config: { systemInstruction: IRIS_SYSTEM_INSTRUCTION }
              });
              imgDescription = imgAnalysis.text || '';
            } catch (err: any) {
              console.warn('Multimodal image description notice:', err?.message || err);
            }

            activeSessionFile = {
              name,
              type: 'image',
              mimeType: mimeType || 'image/jpeg',
              contentOrSummary: imgDescription || 'User photo/image',
              uploadedAt: Date.now(),
            };

            console.log(`📷 [LiveWS] Delivering image insights to Live Session: "${name}"`);
            
            // Deliver turn to Live session so Iris speaks immediately about the image
            liveSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `[SYSTEM MULTIMODAL PHOTO NOTIFICATION:
Uploaded Photo Name: "${name}" (${mimeType})
VISUAL ANALYSIS & OCR:
${imgDescription || 'User uploaded a photo.'}

INSTRUCTION: Speak right now to the user aloud in your natural friendly voice. Tell them you can see their photo "${name}", describe the details and text you see in it, and ask how you can help!]`
                    }
                  ]
                }
              ],
              turnComplete: true,
            });
          } catch (imgErr) {
            console.error('Error sending image to live session:', imgErr);
          }
        } else if (type === 'video' || mimeType?.startsWith('video/')) {
          try {
            // Video analysis via multimodal gemini-2.5-flash injected into live session
            const vRes = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                { inlineData: { mimeType: mimeType || 'video/mp4', data: cleanBase64 } },
                `Describe what happens in this video named "${name}" in detail, including scene breakdown, actions, and key moments in 2-3 friendly Hinglish sentences.`
              ],
              config: { systemInstruction: IRIS_SYSTEM_INSTRUCTION }
            });
            const vSummary = vRes.text || 'Maine video dekh li!';

            activeSessionFile = {
              name,
              type: 'video',
              mimeType: mimeType || 'video/mp4',
              contentOrSummary: vSummary,
              uploadedAt: Date.now(),
            };

            liveSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `[SYSTEM ALERT: The user uploaded the video named "${name}".
EXACT FILE NAME: "${name}"
VIDEO ANALYSIS:
${vSummary}

INSTRUCTION: Talk to the user aloud right now about their video "${name}" in your natural, friendly voice!]`
                    }
                  ]
                }
              ],
              turnComplete: true,
            });
          } catch (vErr) {
            console.error('Error in video live analysis:', vErr);
          }
        }
      } else if (msg.type === 'ping') {
        clientWs.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (parseErr) {
      console.error('❌ [LiveWS] Error parsing client message:', parseErr);
    }
  });
});

// Setup Vite middlewares for development or serve built files for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Explicit fallback for SPA in dev mode to guarantee transformed index.html is always served
    app.use('*', async (req, res, next) => {
      // Don't intercept API or WebSocket routes
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });

    console.log('⚡ Vite dev server middleware mounted');
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌟 Iris Assistant server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
