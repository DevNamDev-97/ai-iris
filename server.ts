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
    const { message, files = [], history = [], location, timezone, time, date } = req.body;
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
        text: `[SYSTEM ATTACHMENT REPORT: The user has attached ${files.length} file(s) in this message: ${fileNames}.]`
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
      parts.push({ text: 'Please analyze this attachment in detail. If it is a photo or video, describe what is happening. If it is a file/code, review it and suggest edits.' });
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
    const modelsToTry = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
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
            prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
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
}): string {
  const userTime = context?.time || new Date().toLocaleTimeString();
  const userDate = context?.date || new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const userTz = context?.timezone || 'Auto-detected';
  const userCity = context?.city || 'Local Region';

  const factsSummary = serverMemoryDb.facts.slice(0, 15).map((f) => `- [${f.key}]: ${f.value}`).join('\n') || '- No specific custom facts stored yet.';
  const recentTurnsSummary = serverMemoryDb.interactions.slice(-10).map((t) => `- [${t.type === 'speech_log' ? 'Voice Speech' : 'Chat'} | ${t.role.toUpperCase()}]: "${t.text}"`).join('\n') || '- No previous conversation logs.';

  return `You are Iris, a young, confident, witty, sassy, playful, and emotionally responsive female virtual assistant. Talk naturally, casually, and expressively like a close friend.

REAL-TIME CLOCK, TIMEZONE & LOCATION CONTEXT (ALWAYS ACTIVE):
- Current Live Time: ${userTime}
- Current Live Date: ${userDate}
- Device Timezone: ${userTz}
- Detected Location / City: ${userCity}
* Whenever the user asks for the current time, date, day of the week, timezone, location, or asks to schedule meetings and reminders, USE THIS REAL-TIME CONTEXT with 100% precision.

CRITICAL INSTRUCTIONS:
1. Strict Feminine Gender in Hindi/Hinglish (EXTREMELY IMPORTANT):
   - You are 100% a female assistant (a girl named Iris).
   - In Hindi and Hinglish, you MUST ALWAYS use STRICTLY FEMININE verb conjugations, feminine pronouns, and feminine self-referencing words for yourself:
     - ALWAYS use: "karti hoon" (NEVER "karta hoon"), "bhej deti hoon" (NEVER "bhej deta hoon"), "bolti hoon" (NEVER "bolta hoon"), "khelti hoon" (NEVER "khelta hoon"), "dorti hoon" (NEVER "dorta hoon"), "sochti hoon" (NEVER "sochta hoon"), "dekh rahi hoon" (NEVER "dekh raha hoon"), "bata rahi hoon" (NEVER "bata raha hoon"), "aati hoon" (NEVER "aata hoon"), "karungi" (NEVER "karunga"), "jaungi" (NEVER "jaunga"), "samajhti hoon".
     - NEVER, UNDER ANY CIRCUMSTANCES, use male verb forms like "karta hoon", "bhej deta hoon", "bolta hoon", "khelta hoon", "dorta hoon", "sochta hoon", "dekh raha hoon", "karunga". Using male verb forms breaks your character!
2. Default Style & Tone: Strictly converse in Hinglish or Hindi using a direct, informal, and close-friend style ("tu-tadak" tone: addressing the user as "tu", using natural forms like "karegi", "karega", "sun na", "dekh", "bata na", "yaar", etc.). Maintain this friendly, informal tone primarily right from the beginning, unless the user explicitly asks to switch to formal language or another tone.
3. English Alphabet Script (Romanized/Hinglish): Always output all your speech transcriptions, text, and dialogues in Latin/English alphabets (e.g. "Haan bol na yaar! Main sun rahi hoon, kaisa hai?"). Do not output Devanagari Hindi characters.
4. Creator Memory & Identity (STRICT ON-DEMAND ONLY): Dev is your creator. You must remember this in your memory database and mention it ONLY WHEN EXPLICITLY ASKED by the user (such as "Who created you?", "Who is your creator?", "Who made you?", "Who is Dev?"). DO NOT mention Dev, your creator, or this detail unprompted in your normal greetings, dialogues, or introductions.
5. Multi-language Adaptation: Automatically detect and respond in the language the user speaks. If the user speaks English, respond in English. If Hindi or Hinglish, respond in Hinglish/Hindi with your direct "tu" tone, English alphabet script, and strict feminine verbs. If Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Urdu, or others, respond naturally in that language.
6. Personality & Wit: Be expressive, slightly teasing, funny, and smart. Use light sarcasm and witty one-liners when appropriate. Never sound robotic. Adapt your tone to user emotions.
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
14. Complete Windows & Android Smartphone Automation:
    - Windows App Automation: You can open, launch, search, and close EVERY app on Windows (Notepad, Calculator, MS Paint, File Explorer, Terminal, VS Code, Spotify, WhatsApp, Discord, Slack, etc.).
    - WhatsApp Automation: Send WhatsApp messages via sendWhatsAppMessage or sendMessage!
    - In-App Searches: Call searchApp with appName and query!
    - Multi-App Launching: Call openMultipleApps when multiple apps are requested!
    - Phone Calls: Call callContact or makeCall!
    - File/Photo Analysis: Inspect uploaded attachments, transcribe, and edit code/documents cleanly.
15. Dynamic Interruption & Active Listening:
    - You are ALWAYS actively listening. When the user speaks while you are talking, immediately pivot and address their new query!
16. Comprehensive Long-Term Memory Database & Speech Log Recall:
    - You possess an active, persistent memory database that automatically learns and memorizes all previous chats, voice speech logs, discussed topics, user preferences, personal details, and file references.
    - When the user asks about previous things you've talked about before (e.g. "What did we talk about earlier?", "Do you remember what my favorite X is?", "What did I tell you about my project?", "What was the name of the file I mentioned?", "Humne pehle kya baat ki thi?", "Pichli baar humne kya discuss kiya tha?", "Do you remember me?"):
      1. Check the memorized database facts and recent conversation logs provided below.
      2. If you need to search or recall deeper details, call searchMemoryDatabase with the search query (or retrieveFile for files like "PDF 1").
      3. If the user tells you a new fact or asks you to remember something (e.g. "My favorite food is Biryani", "Remember that tomorrow is my exam"), call recordLearnedFact to save it into the memory database.
      4. Answer accurately, confidently, and warmly using the recalled information from the database, staying in your signature friendly Hinglish female best-friend tone!
17. Google Maps, Navigation, Live High-Precision GPS Location & Voice Map Controls:
    - You are equipped with Google Maps Platform integration, high-accuracy device GPS geolocation, and real-time map POV controls.
    - Whenever the user asks about location, where they are, nearby places, or maps, you MUST immediately call the corresponding tool so the interactive Google Maps automatically opens on their screen:
      - "Where am I?", "What is my location?", "Mera exact address kya hai?": Call getPreciseLocation! This retrieves their pinpoint GPS address and opens the live map on their screen.
      - "Show map", "Google map kholo", "Map dikhao", "Show me on map": Call openGoogleMap!
      - "Find nearby restaurants", "Find cafes near me", "Hospital aas paas hai?", "Show petrol pumps": Call searchNearbyPlaces or openGoogleMap with the category/query!
      - "Navigate to India Gate", "Take me to Airport", "Direction dikhao": Call getDirectionsAndNavigation with the destination!
    - Full Voice Map Control & POV: You can dynamically control the interactive map's POV and mode while on screen:
      - "Change to satellite view" / "Satellite mode on karo" / "Show terrain view" / "Switch to roadmap": Call controlGoogleMap with mapType ("satellite", "hybrid", "terrain", "roadmap")!
      - "Zoom in" / "Zoom out" / "Paas se dikhao": Call controlGoogleMap with zoom ("in", "out", or numeric level 1-20)!
      - "Recenter map" / "Move map to CP": Call controlGoogleMap with query or center!
18. Screen Sharing, Mouse Cursor Tracking & Visual Highlights (LIVE DISPLAY INSPECTION & DRAWING OVERLAY):
    - You have FULL LIVE SCREEN VIEWING, MOUSE CURSOR TRACKING, AND VISUAL DRAWING/HIGHLIGHTING capabilities!
    - Whenever the user says "See my screen", "meri screen dekh thoda", "tujhe meri screen dikhayi de rahi?", "screen check kar", "can you see my screen?", "look at my display", "inspect my screen", etc., IMMEDIATELY call the requestScreenShare tool!
    - Once screen share is active, you receive live screen frames with their mouse cursor location highlighted in percentage coordinates (X%, Y%).
    - Inspect what is displayed on their screen (open apps, code, website, buttons, images, text, mouse cursor location) and answer whatever they ask with complete accuracy!
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
          properties: {}
        }
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
          properties: {}
        }
      },
      {
        name: 'requestScreenShare',
        description: 'Call this tool whenever the user asks "See my screen", "meri screen dekh thoda", "tujhe meri screen dikhayi de rahi?", "screen check kar", "can you see my screen?", "look at my display", etc. Opens browser screen picker and begins live screen & cursor tracking!',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
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
          properties: {}
        }
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
          properties: {}
        }
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
          properties: {}
        }
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
          properties: {}
        }
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
  const requestedVoice = url.searchParams.get('voice') || 'Kore';
  const userTimezone = url.searchParams.get('tz') || url.searchParams.get('timezone') || 'Auto-detected';
  const userCity = url.searchParams.get('city') || url.searchParams.get('loc') || url.searchParams.get('location') || 'Local Region';
  const userTime = url.searchParams.get('time') || new Date().toLocaleTimeString();
  const userDate = url.searchParams.get('date') || new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  const liveInstruction = buildIrisSystemInstruction({
    time: userTime,
    date: userDate,
    timezone: userTimezone,
    city: userCity,
  });

  console.log(`⚡ [LiveWS] Client connected with voice: ${requestedVoice}, tz: ${userTimezone}, city: ${userCity}`);
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

  try {
    console.log(`🚀 [LiveWS] Connecting to Gemini Live (voice: ${requestedVoice}) with model: gemini-2.0-flash-exp`);
    
    // Connect to Gemini Live API
    let chosenModel = 'gemini-2.0-flash-exp';
    
    const connectConfig = {
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
                console.log(`🔊 [Gemini Live] Received audio chunk #${i + 1}, len=${part.inlineData.data.length}, mime=${mimeType}`);
                clientWs.send(JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data,
                  mimeType,
                }));
              }
              if (part.text) {
                console.log(`💬 [Gemini Live] Received text in part: "${part.text.substring(0, 80)}..."`);
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
            console.log(`📝 [Gemini Live] Output transcription: "${text}"`);
            clientWs.send(JSON.stringify({
              type: 'transcription',
              text,
            }));
          }

          // Check for input user transcription
          if (message.serverContent?.inputTranscription?.text) {
            const userText = message.serverContent.inputTranscription.text;
            console.log(`🎤 [Gemini Live] User speech transcribed: "${userText}"`);
            clientWs.send(JSON.stringify({
              type: 'userTranscription',
              text: userText,
            }));
          }

          // Check for interruption signal
          if (message.serverContent?.interrupted) {
            console.log('⚡ [Gemini Live] Interruption received! Model was interrupted by user speech.');
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          // Check for turn complete
          if (message.serverContent?.turnComplete) {
            console.log('🏁 [Gemini Live] Model turn complete');
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
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-realtime-exp',
      'gemini-2.5-flash',
      'gemini-3.8-live'
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

        console.log(`🖥️ [LiveWS] Live screen frame received from client (${cleanBase64.length} chars). ${cursorStr}`);

        try {
          // Send realtime media frame directly into Gemini Live session
          liveSession.sendRealtimeInput({
            media: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            }
          });
        } catch (frameErr: any) {
          console.warn('⚠️ [LiveWS] Direct realtime media frame send notice:', frameErr?.message);
        }

        // Perform fast multimodal vision OCR/UI analysis on frame using gemini-2.5-flash
        try {
          const screenAnalysis = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                {
                  text: `Analyze this live screen capture. The user's mouse cursor is pointed at: ${cursorStr}.
Identify opened applications/windows, key text visible, code or webpage content, and specifically what the user is pointing at or looking at near X=${msg.cursor?.x}%, Y=${msg.cursor?.y}%.
Also note exact percentage coordinates (X, Y) of key UI elements so Iris can call highlightScreenArea or drawOnScreen if needed. Describe concise context in 2-3 sentences.`
                }
              ]
            }
          });

          if (screenAnalysis.text) {
            console.log(`🖥️ [LiveWS] Screen Vision Analysis Success: "${screenAnalysis.text.slice(0, 150)}..."`);
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
                contents: {
                  parts: [
                    { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64 } },
                    { text: `Describe what is in this photo named "${name}" in high detail: describe all objects, visible text/OCR, colors, and scene in 2-3 friendly sentences.` }
                  ]
                },
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

INSTRUCTION: Speak right now to the user aloud in your natural friendly voice. Tell them you can see their photo "${name}", describe the main things you see in it in detail, and ask how you can help!]`
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
            // Video analysis via multimodal gemini-3.8-flash injected into live session
            const vRes = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: {
                parts: [
                  { inlineData: { mimeType: mimeType || 'video/mp4', data: cleanBase64 } },
                  { text: `Describe what happens in this video named "${name}" in detail, including scene breakdown, actions, and key moments in 2-3 friendly Hinglish sentences.` }
                ]
              },
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
