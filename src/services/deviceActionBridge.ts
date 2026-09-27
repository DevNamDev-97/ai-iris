/**
 * DeviceActionBridge
 * Comprehensive Cross-Platform Automation Suite for Android Smartphones & Windows PC:
 * 1. Android Native Bridge for APK Packaging (`window.AndroidBridge`):
 *    - Sends structured JSON payloads: { action: "SEND_MESSAGE", app: targetApp, recipient: targetRecipient, message: textContent }
 *    - Sends open app & URL actions: { action: "OPEN_APP", app: appName, uri: targetUri }
 * 2. Mobile Browser Fallback Mode (Unsandboxed <a> dispatches with target="_blank" and rel="noopener noreferrer"):
 *    - WhatsApp: https://api.whatsapp.com/send?phone=NUMBER&text=ENCODED_MESSAGE
 *    - Gmail: mailto:RECIPIENT?subject=Subject&body=ENCODED_MESSAGE
 *    - Instagram: instagram://user?username=USERNAME
 *    - Camera: Direct click trigger on `<input type="file" accept="image/*" capture="environment">`
 * 3. Windows PC: Direct URI schemes (Notepad, Calculator, VS Code, Terminal, Spotify, WhatsApp, Office, Settings, Explorer, Steam, Discord).
 * 4. Multi-app sequential chaining in a single turn.
 */

import { crossSessionMemory, StoredFileMemory } from './crossSessionMemory.ts';
import { speakerMemoryStore } from './speakerMemoryStore.ts';
import { classifyAcousticGender } from '../utils/voiceRecognition.ts';
import { locationService } from './locationService.ts';
import { screenAnnotationService } from './screenAnnotationService.ts';
import { screenShareService } from './screenShareService.ts';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  instagram?: string;
  relation?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  description?: string;
  location?: string;
  attendees?: string[];
  googleCalendarUrl?: string;
  createdAt: number;
}

export interface DeviceReminder {
  id: string;
  title: string;
  datetime: string;
  dueTimestamp: number;
  notes?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  createdAt: number;
}

export interface DeviceNote {
  id: string;
  title: string;
  content: string;
  category: 'work' | 'personal' | 'ideas' | 'general';
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DeviceNotification {
  id: string;
  app: 'whatsapp' | 'gmail' | 'instagram' | 'messages' | 'system' | string;
  appName: string;
  sender: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  replyable: boolean;
  replies?: Array<{ sender: string; message: string; timestamp: number }>;
}

export interface DeviceLocationInfo {
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  timeZoneOffset: number;
  formattedTime: string;
  formattedDate: string;
}

export interface MediaState {
  isPlaying: boolean;
  trackTitle: string;
  artist: string;
  album?: string;
  volume: number;
  isMuted: boolean;
}

// Built-in device contacts for testing / demo
export const DEFAULT_DEVICE_CONTACTS: Contact[] = [
  { id: '1', name: 'Mom', phone: '+919876500001', email: 'mom@example.com', relation: 'Mother' },
  { id: '2', name: 'Mummy', phone: '+919876500001', email: 'mom@example.com', relation: 'Mother' },
  { id: '3', name: 'Dad', phone: '+919876500002', email: 'dad@example.com', relation: 'Father' },
  { id: '4', name: 'Papa', phone: '+919876500002', email: 'dad@example.com', relation: 'Father' },
  { id: '5', name: 'Devansh Namdev (Dev)', phone: '+919876500000', email: 'dev@namdev.org', instagram: 'devansh_namdev', relation: 'Best Friend / Creator' },
  { id: '6', name: 'Rahul Kumar', phone: '+919876500003', email: 'rahul.k@example.com', instagram: 'rahul_kumar', relation: 'Friend' },
  { id: '7', name: 'Rahul Sharma', phone: '+919876500004', email: 'rahul.s@example.com', instagram: 'rahul_sharma', relation: 'Colleague' },
  { id: '8', name: 'Priya Patel', phone: '+919876500005', email: 'priya@example.com', instagram: 'priya_patel', relation: 'Sister' },
];

export const DEFAULT_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Product Roadmap & Architecture Sync',
    date: new Date().toISOString().split('T')[0],
    startTime: '15:00',
    endTime: '15:45',
    description: 'Quarterly review with Devansh Namdev and engineering leads.',
    location: 'Google Meet',
    attendees: ['Devansh Namdev (Dev)', 'Rahul Kumar'],
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'evt-2',
    title: 'Client Demo & System Walkthrough',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    startTime: '11:00',
    endTime: '12:00',
    description: 'Present Iris multimodal assistant live automation features.',
    location: 'Virtual Conference Room',
    attendees: ['Priya Patel', 'Client Team'],
    createdAt: Date.now() - 3600000 * 12,
  },
];

export const DEFAULT_REMINDERS: DeviceReminder[] = [
  {
    id: 'rem-1',
    title: 'Review Q4 Architecture Plan and meeting notes',
    datetime: 'Today at 5:00 PM',
    dueTimestamp: Date.now() + 3600000 * 4,
    notes: 'Check multimodal attachment pipelines and response speeds',
    priority: 'high',
    completed: false,
    createdAt: Date.now() - 3600000 * 2,
  },
  {
    id: 'rem-2',
    title: 'Drink water and take a 5-minute break',
    datetime: 'In 30 minutes',
    dueTimestamp: Date.now() + 1800000,
    priority: 'medium',
    completed: false,
    createdAt: Date.now() - 1800000,
  },
];

export const DEFAULT_NOTES: DeviceNote[] = [
  {
    id: 'note-1',
    title: 'Iris Voice & Automation Architecture',
    content: 'Iris Virtual Assistant features:\n- Real-time Gemini Live WebSocket streaming\n- Android Native Bridge (`window.AndroidBridge`) for APK packaging\n- Smart calendar management, meeting scheduling & Google Calendar deep links\n- Location, timezone detection & dynamic live clock synchronization\n- In-app notification inbox & voice reply\n- Media playback controls & Reminders management',
    category: 'work',
    tags: ['ai', 'iris', 'architecture'],
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'note-2',
    title: 'Dev Ideas & Feature Wishlist',
    content: '1. Add customizable themes\n2. Spotify playlist fast-actions\n3. Offline speech cache\n4. Multimodal video frame summarizer',
    category: 'ideas',
    tags: ['ideas', 'roadmap'],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000 * 5,
  },
];

export const DEFAULT_NOTIFICATIONS: DeviceNotification[] = [
  {
    id: 'notif-1',
    app: 'whatsapp',
    appName: 'WhatsApp',
    sender: 'Devansh Namdev (Dev)',
    title: 'WhatsApp Message from Dev',
    message: 'Hey! Are the meeting notes ready for the architecture review today?',
    timestamp: Date.now() - 1000 * 60 * 12,
    read: false,
    replyable: true,
  },
  {
    id: 'notif-2',
    app: 'gmail',
    appName: 'Gmail',
    sender: 'Google AI Team',
    title: 'New Gemini Flash Live Preview updates',
    message: 'Gemini 3.1 Flash Live Preview model delivers ultra-low latency bidirectional audio streaming.',
    timestamp: Date.now() - 1000 * 60 * 45,
    read: false,
    replyable: true,
  },
  {
    id: 'notif-3',
    app: 'instagram',
    appName: 'Instagram',
    sender: 'Priya Patel',
    title: 'Instagram DM from Priya',
    message: 'Dekh ye naya AI project! Bahut fast chal raha hai.',
    timestamp: Date.now() - 1000 * 60 * 120,
    read: true,
    replyable: true,
  },
  {
    id: 'notif-4',
    app: 'messages',
    appName: 'Messages (SMS)',
    sender: '+919876543210',
    title: 'Verification Code',
    message: 'Your verification code is 849201. Valid for 10 minutes.',
    timestamp: Date.now() - 1000 * 60 * 240,
    read: true,
    replyable: false,
  },
];

export interface ToolExecutionResult {
  success: boolean;
  action: string;
  message?: string;
  error?: string;
  data?: any;
  platform?: 'windows' | 'android' | 'universal';
}

export interface WindowsAppConfig {
  name: string;
  category: 'System' | 'Developer' | 'Productivity' | 'Social' | 'Entertainment' | 'Utility' | 'Navigation';
  protocolUri: string;
  webFallback: string;
  description: string;
}

export interface SmartphoneAppConfig {
  name: string;
  category: 'Messaging' | 'Social' | 'Media' | 'Utility' | 'Payment' | 'Navigation' | 'Shopping' | 'Productivity';
  intentUri: string;
  universalUrl: string;
  packageName?: string;
  description: string;
}

// --- SMARTPHONE APPS REGISTRY ---
export const SMARTPHONE_APPS_REGISTRY: Record<string, SmartphoneAppConfig> = {
  // --- MESSAGING & SOCIAL APPS ---
  whatsapp: {
    name: 'WhatsApp',
    category: 'Messaging',
    intentUri: 'https://api.whatsapp.com/send',
    universalUrl: 'https://api.whatsapp.com/send',
    packageName: 'com.whatsapp',
    description: 'WhatsApp Messenger',
  },
  'whatsapp business': {
    name: 'WhatsApp Business',
    category: 'Messaging',
    intentUri: 'https://api.whatsapp.com/send',
    universalUrl: 'https://api.whatsapp.com/send',
    packageName: 'com.whatsapp.w4b',
    description: 'WhatsApp Business',
  },
  instagram: {
    name: 'Instagram',
    category: 'Social',
    intentUri: 'instagram://app',
    universalUrl: 'https://www.instagram.com',
    packageName: 'com.instagram.android',
    description: 'Instagram Photos, Stories & DMs',
  },
  insta: {
    name: 'Instagram',
    category: 'Social',
    intentUri: 'instagram://app',
    universalUrl: 'https://www.instagram.com',
    packageName: 'com.instagram.android',
    description: 'Instagram Photos, Stories & DMs',
  },
  gmail: {
    name: 'Gmail',
    category: 'Productivity',
    intentUri: 'mailto:',
    universalUrl: 'https://mail.google.com',
    packageName: 'com.google.android.gm',
    description: 'Google Gmail App',
  },
  email: {
    name: 'Gmail / Email',
    category: 'Productivity',
    intentUri: 'mailto:',
    universalUrl: 'https://mail.google.com',
    packageName: 'com.google.android.gm',
    description: 'Google Gmail App',
  },
  telegram: {
    name: 'Telegram',
    category: 'Messaging',
    intentUri: 'tg://resolve',
    universalUrl: 'https://web.telegram.org',
    packageName: 'org.telegram.messenger',
    description: 'Telegram Messenger',
  },
  signal: {
    name: 'Signal',
    category: 'Messaging',
    intentUri: 'sgnl://',
    universalUrl: 'https://signal.org',
    packageName: 'org.thoughtcrime.securesms',
    description: 'Signal Private Messenger',
  },
  phone: {
    name: 'Phone / Dialer',
    category: 'Utility',
    intentUri: 'tel:',
    universalUrl: 'tel:',
    packageName: 'com.google.android.dialer',
    description: 'Smartphone Phone Dialer',
  },
  dialer: {
    name: 'Phone / Dialer',
    category: 'Utility',
    intentUri: 'tel:',
    universalUrl: 'tel:',
    packageName: 'com.google.android.dialer',
    description: 'Smartphone Phone Dialer',
  },
  call: {
    name: 'Phone / Dialer',
    category: 'Utility',
    intentUri: 'tel:',
    universalUrl: 'tel:',
    packageName: 'com.google.android.dialer',
    description: 'Smartphone Phone Dialer',
  },
  messages: {
    name: 'Messages / SMS',
    category: 'Messaging',
    intentUri: 'sms:',
    universalUrl: 'sms:',
    packageName: 'com.google.android.apps.messaging',
    description: 'Smartphone SMS Messages',
  },
  sms: {
    name: 'Messages / SMS',
    category: 'Messaging',
    intentUri: 'sms:',
    universalUrl: 'sms:',
    packageName: 'com.google.android.apps.messaging',
    description: 'Smartphone SMS Messages',
  },
  youtube: {
    name: 'YouTube',
    category: 'Media',
    intentUri: 'https://www.youtube.com',
    universalUrl: 'https://www.youtube.com',
    packageName: 'com.google.android.youtube',
    description: 'YouTube Video Streaming',
  },
  yt: {
    name: 'YouTube',
    category: 'Media',
    intentUri: 'https://www.youtube.com',
    universalUrl: 'https://www.youtube.com',
    packageName: 'com.google.android.youtube',
    description: 'YouTube Video Streaming',
  },
  spotify: {
    name: 'Spotify',
    category: 'Media',
    intentUri: 'spotify:',
    universalUrl: 'https://open.spotify.com',
    packageName: 'com.spotify.music',
    description: 'Spotify Music Streaming',
  },
  music: {
    name: 'Spotify Music',
    category: 'Media',
    intentUri: 'spotify:',
    universalUrl: 'https://open.spotify.com',
    packageName: 'com.spotify.music',
    description: 'Spotify Music Streaming',
  },
  'youtube music': {
    name: 'YouTube Music',
    category: 'Media',
    intentUri: 'https://music.youtube.com',
    universalUrl: 'https://music.youtube.com',
    packageName: 'com.google.android.apps.youtube.music',
    description: 'YouTube Music App',
  },
  twitter: {
    name: 'X (Twitter)',
    category: 'Social',
    intentUri: 'https://x.com',
    universalUrl: 'https://x.com',
    packageName: 'com.twitter.android',
    description: 'X / Twitter Social Network',
  },
  x: {
    name: 'X (Twitter)',
    category: 'Social',
    intentUri: 'https://x.com',
    universalUrl: 'https://x.com',
    packageName: 'com.twitter.android',
    description: 'X / Twitter Social Network',
  },
  facebook: {
    name: 'Facebook',
    category: 'Social',
    intentUri: 'https://www.facebook.com',
    universalUrl: 'https://www.facebook.com',
    packageName: 'com.facebook.katana',
    description: 'Facebook Social App',
  },
  snapchat: {
    name: 'Snapchat',
    category: 'Social',
    intentUri: 'https://www.snapchat.com',
    universalUrl: 'https://www.snapchat.com',
    packageName: 'com.snapchat.android',
    description: 'Snapchat Stories & Camera',
  },

  // --- NAVIGATION & MAPS ---
  maps: {
    name: 'Google Maps',
    category: 'Navigation',
    intentUri: 'https://maps.google.com',
    universalUrl: 'https://maps.google.com',
    packageName: 'com.google.android.apps.maps',
    description: 'Google Maps Navigation',
  },
  'google maps': {
    name: 'Google Maps',
    category: 'Navigation',
    intentUri: 'https://maps.google.com',
    universalUrl: 'https://maps.google.com',
    packageName: 'com.google.android.apps.maps',
    description: 'Google Maps Navigation',
  },
  uber: {
    name: 'Uber',
    category: 'Navigation',
    intentUri: 'https://m.uber.com',
    universalUrl: 'https://m.uber.com',
    packageName: 'com.ubercab',
    description: 'Uber Ride Booking',
  },
  ola: {
    name: 'Ola Cabs',
    category: 'Navigation',
    intentUri: 'https://www.olacabs.com',
    universalUrl: 'https://www.olacabs.com',
    packageName: 'com.olacabs.customer',
    description: 'Ola Cabs Booking',
  },

  // --- FOOD & SHOPPING ---
  zomato: {
    name: 'Zomato',
    category: 'Shopping',
    intentUri: 'https://www.zomato.com',
    universalUrl: 'https://www.zomato.com',
    packageName: 'com.application.zomato',
    description: 'Zomato Food Delivery',
  },
  swiggy: {
    name: 'Swiggy',
    category: 'Shopping',
    intentUri: 'https://www.swiggy.com',
    universalUrl: 'https://www.swiggy.com',
    packageName: 'in.swiggy.android',
    description: 'Swiggy Food & Instamart',
  },
  blinkit: {
    name: 'Blinkit',
    category: 'Shopping',
    intentUri: 'https://blinkit.com',
    universalUrl: 'https://blinkit.com',
    packageName: 'com.grofers.customerapp',
    description: 'Blinkit Quick Commerce',
  },
  amazon: {
    name: 'Amazon Shopping',
    category: 'Shopping',
    intentUri: 'https://www.amazon.in',
    universalUrl: 'https://www.amazon.in',
    packageName: 'in.amazon.mShop.android.shopping',
    description: 'Amazon Online Shopping',
  },
  flipkart: {
    name: 'Flipkart',
    category: 'Shopping',
    intentUri: 'https://www.flipkart.com',
    universalUrl: 'https://www.flipkart.com',
    packageName: 'com.flipkart.android',
    description: 'Flipkart Shopping',
  },

  // --- UPI & PAYMENTS ---
  'google pay': {
    name: 'Google Pay (GPay)',
    category: 'Payment',
    intentUri: 'upi://pay',
    universalUrl: 'https://pay.google.com',
    packageName: 'com.google.android.apps.nbu.paisa.user',
    description: 'Google Pay UPI App',
  },
  gpay: {
    name: 'Google Pay (GPay)',
    category: 'Payment',
    intentUri: 'upi://pay',
    universalUrl: 'https://pay.google.com',
    packageName: 'com.google.android.apps.nbu.paisa.user',
    description: 'Google Pay UPI App',
  },
  phonepe: {
    name: 'PhonePe',
    category: 'Payment',
    intentUri: 'phonepe://',
    universalUrl: 'https://www.phonepe.com',
    packageName: 'com.phonepe.app',
    description: 'PhonePe UPI Payments',
  },
  paytm: {
    name: 'Paytm',
    category: 'Payment',
    intentUri: 'paytmmp://',
    universalUrl: 'https://paytm.com',
    packageName: 'net.one97.paytm',
    description: 'Paytm UPI & Wallet',
  },

  // --- SMARTPHONE UTILITIES ---
  camera: {
    name: 'Camera',
    category: 'Utility',
    intentUri: 'camera:',
    universalUrl: 'https://webcamtests.com',
    packageName: 'com.android.camera',
    description: 'Smartphone Camera',
  },
  photos: {
    name: 'Gallery / Photos',
    category: 'Utility',
    intentUri: 'https://photos.google.com',
    universalUrl: 'https://photos.google.com',
    packageName: 'com.google.android.apps.photos',
    description: 'Google Photos & Gallery',
  },
  gallery: {
    name: 'Gallery / Photos',
    category: 'Utility',
    intentUri: 'https://photos.google.com',
    universalUrl: 'https://photos.google.com',
    packageName: 'com.google.android.apps.photos',
    description: 'Google Photos & Gallery',
  },
  calculator: {
    name: 'Calculator',
    category: 'Utility',
    intentUri: 'https://calculator.net',
    universalUrl: 'https://calculator.net',
    packageName: 'com.google.android.calculator',
    description: 'Smartphone Calculator',
  },
  calc: {
    name: 'Calculator',
    category: 'Utility',
    intentUri: 'https://calculator.net',
    universalUrl: 'https://calculator.net',
    packageName: 'com.google.android.calculator',
    description: 'Smartphone Calculator',
  },
  clock: {
    name: 'Clock / Alarms / Timer',
    category: 'Utility',
    intentUri: 'https://onlineclock.net',
    universalUrl: 'https://onlineclock.net',
    packageName: 'com.google.android.deskclock',
    description: 'Clock, Alarm & Stopwatch',
  },
  alarm: {
    name: 'Clock / Alarms / Timer',
    category: 'Utility',
    intentUri: 'https://onlineclock.net',
    universalUrl: 'https://onlineclock.net',
    packageName: 'com.google.android.deskclock',
    description: 'Clock, Alarm & Stopwatch',
  },
  timer: {
    name: 'Clock / Alarms / Timer',
    category: 'Utility',
    intentUri: 'https://onlineclock.net',
    universalUrl: 'https://onlineclock.net',
    packageName: 'com.google.android.deskclock',
    description: 'Clock, Alarm & Stopwatch',
  },
  calendar: {
    name: 'Calendar',
    category: 'Productivity',
    intentUri: 'https://calendar.google.com',
    universalUrl: 'https://calendar.google.com',
    packageName: 'com.google.android.calendar',
    description: 'Google Calendar Events',
  },
  notes: {
    name: 'Google Keep Notes',
    category: 'Productivity',
    intentUri: 'https://keep.google.com',
    universalUrl: 'https://keep.google.com',
    packageName: 'com.google.android.keep',
    description: 'Google Keep Notes',
  },
  drive: {
    name: 'Google Drive',
    category: 'Productivity',
    intentUri: 'https://drive.google.com',
    universalUrl: 'https://drive.google.com',
    packageName: 'com.google.android.apps.docs',
    description: 'Google Drive Cloud Storage',
  },
  files: {
    name: 'Files / File Manager',
    category: 'Utility',
    intentUri: 'https://drive.google.com',
    universalUrl: 'https://drive.google.com',
    packageName: 'com.google.android.apps.nbu.files',
    description: 'Smartphone Files Manager',
  },
  chrome: {
    name: 'Google Chrome',
    category: 'Utility',
    intentUri: 'https://www.google.com',
    universalUrl: 'https://www.google.com',
    packageName: 'com.android.chrome',
    description: 'Google Chrome Mobile Browser',
  },
  'google chrome': {
    name: 'Google Chrome',
    category: 'Utility',
    intentUri: 'https://www.google.com',
    universalUrl: 'https://www.google.com',
    packageName: 'com.android.chrome',
    description: 'Google Chrome Mobile Browser',
  },
  'play store': {
    name: 'Google Play Store',
    category: 'Utility',
    intentUri: 'https://play.google.com/store',
    universalUrl: 'https://play.google.com/store',
    packageName: 'com.android.vending',
    description: 'Google Play Store',
  },
  settings: {
    name: 'Smartphone Settings',
    category: 'Utility',
    intentUri: 'https://myaccount.google.com',
    universalUrl: 'https://myaccount.google.com',
    packageName: 'com.android.settings',
    description: 'Android System Settings',
  },
  wifi: {
    name: 'Wi-Fi Settings',
    category: 'Utility',
    intentUri: 'https://speedtest.net',
    universalUrl: 'https://speedtest.net',
    packageName: 'com.android.settings',
    description: 'Wi-Fi Network Settings',
  },
  'wi-fi': {
    name: 'Wi-Fi Settings',
    category: 'Utility',
    intentUri: 'https://speedtest.net',
    universalUrl: 'https://speedtest.net',
    packageName: 'com.android.settings',
    description: 'Wi-Fi Network Settings',
  },
  bluetooth: {
    name: 'Bluetooth Settings',
    category: 'Utility',
    intentUri: 'https://myaccount.google.com',
    universalUrl: 'https://myaccount.google.com',
    packageName: 'com.android.settings',
    description: 'Bluetooth Device Settings',
  },
  sound: {
    name: 'Sound Settings',
    category: 'Utility',
    intentUri: 'https://myaccount.google.com',
    universalUrl: 'https://myaccount.google.com',
    packageName: 'com.android.settings',
    description: 'Audio & Volume Settings',
  },
  display: {
    name: 'Display Settings',
    category: 'Utility',
    intentUri: 'https://myaccount.google.com',
    universalUrl: 'https://myaccount.google.com',
    packageName: 'com.android.settings',
    description: 'Screen & Brightness Settings',
  },
};

// --- WINDOWS APPS REGISTRY ---
export const WINDOWS_APPS_REGISTRY: Record<string, WindowsAppConfig> = {
  chrome: {
    name: 'Google Chrome',
    category: 'Utility',
    protocolUri: 'googlechrome:',
    webFallback: 'https://www.google.com',
    description: 'Google Chrome Web Browser',
  },
  'google chrome': {
    name: 'Google Chrome',
    category: 'Utility',
    protocolUri: 'googlechrome:',
    webFallback: 'https://www.google.com',
    description: 'Google Chrome Web Browser',
  },
  edge: {
    name: 'Microsoft Edge',
    category: 'Utility',
    protocolUri: 'microsoft-edge:https://www.bing.com',
    webFallback: 'https://www.microsoft.com/edge',
    description: 'Microsoft Edge Web Browser',
  },
  'microsoft edge': {
    name: 'Microsoft Edge',
    category: 'Utility',
    protocolUri: 'microsoft-edge:https://www.bing.com',
    webFallback: 'https://www.microsoft.com/edge',
    description: 'Microsoft Edge Web Browser',
  },
  notepad: {
    name: 'Notepad',
    category: 'System',
    protocolUri: 'notepad:',
    webFallback: 'https://notepad.js.org',
    description: 'Windows text editor',
  },
  calculator: {
    name: 'Calculator',
    category: 'System',
    protocolUri: 'calculator:',
    webFallback: 'https://calculator.net',
    description: 'Windows Calculator app',
  },
  calc: {
    name: 'Calculator',
    category: 'System',
    protocolUri: 'calculator:',
    webFallback: 'https://calculator.net',
    description: 'Windows Calculator app',
  },
  paint: {
    name: 'Paint',
    category: 'System',
    protocolUri: 'mspaint:',
    webFallback: 'https://jspaint.app',
    description: 'Microsoft Paint drawing application',
  },
  explorer: {
    name: 'File Explorer',
    category: 'System',
    protocolUri: 'search-ms:',
    webFallback: 'https://drive.google.com',
    description: 'Windows File Explorer directory',
  },
  'file explorer': {
    name: 'File Explorer',
    category: 'System',
    protocolUri: 'search-ms:',
    webFallback: 'https://drive.google.com',
    description: 'Windows File Explorer directory',
  },
  store: {
    name: 'Microsoft Store',
    category: 'Utility',
    protocolUri: 'ms-windows-store://home',
    webFallback: 'https://apps.microsoft.com',
    description: 'Microsoft Windows Store',
  },
  'microsoft store': {
    name: 'Microsoft Store',
    category: 'Utility',
    protocolUri: 'ms-windows-store://home',
    webFallback: 'https://apps.microsoft.com',
    description: 'Microsoft Windows Store',
  },
  spotify: {
    name: 'Spotify',
    category: 'Entertainment',
    protocolUri: 'spotify:',
    webFallback: 'https://open.spotify.com',
    description: 'Spotify Music player for Windows',
  },
  youtube: {
    name: 'YouTube',
    category: 'Entertainment',
    protocolUri: 'https://www.youtube.com',
    webFallback: 'https://www.youtube.com',
    description: 'YouTube Video Streaming',
  },
  cmd: {
    name: 'Command Prompt',
    category: 'Developer',
    protocolUri: 'cmd:',
    webFallback: 'https://copy.sh/v86/?profile=windows2000',
    description: 'Windows Command line console',
  },
  terminal: {
    name: 'Windows Terminal',
    category: 'Developer',
    protocolUri: 'wt:',
    webFallback: 'https://vscode.dev',
    description: 'Modern Windows Terminal / PowerShell',
  },
  vscode: {
    name: 'Visual Studio Code',
    category: 'Developer',
    protocolUri: 'vscode://',
    webFallback: 'https://vscode.dev',
    description: 'Visual Studio Code editor',
  },
  whatsapp: {
    name: 'WhatsApp',
    category: 'Social',
    protocolUri: 'whatsapp:',
    webFallback: 'https://web.whatsapp.com',
    description: 'WhatsApp Desktop & Web chat',
  },
  'whatsapp web': {
    name: 'WhatsApp Web',
    category: 'Social',
    protocolUri: 'https://web.whatsapp.com',
    webFallback: 'https://web.whatsapp.com',
    description: 'WhatsApp Web chat',
  },
  instagram: {
    name: 'Instagram',
    category: 'Social',
    protocolUri: 'https://www.instagram.com',
    webFallback: 'https://www.instagram.com',
    description: 'Instagram Web & App',
  },
  telegram: {
    name: 'Telegram',
    category: 'Social',
    protocolUri: 'tg:',
    webFallback: 'https://web.telegram.org',
    description: 'Telegram Messenger',
  },
  discord: {
    name: 'Discord',
    category: 'Social',
    protocolUri: 'discord:',
    webFallback: 'https://discord.com/app',
    description: 'Discord Voice & Chat',
  },
  slack: {
    name: 'Slack',
    category: 'Productivity',
    protocolUri: 'slack:',
    webFallback: 'https://app.slack.com',
    description: 'Slack Workspaces',
  },
  github: {
    name: 'GitHub',
    category: 'Developer',
    protocolUri: 'https://github.com',
    webFallback: 'https://github.com',
    description: 'GitHub Repositories',
  },
  netflix: {
    name: 'Netflix',
    category: 'Entertainment',
    protocolUri: 'netflix:',
    webFallback: 'https://www.netflix.com',
    description: 'Netflix Movies & TV Shows',
  },
  'prime video': {
    name: 'Amazon Prime Video',
    category: 'Entertainment',
    protocolUri: 'https://www.primevideo.com',
    webFallback: 'https://www.primevideo.com',
    description: 'Prime Video Streaming',
  },
  gmail: {
    name: 'Gmail',
    category: 'Productivity',
    protocolUri: 'mailto:',
    webFallback: 'https://mail.google.com',
    description: 'Google Gmail Mailbox',
  },
  maps: {
    name: 'Google Maps',
    category: 'Navigation',
    protocolUri: 'https://maps.google.com',
    webFallback: 'https://maps.google.com',
    description: 'Google Maps & Navigation',
  },
  'google maps': {
    name: 'Google Maps',
    category: 'Navigation',
    protocolUri: 'https://maps.google.com',
    webFallback: 'https://maps.google.com',
    description: 'Google Maps & Navigation',
  },
  twitter: {
    name: 'X (Twitter)',
    category: 'Social',
    protocolUri: 'https://x.com',
    webFallback: 'https://x.com',
    description: 'X (Twitter) Feed',
  },
  x: {
    name: 'X (Twitter)',
    category: 'Social',
    protocolUri: 'https://x.com',
    webFallback: 'https://x.com',
    description: 'X (Twitter) Feed',
  },
  reddit: {
    name: 'Reddit',
    category: 'Social',
    protocolUri: 'https://www.reddit.com',
    webFallback: 'https://www.reddit.com',
    description: 'Reddit Communities',
  },
  word: {
    name: 'Microsoft Word',
    category: 'Productivity',
    protocolUri: 'ms-word:',
    webFallback: 'https://www.office.com/launch/word',
    description: 'Microsoft Word Documents',
  },
  excel: {
    name: 'Microsoft Excel',
    category: 'Productivity',
    protocolUri: 'ms-excel:',
    webFallback: 'https://www.office.com/launch/excel',
    description: 'Microsoft Excel Spreadsheets',
  },
  powerpoint: {
    name: 'Microsoft PowerPoint',
    category: 'Productivity',
    protocolUri: 'ms-powerpoint:',
    webFallback: 'https://www.office.com/launch/powerpoint',
    description: 'Microsoft PowerPoint Presentations',
  },
  zoom: {
    name: 'Zoom',
    category: 'Productivity',
    protocolUri: 'zoommtg:',
    webFallback: 'https://zoom.us',
    description: 'Zoom Meetings',
  },
  teams: {
    name: 'Microsoft Teams',
    category: 'Productivity',
    protocolUri: 'msteams:',
    webFallback: 'https://teams.microsoft.com',
    description: 'Microsoft Teams Workspace',
  },
  settings: {
    name: 'Windows Settings',
    category: 'System',
    protocolUri: 'ms-settings:',
    webFallback: 'https://myaccount.google.com',
    description: 'Windows 10/11 Settings panel',
  },
  wifi: {
    name: 'Windows Wi-Fi Settings',
    category: 'System',
    protocolUri: 'ms-settings:network-wifi',
    webFallback: 'https://speedtest.net',
    description: 'Windows Wi-Fi and Network settings',
  },
};

/**
 * Universal Multi-App Name Extractor
 */
export function extractAppsFromText(input: string): string[] {
  if (!input || typeof input !== 'string') return [];

  let text = input
    .toLowerCase()
    .replace(/^(please\s+)?(open|launch|start|run|chalao|kholo|show|play|execute|start up)\s+/i, '')
    .trim();

  const rawParts = text
    .split(/,|\band\b|\baur\b|\bwith\b|\s\+\s|\bthen\b|\bke\s+baad\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const matchedApps: string[] = [];

  const findDirectMatch = (str: string): string | null => {
    const clean = str.replace(/^(open|launch|start|run|chalao|kholo|please)\s+/i, '').trim();
    if (!clean) return null;

    if (SMARTPHONE_APPS_REGISTRY[clean]) return SMARTPHONE_APPS_REGISTRY[clean].name;
    if (WINDOWS_APPS_REGISTRY[clean]) return WINDOWS_APPS_REGISTRY[clean].name;

    for (const [key, cfg] of Object.entries(SMARTPHONE_APPS_REGISTRY)) {
      if (clean === key || clean === cfg.name.toLowerCase()) return cfg.name;
    }
    for (const [key, cfg] of Object.entries(WINDOWS_APPS_REGISTRY)) {
      if (clean === key || clean === cfg.name.toLowerCase()) return cfg.name;
    }
    return null;
  };

  if (rawParts.length > 1) {
    for (const part of rawParts) {
      const match = findDirectMatch(part);
      if (match && !matchedApps.includes(match)) {
        matchedApps.push(match);
      } else if (part.length > 1) {
        const subMatches = scanGreedyAppKeywords(part);
        for (const sm of subMatches) {
          if (!matchedApps.includes(sm)) matchedApps.push(sm);
        }
      }
    }
    if (matchedApps.length > 0) return matchedApps;
  }

  const greedyMatches = scanGreedyAppKeywords(text);
  if (greedyMatches.length > 0) return greedyMatches;

  return [text];
}

function scanGreedyAppKeywords(text: string): string[] {
  const combined = { ...SMARTPHONE_APPS_REGISTRY, ...WINDOWS_APPS_REGISTRY };
  const sortedKeywords = Object.keys(combined).sort((a, b) => {
    const wordsA = a.split(' ').length;
    const wordsB = b.split(' ').length;
    if (wordsB !== wordsA) return wordsB - wordsA;
    return b.length - a.length;
  });

  const found: string[] = [];
  let remaining = ` ${text.toLowerCase()} `;

  for (const kw of sortedKeywords) {
    if (kw.length < 3) continue;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s|[.,;])${escaped}($|\\s|[.,;])`, 'i');

    if (regex.test(remaining)) {
      const appName = combined[kw].name;
      if (!found.includes(appName)) {
        found.push(appName);
      }
      remaining = remaining.replace(new RegExp(escaped, 'gi'), ' ');
    }
  }

  return found;
}

export class DeviceActionBridge {
  private contacts: Contact[] = [...DEFAULT_DEVICE_CONTACTS];
  private calendarEvents: CalendarEvent[] = [];
  private reminders: DeviceReminder[] = [];
  private notes: DeviceNote[] = [];
  private notifications: DeviceNotification[] = [];
  private locationInfo: DeviceLocationInfo = {
    city: 'Detecting...',
    region: '',
    country: '',
    timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
    timeZoneOffset: typeof Date !== 'undefined' ? -new Date().getTimezoneOffset() / 60 : 0,
    formattedTime: new Date().toLocaleTimeString(),
    formattedDate: new Date().toLocaleDateString(),
  };
  private mediaState: MediaState = {
    isPlaying: false,
    trackTitle: 'Tum Hi Ho',
    artist: 'Arijit Singh',
    album: 'Aashiqui 2',
    volume: 75,
    isMuted: false,
  };

  private currentUploadedFile: { name: string; type: string; mimeType: string } | null = null;
  private forcedPlatform: 'auto' | 'windows' | 'android' = 'auto';
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadStateFromStorage();
    this.initLocationAndTimezone();
  }

  private loadStateFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const savedEvents = localStorage.getItem('iris_calendar_events');
      this.calendarEvents = savedEvents ? JSON.parse(savedEvents) : [...DEFAULT_CALENDAR_EVENTS];

      const savedReminders = localStorage.getItem('iris_reminders');
      this.reminders = savedReminders ? JSON.parse(savedReminders) : [...DEFAULT_REMINDERS];

      const savedNotes = localStorage.getItem('iris_notes');
      this.notes = savedNotes ? JSON.parse(savedNotes) : [...DEFAULT_NOTES];

      const savedNotifs = localStorage.getItem('iris_notifications');
      this.notifications = savedNotifs ? JSON.parse(savedNotifs) : [...DEFAULT_NOTIFICATIONS];
    } catch (e) {
      console.warn('Could not parse saved storage in DeviceActionBridge:', e);
      this.calendarEvents = [...DEFAULT_CALENDAR_EVENTS];
      this.reminders = [...DEFAULT_REMINDERS];
      this.notes = [...DEFAULT_NOTES];
      this.notifications = [...DEFAULT_NOTIFICATIONS];
    }
  }

  private saveStateToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem('iris_calendar_events', JSON.stringify(this.calendarEvents));
      localStorage.setItem('iris_reminders', JSON.stringify(this.reminders));
      localStorage.setItem('iris_notes', JSON.stringify(this.notes));
      localStorage.setItem('iris_notifications', JSON.stringify(this.notifications));
    } catch (e) {
      console.warn('Error saving state to localStorage:', e);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.saveStateToStorage();
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
  }

  setUploadedFile(file: { name: string; type: string; mimeType: string } | null): void {
    this.currentUploadedFile = file;
  }

  getUploadedFile() {
    return this.currentUploadedFile;
  }

  setPlatformOverride(platform: 'auto' | 'windows' | 'android'): void {
    this.forcedPlatform = platform;
    console.log(`💻 [DeviceActionBridge] Platform override set to: ${platform}`);
  }

  getForcedPlatform(): 'auto' | 'windows' | 'android' {
    return this.forcedPlatform;
  }

  isWindows(): boolean {
    if (this.forcedPlatform === 'windows') return true;
    if (this.forcedPlatform === 'android') return false;
    if (typeof window === 'undefined') return false;
    const ua = window.navigator?.userAgent?.toLowerCase() || '';
    const platform = window.navigator?.platform?.toLowerCase() || '';
    return (ua.includes('windows') || platform.includes('win') || ua.includes('win64') || ua.includes('win32')) && !ua.includes('mobile');
  }

  isSmartphone(): boolean {
    if (this.forcedPlatform === 'android') return true;
    if (this.forcedPlatform === 'windows') return false;
    if (typeof window === 'undefined') return false;
    const ua = window.navigator?.userAgent?.toLowerCase() || '';
    const isTouch = typeof window.navigator?.maxTouchPoints === 'number' && window.navigator.maxTouchPoints > 1;
    return (
      ua.includes('android') ||
      ua.includes('iphone') ||
      ua.includes('ipad') ||
      ua.includes('mobile') ||
      (isTouch && !ua.includes('windows'))
    );
  }

  isAndroidNative(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).AndroidBridge ||
      (window as any).IrisNativeBridge ||
      (window as any).Android ||
      (window as any).Capacitor?.isNativePlatform?.()
    );
  }

  getEnvironmentName(): 'Windows PC' | 'Android Smartphone' | 'Universal Mobile Web' {
    if (this.isWindows()) return 'Windows PC';
    if (this.isSmartphone()) return 'Android Smartphone';
    return 'Universal Mobile Web';
  }

  getContacts(): Contact[] {
    return this.contacts;
  }

  addContact(contact: Contact) {
    this.contacts.push(contact);
  }

  findContact(query: string): { exact: Contact | null; matches: Contact[] } {
    const q = query.toLowerCase().trim();
    if (!q) return { exact: null, matches: [] };

    const matches = this.contacts.filter((c) => {
      const name = c.name.toLowerCase();
      const rel = (c.relation || '').toLowerCase();
      const insta = (c.instagram || '').toLowerCase();
      return (
        name === q ||
        name.includes(q) ||
        q.includes(name) ||
        (rel && (rel === q || rel.includes(q) || q.includes(rel))) ||
        (insta && (insta === q || insta.includes(q)))
      );
    });

    const exact = matches.length === 1 ? matches[0] : null;
    return { exact, matches };
  }

  // --- LOCATION & TIMEZONE SERVICES ---
  public async initLocationAndTimezone(): Promise<DeviceLocationInfo> {
    const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
    const now = new Date();
    const offset = -now.getTimezoneOffset() / 60;

    let city = 'Local Region';
    // Derive sensible default city from timezone name (e.g. Asia/Kolkata -> Kolkata, America/New_York -> New York)
    if (tz.includes('/')) {
      const cityRaw = tz.split('/')[1].replace(/_/g, ' ');
      city = cityRaw;
    }

    this.locationInfo = {
      city,
      timezone: tz,
      timeZoneOffset: offset,
      formattedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      formattedDate: now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }),
    };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.locationInfo.latitude = position.coords.latitude;
          this.locationInfo.longitude = position.coords.longitude;
          try {
            // Fast reverse geocoding via OpenStreetMap Nominatim for real city name
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10`
            );
            if (res.ok) {
              const data = await res.json();
              const foundCity = data.address?.city || data.address?.town || data.address?.state_district || data.address?.state;
              if (foundCity) {
                this.locationInfo.city = foundCity;
                this.locationInfo.region = data.address?.state;
                this.locationInfo.country = data.address?.country;
              }
            }
          } catch (_) {}
          this.notify();
        },
        () => {
          // Geolocation permission denied or unavailable, timezone city is preserved
        },
        { timeout: 5000 }
      );
    }

    return this.locationInfo;
  }

  getLocationInfo(): DeviceLocationInfo {
    const now = new Date();
    this.locationInfo.formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.locationInfo.formattedDate = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    return this.locationInfo;
  }

  getUserLocation(): ToolExecutionResult {
    const info = this.getLocationInfo();
    console.log(`📍 [DeviceActionBridge] getUserLocation ->`, info);
    return {
      success: true,
      action: 'getUserLocation',
      message: `Location: ${info.city || 'Detected'}, Timezone: ${info.timezone} (UTC${info.timeZoneOffset >= 0 ? '+' : ''}${info.timeZoneOffset}), Current Time: ${info.formattedTime} on ${info.formattedDate}.`,
      data: info,
      platform: this.isSmartphone() ? 'android' : (this.isWindows() ? 'windows' : 'universal'),
    };
  }

  // --- CALENDAR & MEETINGS MANAGEMENT ---
  getCalendarEvents(): CalendarEvent[] {
    return this.calendarEvents;
  }

  scheduleMeeting(
    title: string,
    date?: string,
    startTime?: string,
    endTime?: string,
    description?: string,
    location?: string,
    attendees?: string | string[]
  ): ToolExecutionResult {
    const eventTitle = (title || 'Meeting').trim();
    const now = new Date();

    // 1. Resolve date
    let targetDate = now.toISOString().split('T')[0];
    const rawDate = (date || 'today').toLowerCase().trim();

    if (rawDate.includes('tomorrow') || rawDate.includes('kal')) {
      const tomorrow = new Date(now.getTime() + 86400000);
      targetDate = tomorrow.toISOString().split('T')[0];
    } else if (rawDate.includes('today') || rawDate.includes('aaj')) {
      targetDate = now.toISOString().split('T')[0];
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      targetDate = rawDate;
    } else if (rawDate.includes('monday') || rawDate.includes('tuesday') || rawDate.includes('wednesday') || rawDate.includes('thursday') || rawDate.includes('friday') || rawDate.includes('saturday') || rawDate.includes('sunday')) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.findIndex((d) => rawDate.includes(d));
      if (targetDay >= 0) {
        const currentDay = now.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        const nextDate = new Date(now.getTime() + diff * 86400000);
        targetDate = nextDate.toISOString().split('T')[0];
      }
    }

    // 2. Resolve start & end times
    let cleanStart = (startTime || '10:00').trim();
    if (/^\d{1,2}(:\d{2})?\s*(am|pm)$/i.test(cleanStart)) {
      const match = cleanStart.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2] || '00';
        const isPm = match[3].toLowerCase() === 'pm';
        if (isPm && h < 12) h += 12;
        if (!isPm && h === 12) h = 0;
        cleanStart = `${h.toString().padStart(2, '0')}:${m}`;
      }
    } else if (/^\d{1,2}$/.test(cleanStart)) {
      cleanStart = `${cleanStart.padStart(2, '0')}:00`;
    }

    let cleanEnd = endTime?.trim() || '';
    if (!cleanEnd) {
      const [h, m] = cleanStart.split(':').map((x) => parseInt(x, 10) || 0);
      const endH = (h + 1) % 24;
      cleanEnd = `${endH.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
    }

    // Parse attendees
    let attendeeList: string[] = [];
    if (Array.isArray(attendees)) {
      attendeeList = attendees;
    } else if (typeof attendees === 'string' && attendees.trim()) {
      attendeeList = attendees.split(/,|and|aur/i).map((s) => s.trim()).filter(Boolean);
    }

    // 3. Generate Google Calendar Render URL
    const startDateClean = targetDate.replace(/-/g, '');
    const startTimeClean = cleanStart.replace(/:/g, '') + '00';
    const endTimeClean = cleanEnd.replace(/:/g, '') + '00';
    const datesParam = `${startDateClean}T${startTimeClean}/${startDateClean}T${endTimeClean}`;

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${datesParam}&details=${encodeURIComponent(description || `Scheduled by Iris Virtual Assistant for ${attendeeList.join(', ')}`)}&location=${encodeURIComponent(location || 'Virtual / Online')}`;

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: eventTitle,
      date: targetDate,
      startTime: cleanStart,
      endTime: cleanEnd,
      description: description || `Scheduled by Iris with ${attendeeList.join(', ') || 'team'}`,
      location: location || 'Google Meet',
      attendees: attendeeList,
      googleCalendarUrl: gcalUrl,
      createdAt: Date.now(),
    };

    this.calendarEvents.unshift(newEvent);
    this.notify();

    console.log(`📅 [DeviceActionBridge] Scheduled meeting:`, newEvent);

    // 4. Android Bridge integration
    if (typeof window !== 'undefined' && (window as any).AndroidBridge && typeof (window as any).AndroidBridge.postMessage === 'function') {
      try {
        (window as any).AndroidBridge.postMessage(JSON.stringify({
          action: 'CREATE_CALENDAR_EVENT',
          title: eventTitle,
          date: targetDate,
          startTime: cleanStart,
          endTime: cleanEnd,
          description: description || '',
          location: location || 'Google Meet',
        }));
      } catch (err) {
        console.warn('AndroidBridge calendar postMessage error:', err);
      }
    }

    return {
      success: true,
      action: 'scheduleMeeting',
      message: `Scheduled "${eventTitle}" on ${targetDate} from ${cleanStart} to ${cleanEnd}.`,
      data: {
        event: newEvent,
        url: gcalUrl,
        targetUrl: gcalUrl,
        platform: this.isSmartphone() ? 'android' : (this.isWindows() ? 'windows' : 'universal'),
      },
      platform: this.isSmartphone() ? 'android' : (this.isWindows() ? 'windows' : 'universal'),
    };
  }

  listCalendarEvents(dateQuery?: string): ToolExecutionResult {
    const q = (dateQuery || 'all').toLowerCase().trim();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

    let filtered = [...this.calendarEvents];

    if (q.includes('today') || q.includes('aaj')) {
      filtered = filtered.filter((e) => e.date === todayStr);
    } else if (q.includes('tomorrow') || q.includes('kal')) {
      filtered = filtered.filter((e) => e.date === tomorrowStr);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
      filtered = filtered.filter((e) => e.date === q);
    }

    filtered.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

    const summary = filtered.length > 0
      ? filtered.map((e) => `• ${e.title} (${e.date} at ${e.startTime}) [${e.location || 'Meet'}]`).join('\n')
      : 'No scheduled meetings found for the specified date.';

    return {
      success: true,
      action: 'listCalendarEvents',
      message: `Found ${filtered.length} meeting(s):\n${summary}`,
      data: { events: filtered, count: filtered.length },
    };
  }

  deleteCalendarEvent(eventId: string): ToolExecutionResult {
    const initialLen = this.calendarEvents.length;
    const target = this.calendarEvents.find((e) => e.id === eventId || e.title.toLowerCase().includes(eventId.toLowerCase()));
    if (!target) {
      return { success: false, action: 'deleteCalendarEvent', error: `Meeting "${eventId}" not found.` };
    }
    this.calendarEvents = this.calendarEvents.filter((e) => e.id !== target.id);
    this.notify();
    return {
      success: true,
      action: 'deleteCalendarEvent',
      message: `Cancelled meeting "${target.title}".`,
      data: { deletedId: target.id },
    };
  }

  // --- REMINDERS MANAGEMENT ---
  getReminders(): DeviceReminder[] {
    return this.reminders;
  }

  setReminder(title: string, datetime: string, notes?: string, priority?: 'low' | 'medium' | 'high'): ToolExecutionResult {
    const remTitle = (title || 'Reminder').trim();
    const dt = (datetime || 'in 15 minutes').trim();
    const now = Date.now();

    let dueTimestamp = now + 15 * 60 * 1000;
    const lowerDt = dt.toLowerCase();

    if (lowerDt.includes('minute') || lowerDt.includes('min')) {
      const match = lowerDt.match(/(\d+)\s*(?:minute|min)/);
      if (match) dueTimestamp = now + parseInt(match[1], 10) * 60 * 1000;
    } else if (lowerDt.includes('hour') || lowerDt.includes('ghante')) {
      const match = lowerDt.match(/(\d+)\s*(?:hour|ghante)/);
      if (match) dueTimestamp = now + parseInt(match[1], 10) * 3600 * 1000;
    } else if (lowerDt.includes('tomorrow') || lowerDt.includes('kal')) {
      dueTimestamp = now + 24 * 3600 * 1000;
    }

    const newReminder: DeviceReminder = {
      id: `rem-${Date.now()}`,
      title: remTitle,
      datetime: dt,
      dueTimestamp,
      notes,
      priority: priority || 'medium',
      completed: false,
      createdAt: Date.now(),
    };

    this.reminders.unshift(newReminder);
    this.notify();

    // Play chime sound or trigger Web Notification if supported
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`Iris Reminder Set: ${remTitle}`, { body: `Scheduled for: ${dt}` });
      } catch (_) {}
    }

    return {
      success: true,
      action: 'setReminder',
      message: `Set reminder: "${remTitle}" for ${dt}.`,
      data: { reminder: newReminder },
    };
  }

  listReminders(status?: 'all' | 'pending' | 'completed'): ToolExecutionResult {
    let list = [...this.reminders];
    if (status === 'pending') list = list.filter((r) => !r.completed);
    if (status === 'completed') list = list.filter((r) => r.completed);

    const summary = list.length > 0
      ? list.map((r) => `• [${r.completed ? 'DONE' : 'PENDING'}] ${r.title} (${r.datetime})`).join('\n')
      : 'No reminders found.';

    return {
      success: true,
      action: 'listReminders',
      message: summary,
      data: { reminders: list, count: list.length },
    };
  }

  completeReminder(reminderId: string): ToolExecutionResult {
    const rem = this.reminders.find((r) => r.id === reminderId || r.title.toLowerCase().includes(reminderId.toLowerCase()));
    if (!rem) return { success: false, action: 'completeReminder', error: `Reminder "${reminderId}" not found.` };
    rem.completed = true;
    this.notify();
    return {
      success: true,
      action: 'completeReminder',
      message: `Marked reminder "${rem.title}" as completed!`,
      data: { reminder: rem },
    };
  }

  deleteReminder(reminderId: string): ToolExecutionResult {
    const rem = this.reminders.find((r) => r.id === reminderId || r.title.toLowerCase().includes(reminderId.toLowerCase()));
    if (!rem) return { success: false, action: 'deleteReminder', error: `Reminder "${reminderId}" not found.` };
    this.reminders = this.reminders.filter((r) => r.id !== rem.id);
    this.notify();
    return {
      success: true,
      action: 'deleteReminder',
      message: `Deleted reminder "${rem.title}".`,
      data: { deletedId: rem.id },
    };
  }

  // --- NOTES MANAGEMENT ---
  getNotes(): DeviceNote[] {
    return this.notes;
  }

  createNote(title: string, content: string, category?: string, tags?: string | string[]): ToolExecutionResult {
    const noteTitle = (title || 'New Note').trim();
    const noteContent = (content || '').trim();

    let tagList: string[] = [];
    if (Array.isArray(tags)) tagList = tags;
    else if (typeof tags === 'string' && tags.trim()) {
      tagList = tags.split(/,| /).map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
    }

    const newNote: DeviceNote = {
      id: `note-${Date.now()}`,
      title: noteTitle,
      content: noteContent,
      category: (category as any) || 'general',
      tags: tagList,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.notes.unshift(newNote);
    this.notify();

    console.log(`📝 [DeviceActionBridge] Created note:`, newNote);

    return {
      success: true,
      action: 'createNote',
      message: `Created note "${noteTitle}".`,
      data: { note: newNote },
    };
  }

  listNotes(query?: string, category?: string): ToolExecutionResult {
    let list = [...this.notes];
    if (category) {
      list = list.filter((n) => n.category.toLowerCase() === category.toLowerCase());
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }

    const summary = list.length > 0
      ? list.map((n) => `• ${n.title}: ${n.content.slice(0, 60)}...`).join('\n')
      : 'No notes found.';

    return {
      success: true,
      action: 'listNotes',
      message: summary,
      data: { notes: list, count: list.length },
    };
  }

  deleteNote(noteId: string): ToolExecutionResult {
    const note = this.notes.find((n) => n.id === noteId || n.title.toLowerCase().includes(noteId.toLowerCase()));
    if (!note) return { success: false, action: 'deleteNote', error: `Note "${noteId}" not found.` };
    this.notes = this.notes.filter((n) => n.id !== note.id);
    this.notify();
    return {
      success: true,
      action: 'deleteNote',
      message: `Deleted note "${note.title}".`,
      data: { deletedId: note.id },
    };
  }

  updateNote(noteId: string, title?: string, content?: string): ToolExecutionResult {
    const note = this.notes.find((n) => n.id === noteId || n.title.toLowerCase().includes(noteId.toLowerCase()));
    if (!note) return { success: false, action: 'updateNote', error: `Note "${noteId}" not found.` };
    if (title) note.title = title.trim();
    if (content) note.content = content.trim();
    note.updatedAt = Date.now();
    this.notify();
    return {
      success: true,
      action: 'updateNote',
      message: `Updated note "${note.title}".`,
      data: { note },
    };
  }

  // --- NOTIFICATIONS MANAGEMENT & VOICE REPLY ---
  getNotifications(): DeviceNotification[] {
    return this.notifications;
  }

  readNotifications(filterApp?: string, unreadOnly?: boolean): ToolExecutionResult {
    let list = [...this.notifications];
    if (filterApp && filterApp !== 'all') {
      const f = filterApp.toLowerCase().trim();
      list = list.filter((n) => n.app.toLowerCase().includes(f) || n.appName.toLowerCase().includes(f));
    }
    if (unreadOnly) {
      list = list.filter((n) => !n.read);
    }

    // Mark retrieved notifications as read
    list.forEach((n) => {
      n.read = true;
    });
    this.notify();

    const summary = list.length > 0
      ? list.map((n) => `• [${n.appName}] From ${n.sender}: "${n.message}"`).join('\n')
      : 'You have no new notifications right now!';

    return {
      success: true,
      action: 'readNotifications',
      message: summary,
      data: { notifications: list, count: list.length },
    };
  }

  replyNotification(notificationId: string, replyText: string): ToolExecutionResult {
    const notif = this.notifications.find((n) => n.id === notificationId || n.sender.toLowerCase().includes(notificationId.toLowerCase()) || n.appName.toLowerCase().includes(notificationId.toLowerCase()));
    if (!notif) {
      return { success: false, action: 'replyNotification', error: `Notification "${notificationId}" not found.` };
    }

    const text = (replyText || '').trim();
    if (!text) {
      return { success: false, action: 'replyNotification', error: 'Reply text cannot be empty.' };
    }

    if (!notif.replies) notif.replies = [];
    notif.replies.push({
      sender: 'You (via Iris)',
      message: text,
      timestamp: Date.now(),
    });
    this.notify();

    console.log(`💬 [DeviceActionBridge] Replied to notification (${notif.appName}) from ${notif.sender}: "${text}"`);

    // Android Native Bridge
    if (typeof window !== 'undefined' && (window as any).AndroidBridge && typeof (window as any).AndroidBridge.postMessage === 'function') {
      try {
        (window as any).AndroidBridge.postMessage(JSON.stringify({
          action: 'REPLY_NOTIFICATION',
          notificationId: notif.id,
          app: notif.app,
          sender: notif.sender,
          message: text,
        }));
      } catch (err) {
        console.warn('AndroidBridge reply error:', err);
      }
    }

    // Fallback: Dispatch to messaging deep link if it's WhatsApp/Gmail
    if (notif.app === 'whatsapp') {
      this.sendWhatsAppMessage(notif.sender, text);
    }

    return {
      success: true,
      action: 'replyNotification',
      message: `Sent reply to ${notif.sender} on ${notif.appName}: "${text}"`,
      data: { notification: notif, reply: text },
    };
  }

  addNotification(notif: Omit<DeviceNotification, 'id' | 'timestamp' | 'read'>): DeviceNotification {
    const newNotif: DeviceNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: Date.now(),
      read: false,
    };
    this.notifications.unshift(newNotif);
    this.notify();
    return newNotif;
  }

  // --- MEDIA & MUSIC CONTROL ---
  getMediaState(): MediaState {
    return this.mediaState;
  }

  controlMedia(action: string, query?: string, volume?: number): ToolExecutionResult {
    const act = (action || 'toggle').toLowerCase().trim();
    console.log(`🎵 [DeviceActionBridge] controlMedia -> Action: "${act}", Query: "${query}", Volume: ${volume}`);

    let msg = '';

    switch (act) {
      case 'play':
        this.mediaState.isPlaying = true;
        if (query) {
          this.mediaState.trackTitle = query;
          this.mediaState.artist = 'YouTube / Spotify Music';
          this.searchApp('Spotify', query);
        }
        msg = `Playing ${this.mediaState.trackTitle} by ${this.mediaState.artist}.`;
        break;

      case 'pause':
      case 'stop':
        this.mediaState.isPlaying = false;
        msg = 'Media playback paused.';
        break;

      case 'toggle':
        this.mediaState.isPlaying = !this.mediaState.isPlaying;
        msg = this.mediaState.isPlaying ? `Playing ${this.mediaState.trackTitle}.` : 'Media playback paused.';
        break;

      case 'next':
        this.mediaState.isPlaying = true;
        this.mediaState.trackTitle = 'Next Track (Recommended)';
        msg = 'Skipped to next track.';
        break;

      case 'previous':
      case 'prev':
        this.mediaState.isPlaying = true;
        msg = 'Playing previous track.';
        break;

      case 'volume_up':
        this.mediaState.volume = Math.min(100, this.mediaState.volume + 15);
        this.mediaState.isMuted = false;
        msg = `Volume increased to ${this.mediaState.volume}%.`;
        break;

      case 'volume_down':
        this.mediaState.volume = Math.max(0, this.mediaState.volume - 15);
        msg = `Volume decreased to ${this.mediaState.volume}%.`;
        break;

      case 'mute':
        this.mediaState.isMuted = true;
        msg = 'Audio muted.';
        break;

      case 'unmute':
        this.mediaState.isMuted = false;
        msg = 'Audio unmuted.';
        break;

      default:
        if (query) {
          this.mediaState.isPlaying = true;
          this.mediaState.trackTitle = query;
          this.searchApp('Spotify', query);
          msg = `Searching and playing "${query}" on Spotify.`;
        } else {
          msg = `Media action "${act}" applied.`;
        }
        break;
    }

    if (typeof volume === 'number' && !isNaN(volume)) {
      this.mediaState.volume = Math.max(0, Math.min(100, volume));
      msg += ` Volume set to ${this.mediaState.volume}%.`;
    }

    this.notify();

    // Android Native Bridge & MediaSession API
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = this.mediaState.isPlaying ? 'playing' : 'paused';
      } catch (_) {}
    }

    if (typeof window !== 'undefined' && (window as any).AndroidBridge && typeof (window as any).AndroidBridge.postMessage === 'function') {
      try {
        (window as any).AndroidBridge.postMessage(JSON.stringify({
          action: 'MEDIA_CONTROL',
          command: act,
          query: query || '',
          volume: this.mediaState.volume,
          isPlaying: this.mediaState.isPlaying,
        }));
      } catch (_) {}
    }

    return {
      success: true,
      action: 'controlMedia',
      message: msg,
      data: { mediaState: this.mediaState },
    };
  }

  /**
   * Safe Clickable <a> Dispatcher
   * Uses real <a> tag with target="_blank" and rel="noopener noreferrer"
   * to bypass iframe sandbox restrictions and launch deep links cleanly.
   */
  launchAnchorLink(uri: string, fallbackUrl?: string): boolean {
    console.log(`🚀 [DeviceActionBridge] Launching link: "${uri}" (fallback: "${fallbackUrl}")`);

    // 1. Check Android Native Bridge for APK wrapping
    if (typeof window !== 'undefined') {
      const androidBridge = (window as any).AndroidBridge || (window as any).IrisNativeBridge;
      if (androidBridge && typeof androidBridge.postMessage === 'function') {
        try {
          androidBridge.postMessage(JSON.stringify({
            action: 'OPEN_URL',
            url: uri,
            fallbackUrl: fallbackUrl || uri,
          }));
          return true;
        } catch (e) {
          console.warn('AndroidBridge.postMessage error:', e);
        }
      }
    }

    if (typeof window === 'undefined') return false;

    const target = uri || fallbackUrl || '';
    if (!target) return false;

    try {
      // Create and dispatch real clickable link element
      const link = document.createElement('a');
      link.href = target;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.position = 'fixed';
      link.style.top = '-1000px';
      link.style.left = '-1000px';
      link.style.width = '1px';
      link.style.height = '1px';
      link.style.opacity = '0.01';
      link.style.pointerEvents = 'none';
      document.body.appendChild(link);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

      setTimeout(() => {
        try {
          if (link.parentNode) {
            document.body.removeChild(link);
          }
        } catch (_) {}
      }, 1000);

      return true;
    } catch (err) {
      console.warn('Anchor dispatch notice, attempting direct window.open:', err);
      try {
        window.open(fallbackUrl || target, '_blank', 'noopener,noreferrer');
      } catch (_) {}
      return false;
    }
  }

  /**
   * Universal Structured Message Sender (WhatsApp, Instagram, Gmail)
   * Supports Android Native Bridge for APK wrapping + Pre-filled browser deep links fallback.
   */
  sendMessage(
    app: 'whatsapp' | 'instagram' | 'gmail' | string,
    recipient?: string,
    message?: string,
    subject?: string
  ): ToolExecutionResult {
    const targetApp = (app || 'whatsapp').toLowerCase().trim();
    const targetRecipient = (recipient || '').trim();
    const textContent = (message || '').trim();

    // If both recipient and message are empty, simply open the target app
    if (!targetRecipient && !textContent) {
      return this.openApp(targetApp);
    }

    console.log(`📱 [DeviceActionBridge] sendMessage -> App: ${targetApp}, Recipient: "${targetRecipient}", Message: "${textContent}"`);

    // 1. Android Native Bridge for APK wrapping
    if (typeof window !== 'undefined' && (window as any).AndroidBridge && typeof (window as any).AndroidBridge.postMessage === 'function') {
      try {
        (window as any).AndroidBridge.postMessage(JSON.stringify({
          action: "SEND_MESSAGE",
          app: targetApp,
          recipient: targetRecipient,
          message: textContent,
        }));

        return {
          success: true,
          action: `send_${targetApp}_message`,
          message: `Dispatched ${targetApp} message to ${targetRecipient || 'recipient'} via Android Native Bridge.`,
          data: {
            action: "SEND_MESSAGE",
            app: targetApp,
            recipient: targetRecipient,
            message: textContent,
            bridged: true,
            platform: 'android',
          },
          platform: 'android',
        };
      } catch (bridgeErr) {
        console.warn('AndroidBridge.postMessage error, falling back to web deep link:', bridgeErr);
      }
    }

    // 2. Web Browser Fallback Mode (Pre-filled deep links)
    let deepLink = '';
    let targetUrl = '';
    const ENCODED_MESSAGE = encodeURIComponent(textContent);

    if (targetApp.includes('whatsapp')) {
      const cleanDigits = targetRecipient.replace(/[^\d+]/g, '');
      let NUMBER = cleanDigits;
      if (NUMBER.length < 7 && targetRecipient) {
        const { exact } = this.findContact(targetRecipient);
        if (exact) NUMBER = exact.phone.replace(/[^\d+]/g, '');
      }

      if (NUMBER && textContent) {
        deepLink = `https://api.whatsapp.com/send?phone=${NUMBER}&text=${ENCODED_MESSAGE}`;
      } else if (NUMBER) {
        deepLink = `https://api.whatsapp.com/send?phone=${NUMBER}`;
      } else if (textContent) {
        deepLink = `https://api.whatsapp.com/send?text=${ENCODED_MESSAGE}`;
      } else {
        deepLink = `https://api.whatsapp.com/send`;
      }
      targetUrl = deepLink;
    } else if (targetApp.includes('gmail') || targetApp.includes('mail') || targetApp.includes('email')) {
      let RECIPIENT = targetRecipient;
      if (!RECIPIENT.includes('@') && targetRecipient) {
        const { exact } = this.findContact(targetRecipient);
        if (exact?.email) RECIPIENT = exact.email;
      }
      const encodedSubject = encodeURIComponent(subject || 'Message');
      if (RECIPIENT) {
        deepLink = `mailto:${RECIPIENT}?subject=${encodedSubject}&body=${ENCODED_MESSAGE}`;
        targetUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(RECIPIENT)}&su=${encodedSubject}&body=${ENCODED_MESSAGE}`;
      } else {
        deepLink = `mailto:?subject=${encodedSubject}&body=${ENCODED_MESSAGE}`;
        targetUrl = `https://mail.google.com/mail/u/0/#inbox`;
      }
    } else if (targetApp.includes('instagram') || targetApp.includes('insta')) {
      let USERNAME = targetRecipient.replace(/^@/, '').trim();
      if (USERNAME.includes(' ') && targetRecipient) {
        const { exact } = this.findContact(targetRecipient);
        if (exact?.instagram) USERNAME = exact.instagram;
      }
      if (USERNAME) {
        deepLink = `instagram://user?username=${encodeURIComponent(USERNAME)}`;
        targetUrl = `https://www.instagram.com/${encodeURIComponent(USERNAME)}/`;
      } else {
        deepLink = `instagram://app`;
        targetUrl = `https://www.instagram.com/`;
      }
    } else {
      deepLink = textContent
        ? `https://api.whatsapp.com/send?text=${ENCODED_MESSAGE}`
        : `https://api.whatsapp.com/send`;
      targetUrl = deepLink;
    }

    // Open via real clickable <a> tag with target="_blank" and rel="noopener noreferrer"
    this.launchAnchorLink(deepLink, targetUrl);

    return {
      success: true,
      action: `send_${targetApp}_message`,
      message: targetRecipient
        ? (textContent ? `Prepared ${targetApp} message for ${targetRecipient}: "${textContent}"` : `Opened ${targetApp} chat with ${targetRecipient}`)
        : `Opened ${targetApp}`,
      data: {
        app: targetApp,
        recipient: targetRecipient,
        message: textContent,
        uri: deepLink,
        url: targetUrl,
        targetUrl,
        platform: this.isSmartphone() ? 'android' : (this.isWindows() ? 'windows' : 'universal'),
      },
      platform: this.isSmartphone() ? 'android' : (this.isWindows() ? 'windows' : 'universal'),
    };
  }

  /**
   * WhatsApp Automation
   */
  sendWhatsAppMessage(recipient: string, message: string): ToolExecutionResult {
    return this.sendMessage('whatsapp', recipient, message);
  }

  openWhatsApp(phoneNumber?: string, message?: string): ToolExecutionResult {
    console.log(`📱 [DeviceActionBridge] openWhatsApp -> Phone/Contact: "${phoneNumber}", Message: "${message}"`);
    if (!phoneNumber && !message) {
      return this.openApp('whatsapp');
    }
    return this.sendMessage('whatsapp', phoneNumber || '', message || '');
  }

  resolveMobileAppConfig(appName: string): SmartphoneAppConfig | undefined {
    const clean = appName.toLowerCase().replace(/^(open|launch|start|run|chalao|kholo|show|please)\s+/i, '').trim();

    if (SMARTPHONE_APPS_REGISTRY[clean]) return SMARTPHONE_APPS_REGISTRY[clean];

    for (const [key, cfg] of Object.entries(SMARTPHONE_APPS_REGISTRY)) {
      if (clean === key || clean === cfg.name.toLowerCase()) return cfg;
    }

    for (const [key, cfg] of Object.entries(SMARTPHONE_APPS_REGISTRY)) {
      if (key.length >= 4 && (clean.startsWith(key) || clean.endsWith(key))) return cfg;
    }
    return undefined;
  }

  resolveWindowsAppConfig(appName: string): WindowsAppConfig | undefined {
    const clean = appName.toLowerCase().replace(/^(open|launch|start|run|chalao|kholo|show|please)\s+/i, '').trim();

    if (WINDOWS_APPS_REGISTRY[clean]) return WINDOWS_APPS_REGISTRY[clean];

    for (const [key, cfg] of Object.entries(WINDOWS_APPS_REGISTRY)) {
      if (clean === key || clean === cfg.name.toLowerCase()) return cfg;
    }

    for (const [key, cfg] of Object.entries(WINDOWS_APPS_REGISTRY)) {
      if (key.length >= 4 && (clean.startsWith(key) || clean.endsWith(key))) return cfg;
    }
    return undefined;
  }

  async executeTool(name: string, args: Record<string, any>): Promise<ToolExecutionResult> {
    console.log(`⚡ [DeviceActionBridge] executeTool -> ${name}:`, args);

    switch (name) {
      case 'sendMessage':
        return this.sendMessage(args.app || 'whatsapp', args.recipient, args.message, args.subject);

      case 'sendWhatsAppMessage':
        return this.sendWhatsAppMessage(args.recipient, args.message);

      case 'openWhatsApp':
        return this.openWhatsApp(args.phoneNumber, args.message);

      case 'searchApp':
        return this.searchApp(args.appName, args.query);

      case 'openApp':
        return this.openApp(args.appName, args.action, args.query);

      case 'openMultipleApps':
        return this.openMultipleApps(args.appNames || args.apps || [args.appName]);

      case 'closeApp':
        return this.closeApp(args.appName);

      case 'controlWindowsSetting':
        return this.controlWindowsSetting(args.settingName, args.action);

      case 'openUrl':
        return this.openUrl(args.url, args.title);

      case 'showLink':
        return this.showLink(args.title, args.url, args.description);

      case 'makeCall':
        return this.makeCall(args.phoneNumber);

      case 'callContact':
        return this.callContact(args.contactName);

      case 'sendSMS':
        return this.sendSMS(args.recipient || args.phoneNumber, args.message);

      case 'requestFileUpload':
        return {
          success: true,
          action: 'requestFileUpload',
          message: args.message || 'Upload popup opened on user screen.',
          data: { fileType: args.fileType || 'any' },
        };

      case 'openChatPanel':
      case 'openChat':
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('iris-open-chat'));
        }
        return {
          success: true,
          action: 'openChatPanel',
          message: 'Multimodal Chat Panel opened on user screen.',
          data: { open: true },
        };

      case 'requestScreenShare':
      case 'startScreenShare':
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('iris-request-screenshare'));
        }
        return {
          success: true,
          action: 'requestScreenShare',
          message: 'Initiated live screen view capture and mouse cursor tracking.',
          data: { active: true },
        };

      case 'inspectCurrentScreen':
      case 'getLiveScreenStatus':
        {
          const isSharing = screenShareService.getIsSharing();
          const cursor = screenShareService.getCursorPosition();
          return {
            success: true,
            action: 'inspectCurrentScreen',
            message: isSharing
              ? `Live screen sharing is active. Cursor is at X: ${cursor.x}%, Y: ${cursor.y}%.`
              : 'Screen sharing is currently inactive. Prompt user to click "See Screen" or start screen share.',
            data: {
              isSharing,
              cursor,
            },
          };
        }

      case 'highlightScreenArea':
        {
          const shape = screenAnnotationService.addHighlight({
            type: args.shape || 'rect',
            x: typeof args.x === 'number' ? args.x : 50,
            y: typeof args.y === 'number' ? args.y : 50,
            width: typeof args.width === 'number' ? args.width : 25,
            height: typeof args.height === 'number' ? args.height : 20,
            label: args.label || 'Iris Highlight',
            color: args.color || 'cyan',
            durationMs: (args.duration || 8) * 1000,
          });
          return {
            success: true,
            action: 'highlightScreenArea',
            message: `Highlighted screen area at X:${args.x}%, Y:${args.y}% with label "${args.label || 'Highlight'}".`,
            data: shape,
          };
        }

      case 'drawOnScreen':
        {
          const shape = screenAnnotationService.addHighlight({
            type: args.type || 'arrow',
            x: typeof args.endX === 'number' ? args.endX : (args.x || 50),
            y: typeof args.endY === 'number' ? args.endY : (args.y || 50),
            startX: typeof args.startX === 'number' ? args.startX : 20,
            startY: typeof args.startY === 'number' ? args.startY : 20,
            label: args.label || 'Iris Pointer',
            color: args.color || 'emerald',
            durationMs: (args.duration || 8) * 1000,
          });
          return {
            success: true,
            action: 'drawOnScreen',
            message: `Drawn on screen (${args.type || 'arrow'}) pointing to X:${args.x || args.endX}%, Y:${args.y || args.endY}%.`,
            data: shape,
          };
        }

      case 'clearScreenHighlights':
        screenAnnotationService.clearAll();
        return {
          success: true,
          action: 'clearScreenHighlights',
          message: 'Cleared all active screen highlights and annotations.',
          data: null,
        };

      case 'getUploadedFileInfo':
        if (this.currentUploadedFile) {
          return {
            success: true,
            action: 'getUploadedFileInfo',
            message: `User has uploaded file "${this.currentUploadedFile.name}" (${this.currentUploadedFile.type}).`,
            data: {
              fileName: this.currentUploadedFile.name,
              fileType: this.currentUploadedFile.type,
              mimeType: this.currentUploadedFile.mimeType,
            },
          };
        } else {
          return {
            success: false,
            action: 'getUploadedFileInfo',
            message: 'No file has been uploaded in this session yet.',
            data: null,
          };
        }

      case 'showGeneratedContent':
        return {
          success: true,
          action: 'showGeneratedContent',
          message: `Generated popup opened on user screen for "${args.title || 'Code/Prompt'}".`,
          data: {
            title: args.title || 'Generated by Iris',
            contentType: args.contentType || 'code',
            language: args.language || 'python',
            content: args.content || args.url || '',
            url: args.url,
            summary: args.summary || '',
          },
        };

      // --- CALENDAR MANAGEMENT ---
      case 'scheduleMeeting':
      case 'createCalendarEvent':
        return this.scheduleMeeting(
          args.title,
          args.date,
          args.startTime || args.time,
          args.endTime,
          args.description,
          args.location,
          args.attendees
        );

      case 'listCalendarEvents':
      case 'getCalendarSchedule':
        return this.listCalendarEvents(args.date || args.dateQuery);

      case 'deleteCalendarEvent':
        return this.deleteCalendarEvent(args.eventId || args.title);

      // --- LOCATION & TIMEZONE ---
      case 'getUserLocation':
      case 'getLocationInfo':
        return this.getUserLocation();

      // --- NOTIFICATIONS & VOICE REPLY ---
      case 'readNotifications':
        return this.readNotifications(args.filterApp || args.app, args.unreadOnly);

      case 'replyNotification':
        return this.replyNotification(args.notificationId || args.id || args.sender, args.replyText || args.message || args.reply);

      // --- MEDIA & MUSIC CONTROL ---
      case 'controlMedia':
        return this.controlMedia(args.action || args.command, args.query || args.trackOrQuery, args.volume);

      // --- REMINDERS MANAGEMENT ---
      case 'setReminder':
        return this.setReminder(args.title || args.message, args.datetime || args.time, args.notes, args.priority);

      case 'listReminders':
        return this.listReminders(args.status);

      case 'completeReminder':
        return this.completeReminder(args.reminderId || args.id || args.title);

      case 'deleteReminder':
        return this.deleteReminder(args.reminderId || args.id || args.title);

      // --- NOTES MANAGEMENT ---
      case 'createNote':
        return this.createNote(args.title, args.content || args.text, args.category, args.tags);

      case 'listNotes':
        return this.listNotes(args.query, args.category);

      case 'deleteNote':
        return this.deleteNote(args.noteId || args.id || args.title);

      case 'updateNote':
        return this.updateNote(args.noteId || args.id, args.title, args.content);

      // --- CROSS-SESSION MEMORY DATABASE & FILE RETRIEVAL ---
      case 'retrieveFile':
        return this.retrieveFile(args.fileName || args.file || args.query || args.name);

      case 'searchMemoryDatabase':
      case 'searchInteractionMemory':
      case 'searchMemory':
        return this.searchInteractionMemory(args.query || args.topic || args.term);

      case 'recordLearnedFact':
      case 'rememberFact':
        return this.recordLearnedFact(args.factKey || args.key || args.title, args.factValue || args.value || args.fact, args.category);

      case 'listMemories':
      case 'getMemoryDigest':
        return this.listMemories();

      // --- SPEAKER RECOGNITION & PERSON MEMORY FOLDERS ---
      case 'identifyOrRegisterSpeaker':
      case 'registerSpeaker':
        return this.identifyOrRegisterSpeaker(
          args.name || args.speakerName,
          args.gender,
          args.grammaticalStyle,
          args.relationship,
          args.pitchHz
        );

      case 'switchActiveSpeaker':
      case 'setActiveSpeaker':
        return this.switchActiveSpeaker(args.name || args.speakerName || args.speakerId);

      case 'savePersonMemory':
      case 'rememberForPerson':
        return this.savePersonMemory(
          args.key || args.title || args.memoryKey,
          args.value || args.memoryValue || args.detail,
          args.category,
          args.personName || args.folderId
        );

      case 'getPersonFolderDetails':
      case 'getPersonMemories':
        return this.getPersonFolderDetails(args.personName || args.name || args.folderId);

      case 'listAllPersonFolders':
      case 'listPersonFolders':
        return this.listAllPersonFolders();

      case 'getLiveAcousticSpeaker':
      case 'getLiveSpeaker':
      case 'whoIsSpeaking':
        return this.getLiveAcousticSpeaker();

      // --- GOOGLE MAPS & PRECISE LOCATION ---
      case 'openGoogleMap':
      case 'openMap':
      case 'showMap':
        return this.openGoogleMap({
          query: args.query || args.place || args.destination || args.address,
          category: args.category,
          zoom: args.zoom,
        });

      case 'getPreciseLocation':
      case 'getPreciseUserLocation':
        return await this.getPreciseLocation();

      case 'searchNearbyPlaces':
      case 'searchPlacesNearby':
        return await this.searchNearbyPlaces(
          args.query || args.place || 'restaurants',
          args.category,
          args.radiusMeters || args.radius
        );

      case 'getDirectionsAndNavigation':
      case 'navigate':
      case 'getDirections':
        return this.getDirectionsAndNavigation(
          args.destination || args.address || args.to,
          args.travelMode || args.mode || 'driving'
        );

      case 'controlGoogleMap':
      case 'setMapPOV':
      case 'changeMapView':
        return this.controlGoogleMap({
          mapType: args.mapType || args.viewMode || args.mode,
          zoom: args.zoom,
          center: args.center,
          query: args.query || args.place || args.location,
          traffic: args.traffic,
        });

      default:
        console.warn(`⚠️ [DeviceActionBridge] Unknown or unauthorized tool: ${name}`);
        return {
          success: false,
          action: name,
          error: `Action "${name}" is not supported.`,
        };
    }
  }

  /**
   * Cross-Session Memory: Retrieve a file directly by analyzing previous interaction history
   */
  retrieveFile(fileName: string): ToolExecutionResult {
    console.log(`📂 [DeviceActionBridge] retrieveFile: "${fileName}" via cross-session memory`);
    const result = crossSessionMemory.retrieveFile(fileName || 'PDF 1');

    if (result.success && result.file) {
      // Trigger opening Google Files app / Downloads directly
      this.openApp('Google Files', undefined, result.file.originalName);

      return {
        success: true,
        action: 'retrieveFile',
        message: result.message,
        data: {
          ...result.actionPayload,
          title: result.file.originalName,
          contentType: result.file.category === 'code' ? 'code' : 'document',
          content: `[FILE RETRIEVED FROM CROSS-SESSION MEMORY]\nFile: ${result.file.originalName}\nLocation: ${result.file.lastKnownLocation}\nPath: ${result.file.folderPath}\nApp: ${result.file.appSource}\nSize: ${result.file.sizeDescription}\nDescription: ${result.file.contentSnippet}`,
          summary: `Retrieved "${result.file.originalName}" from ${result.file.lastKnownLocation}`,
        },
        platform: this.isSmartphone() ? 'android' : 'universal',
      };
    }

    return {
      success: false,
      action: 'retrieveFile',
      error: result.message,
      message: result.message,
    };
  }

  /**
   * Cross-Session Memory: Search previous interactions & memories
   */
  searchInteractionMemory(query: string): ToolExecutionResult {
    console.log(`🧠 [DeviceActionBridge] searchInteractionMemory: "${query}"`);
    const searchRes = crossSessionMemory.searchInteractionMemory(query);

    return {
      success: searchRes.found,
      action: 'searchMemoryDatabase',
      message: searchRes.summary,
      data: {
        query,
        found: searchRes.found,
        file: searchRes.file,
        facts: searchRes.relevantFacts,
        interactionsCount: searchRes.relevantInteractions.length,
        interactions: searchRes.relevantInteractions,
      },
    };
  }

  /**
   * Cross-Session Memory: Store a learned fact or preference into long-term memory
   */
  recordLearnedFact(factKey: string, factValue: string, category?: string): ToolExecutionResult {
    console.log(`🧠 [DeviceActionBridge] recordLearnedFact: "${factKey}" -> "${factValue}"`);
    const fact = crossSessionMemory.learnFact(factKey, factValue, (category as any) || 'general');

    return {
      success: true,
      action: 'recordLearnedFact',
      message: `Maine yaad rakh liya: "${factKey}: ${factValue}"`,
      data: {
        fact,
        totalFacts: crossSessionMemory.getAllFacts().length,
      },
    };
  }

  /**
   * Cross-Session Memory: List active facts and memories summary
   */
  listMemories(): ToolExecutionResult {
    const digest = crossSessionMemory.getMemoryDigest();
    const stats = crossSessionMemory.getStats();

    return {
      success: true,
      action: 'listMemories',
      message: `Memory Database: ${stats.interactionsCount} conversation turns (${stats.speechLogsCount} voice, ${stats.chatCount} chat), ${stats.factsCount} learned facts.`,
      data: {
        digest,
        stats,
        facts: crossSessionMemory.getAllFacts(),
        files: crossSessionMemory.getAllFiles(),
      },
    };
  }

  /**
   * Speaker Recognition: Identify or register a new speaker into their person memory folder
   */
  identifyOrRegisterSpeaker(
    name: string,
    gender?: 'male' | 'female' | 'non-binary' | 'unknown',
    grammaticalStyle?: 'masculine' | 'feminine' | 'respectful',
    relationship?: string,
    pitchHz?: number
  ): ToolExecutionResult {
    if (!name || !name.trim()) {
      return {
        success: false,
        action: 'identifyOrRegisterSpeaker',
        error: 'Speaker name is required.',
      };
    }

    const result = speakerMemoryStore.registerOrUpdateSpeaker({
      name,
      gender,
      grammaticalStyle,
      relationship,
      pitchHz,
    });

    if (result.rejected || !result.folder) {
      return {
        success: false,
        action: 'identifyOrRegisterSpeaker',
        message: result.reason || `Aapki aawaz ${name} se match nahi ho rahi hai. Aap ${name} nahi hain, kripya confirm kijiye ki aap kaun hain?`,
        error: 'BIOMETRIC_MISMATCH',
        data: {
          impersonationTarget: name,
          rejected: true,
        },
      };
    }

    const folder = result.folder;
    const isDev = folder.name.toLowerCase() === 'dev';
    const isMale = folder.grammaticalStyle === 'masculine';
    const addressRule = isMale
      ? (isDev ? 'Male (use "chahta hai", "karega", "bhai/yaar")' : 'Male (respectful: "chahta hai", "aap")')
      : folder.grammaticalStyle === 'feminine'
      ? 'Female (use "chahti hai", "karegi", "sun na")'
      : 'Respectful (use "chahte hain", "karenge")';

    return {
      success: true,
      action: 'identifyOrRegisterSpeaker',
      message: isDev
        ? `Namaste Dev! Maine aapka memory folder update kar diya hai. Main hamesha ki tarah aapko pehchaan gayi hoon! 🌟`
        : `Namaste ${folder.name} ji! Maine aapka dedicated memory folder bana diya hai. Ab se main aapko ${addressRule} ke roop mein aadar ke saath sambodhit karungi. ✨`,
      data: {
        folderId: folder.id,
        name: folder.name,
        gender: folder.gender,
        grammaticalStyle: folder.grammaticalStyle,
        pronounLabel: folder.pronounLabel,
        voicePitchHz: Math.round(folder.voiceProfile.estimatedPitchHz),
        totalMemories: folder.memories.length,
      },
    };
  }

  /**
   * Speaker Recognition: Switch active memory folder to the identified speaker
   */
  switchActiveSpeaker(nameOrId: string): ToolExecutionResult {
    if (!nameOrId) {
      return { success: false, action: 'switchActiveSpeaker', error: 'Speaker identifier is required.' };
    }

    const folders = speakerMemoryStore.getFolders();
    const clean = nameOrId.toLowerCase().trim();
    const target = folders.find(
      (f) => f.id.toLowerCase() === clean || f.name.toLowerCase().includes(clean)
    );

    if (target) {
      speakerMemoryStore.setActiveSpeaker(target.id);
      return {
        success: true,
        action: 'switchActiveSpeaker',
        message: `Switched active memory folder to "${target.name}" (${target.pronounLabel}).`,
        data: {
          activeFolderId: target.id,
          name: target.name,
          gender: target.gender,
          grammaticalStyle: target.grammaticalStyle,
          memoriesCount: target.memories.length,
        },
      };
    }

    return {
      success: false,
      action: 'switchActiveSpeaker',
      error: `Could not find person folder for "${nameOrId}". Ask who is speaking to register them.`,
    };
  }

  /**
   * Person Memory Folders: Save a memory into a specific person's folder
   */
  savePersonMemory(key: string, value: string, category?: any, personName?: string): ToolExecutionResult {
    if (!key || !value) {
      return { success: false, action: 'savePersonMemory', error: 'Memory key and value are required.' };
    }

    let targetFolder = speakerMemoryStore.getActiveFolder();
    if (personName) {
      const folders = speakerMemoryStore.getFolders();
      const found = folders.find(
        (f) => f.name.toLowerCase().includes(personName.toLowerCase()) || f.id === personName
      );
      if (found) targetFolder = found;
    }

    const memory = speakerMemoryStore.addMemory({
      folderId: targetFolder.id,
      key,
      value,
      category,
      sourceText: `Voice saved memory for ${targetFolder.name}`,
    });

    // Also mirror to global fact database for seamless cross-retrieval
    crossSessionMemory.learnFact(`${targetFolder.name}'s ${key}`, value, category || 'general');

    return {
      success: true,
      action: 'savePersonMemory',
      message: `Maine ${targetFolder.name} ke folder mein yaad rakh liya: "${key}: ${value}"`,
      data: {
        memoryId: memory.id,
        folderName: targetFolder.name,
        key: memory.key,
        value: memory.value,
        totalPersonMemories: targetFolder.memories.length,
      },
    };
  }

  /**
   * Person Memory Folders: Get all details and memories in a person's folder
   */
  getPersonFolderDetails(personName?: string): ToolExecutionResult {
    let targetFolder = speakerMemoryStore.getActiveFolder();
    if (personName) {
      const folders = speakerMemoryStore.getFolders();
      const found = folders.find(
        (f) => f.name.toLowerCase().includes(personName.toLowerCase()) || f.id === personName
      );
      if (found) targetFolder = found;
    }

    return {
      success: true,
      action: 'getPersonFolderDetails',
      message: `Retrieved ${targetFolder.memories.length} memories for ${targetFolder.name} (${targetFolder.pronounLabel}).`,
      data: {
        id: targetFolder.id,
        name: targetFolder.name,
        gender: targetFolder.gender,
        grammaticalStyle: targetFolder.grammaticalStyle,
        pronounLabel: targetFolder.pronounLabel,
        voiceProfile: targetFolder.voiceProfile,
        memories: targetFolder.memories,
      },
    };
  }

  /**
   * Person Memory Folders: List all registered person folders
   */
  listAllPersonFolders(): ToolExecutionResult {
    const folders = speakerMemoryStore.getFolders();
    const active = speakerMemoryStore.getActiveFolder();

    const summaryList = folders.map((f) => ({
      id: f.id,
      name: f.name,
      gender: f.gender,
      grammaticalStyle: f.grammaticalStyle,
      pitchHz: Math.round(f.voiceProfile.estimatedPitchHz),
      memoriesCount: f.memories.length,
      isActive: f.id === active.id,
    }));

    return {
      success: true,
      action: 'listAllPersonFolders',
      message: `Registered Person Folders (${folders.length}): ${folders.map((f) => f.name).join(', ')}. Active: ${active.name}.`,
      data: {
        activeSpeaker: active.name,
        folders: summaryList,
      },
    };
  }

  /**
   * Biometric Acoustic Voice Sensor: Read real-time pitch, gender, and matched speaker
   * Evaluates multi-dimensional acoustic metrics (pitch, timbre, spectral centroid, formant dispersion)
   * specifically handling the 145-195 Hz ambiguous range.
   */
  getLiveAcousticSpeaker(): ToolExecutionResult {
    const folders = speakerMemoryStore.getFolders();
    const active = speakerMemoryStore.getActiveFolder();
    const livePitch = speakerMemoryStore.latestObservedPitch || 122.5;
    const liveCentroid = speakerMemoryStore.latestObservedCentroid || 1200;
    const acoustic = classifyAcousticGender(livePitch, liveCentroid);
    const classification = acoustic.gender === 'female' ? 'Female' : 'Male';

    const vocalTractEvidence = `Pitch Range: ${acoustic.pitchRangeLabel} (~${Math.round(livePitch)} Hz). Timbre Range: ${acoustic.timbreRangeLabel} (~${Math.round(liveCentroid)} Hz). Range Analysis Details: ${acoustic.rangeAnalysisDetails}`;

    if (folders.length === 0 || active.id === 'guest' || !active.name || active.name === 'Unknown Voice') {
      return {
        success: true,
        action: 'getLiveAcousticSpeaker',
        message: `Classification: ${classification}. Acoustic Range Evidence: ${vocalTractEvidence}`,
        data: {
          speakerName: 'Unregistered Voice',
          classification,
          isRecognized: false,
          pitchHz: Math.round(livePitch),
          spectralCentroid: Math.round(liveCentroid),
          gender: acoustic.gender,
          grammaticalStyle: acoustic.gender === 'female' ? 'feminine' : 'masculine',
          acousticEvidence: vocalTractEvidence,
        },
      };
    }

    const lastPitch = active.voiceProfile.estimatedPitchHz || (active.gender === 'female' ? 210 : 122.5);
    const gender = active.gender || 'male';
    const style = active.grammaticalStyle || (gender === 'female' ? 'feminine' : 'masculine');

    console.log(`[DeviceActionBridge] getLiveAcousticSpeaker -> Active: ${active.name} (${gender}, ~${Math.round(lastPitch)} Hz)`);

    return {
      success: true,
      action: 'getLiveAcousticSpeaker',
      message: `Classification: ${classification}. Speaker Profile: "${active.name}". Acoustic Range Evidence: ${vocalTractEvidence}`,
      data: {
        speakerName: active.name,
        classification,
        isRecognized: true,
        gender: active.gender,
        pitchHz: Math.round(lastPitch),
        spectralCentroid: Math.round(liveCentroid),
        grammaticalStyle: style,
        pronounLabel: active.pronounLabel,
        relationship: active.relationship,
        memoriesCount: active.memories.length,
        acousticEvidence: vocalTractEvidence,
      },
    };
  }

  /**
   * Launch multiple applications sequentially in one turn
   */
  openMultipleApps(appNames: string[] | string): ToolExecutionResult {
    let list: string[] = [];

    if (Array.isArray(appNames)) {
      for (const item of appNames) {
        if (typeof item === 'string') {
          const extracted = extractAppsFromText(item);
          for (const app of extracted) {
            if (!list.includes(app)) list.push(app);
          }
        }
      }
    } else if (typeof appNames === 'string') {
      list = extractAppsFromText(appNames);
    }

    if (list.length === 0) {
      return { success: false, action: 'openMultipleApps', error: 'No app names provided.' };
    }

    console.log(`🚀 [DeviceActionBridge] Launching ${list.length} apps sequentially:`, list);

    const resolvedItems: Array<{ app: string; uri?: string; url?: string; category?: string }> = [];

    list.forEach((appItem, index) => {
      const mobCfg = this.resolveMobileAppConfig(appItem);
      const winCfg = this.resolveWindowsAppConfig(appItem);
      const chosen = this.isSmartphone() ? (mobCfg || winCfg) : (winCfg || mobCfg);

      resolvedItems.push({
        app: chosen ? chosen.name : appItem,
        uri: (chosen as any)?.intentUri || (chosen as any)?.protocolUri,
        url: (chosen as any)?.universalUrl || (chosen as any)?.webFallback,
        category: chosen?.category || 'Utility',
      });

      // Stagger sequential launch so device processes each app cleanly
      setTimeout(() => {
        this.openSingleApp(appItem);
      }, index * 300);
    });

    const appListStr = list.join(', ');
    return {
      success: true,
      action: 'openMultipleApps',
      message: `Opening ${list.length} applications: ${appListStr}.`,
      data: {
        app: appListStr,
        apps: list,
        items: resolvedItems,
        count: list.length,
        platform: this.isSmartphone() ? 'android' : 'windows',
      },
      platform: this.isSmartphone() ? 'android' : 'windows',
    };
  }

  /**
   * Windows & Android Unified App Launcher
   */
  openApp(appName: string, action?: string, query?: string): ToolExecutionResult {
    if (!appName || typeof appName !== 'string') {
      return {
        success: false,
        action: 'openApp',
        error: 'App name must be provided.',
      };
    }

    const extracted = extractAppsFromText(appName);
    if (extracted.length > 1) {
      return this.openMultipleApps(extracted);
    }

    return this.openSingleApp(appName, action, query);
  }

  private openSingleApp(appName: string, action?: string, query?: string): ToolExecutionResult {
    const rawClean = appName.toLowerCase().replace(/^(open|launch|start|run|chalao|kholo|show|please open)\s+/i, '').trim();
    console.log(`💻 [DeviceActionBridge] Launching App: "${appName}" (clean: "${rawClean}") on ${this.getEnvironmentName()}`);

    // 1. Camera Special Handling: Trigger Hidden HTML Camera Input Directly
    if (rawClean === 'camera' || rawClean === 'webcam') {
      if (typeof document !== 'undefined') {
        const cameraInput = document.getElementById('iris-mobile-camera-capture') as HTMLInputElement | null;
        if (cameraInput) {
          cameraInput.click();
          return {
            success: true,
            action: 'openApp',
            message: 'Camera capture dialog opened on your device.',
            data: { app: 'Camera', category: 'Utility', platform: 'android' },
            platform: 'android',
          };
        }
      }
    }

    // 2. Android Native Bridge for APK wrapping
    if (typeof window !== 'undefined') {
      const androidBridge = (window as any).AndroidBridge || (window as any).IrisNativeBridge;
      if (androidBridge && typeof androidBridge.postMessage === 'function') {
        try {
          const mobCfg = this.resolveMobileAppConfig(rawClean);
          androidBridge.postMessage(JSON.stringify({
            action: 'OPEN_APP',
            app: mobCfg?.name || appName,
            packageName: mobCfg?.packageName,
            uri: mobCfg?.intentUri,
            query: query || '',
          }));

          return {
            success: true,
            action: 'openApp',
            message: `Opening ${mobCfg?.name || appName} via Android Native Bridge.`,
            data: {
              app: mobCfg?.name || appName,
              packageName: mobCfg?.packageName,
              bridged: true,
              platform: 'android',
            },
            platform: 'android',
          };
        } catch (e) {
          console.warn('AndroidBridge.postMessage error in openApp:', e);
        }
      }
    }

    // 3. Resolve config
    const isMobile = this.isSmartphone();
    const mobConfig = this.resolveMobileAppConfig(rawClean);
    const winConfig = this.resolveWindowsAppConfig(rawClean);

    if (isMobile && mobConfig) {
      let targetUri = mobConfig.intentUri;
      let targetWeb = mobConfig.universalUrl;

      if (query) {
        if (rawClean.includes('spotify') || rawClean.includes('music')) {
          targetUri = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
          targetWeb = targetUri;
        } else if (rawClean.includes('youtube') || rawClean.includes('yt')) {
          targetUri = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          targetWeb = targetUri;
        } else if (rawClean.includes('map') || rawClean.includes('direction')) {
          targetUri = `https://maps.google.com/maps?q=${encodeURIComponent(query)}`;
          targetWeb = targetUri;
        }
      }

      this.launchAnchorLink(targetUri, targetWeb);
      return {
        success: true,
        action: 'openApp',
        message: `Opening ${mobConfig.name} on Smartphone.`,
        data: {
          app: mobConfig.name,
          category: mobConfig.category,
          uri: targetUri,
          url: targetWeb,
          targetUrl: targetWeb,
          platform: 'android',
        },
        platform: 'android',
      };
    }

    if (winConfig) {
      let targetUri = winConfig.protocolUri;
      let targetWeb = winConfig.webFallback;

      if (query) {
        if (rawClean.includes('spotify') || rawClean.includes('music')) {
          targetUri = `spotify:search:${encodeURIComponent(query)}`;
          targetWeb = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
        } else if (rawClean.includes('youtube')) {
          targetWeb = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        } else if (rawClean.includes('vscode') || rawClean.includes('vs code') || rawClean.includes('code')) {
          targetUri = `vscode://file/${encodeURIComponent(query)}`;
        }
      }

      this.launchAnchorLink(targetUri, targetWeb);
      return {
        success: true,
        action: 'openApp',
        message: `Opening ${winConfig.name} on Windows.`,
        data: {
          app: winConfig.name,
          category: winConfig.category,
          uri: targetUri,
          url: targetWeb,
          targetUrl: targetWeb,
          platform: 'windows',
        },
        platform: 'windows',
      };
    }

    // Dynamic Universal Web Fallback for any application/website
    const isDomain = rawClean.includes('.') || !rawClean.includes(' ');
    const fallbackWeb = isDomain && !rawClean.startsWith('http')
      ? `https://${rawClean.replace(/^https?:\/\//i, '')}`
      : `https://www.google.com/search?q=${encodeURIComponent(appName)}`;

    this.launchAnchorLink(fallbackWeb, fallbackWeb);
    return {
      success: true,
      action: 'openApp',
      message: `Opening ${appName}.`,
      data: { app: appName, url: fallbackWeb, targetUrl: fallbackWeb, platform: isMobile ? 'android' : 'windows' },
      platform: isMobile ? 'android' : 'windows',
    };
  }

  /**
   * Close or Minimize an Application
   */
  closeApp(appName: string): ToolExecutionResult {
    if (!appName) {
      return { success: false, action: 'closeApp', error: 'App name required.' };
    }

    console.log(`🛑 [DeviceActionBridge] Closing app: ${appName}`);

    if (typeof window !== 'undefined') {
      const androidBridge = (window as any).AndroidBridge || (window as any).IrisNativeBridge;
      if (androidBridge && typeof androidBridge.postMessage === 'function') {
        try {
          androidBridge.postMessage(JSON.stringify({
            action: 'CLOSE_APP',
            app: appName,
          }));
        } catch (_) {}
      }
    }

    return {
      success: true,
      action: 'closeApp',
      message: `Signaled close/minimize for ${appName}.`,
      data: { appName, status: 'closed' },
      platform: 'universal',
    };
  }

  /**
   * Windows / Smartphone System Settings Automation
   */
  controlWindowsSetting(settingName: string, action?: string): ToolExecutionResult {
    const s = settingName.toLowerCase().trim();

    if (typeof window !== 'undefined') {
      const androidBridge = (window as any).AndroidBridge || (window as any).IrisNativeBridge;
      if (androidBridge && typeof androidBridge.postMessage === 'function') {
        try {
          androidBridge.postMessage(JSON.stringify({
            action: 'CONTROL_SETTING',
            settingName: settingName,
            actionType: action || 'open',
          }));
          return {
            success: true,
            action: 'controlWindowsSetting',
            message: `Opened ${settingName} settings via Android Native Bridge.`,
            data: { settingName, action: action || 'open' },
            platform: 'android',
          };
        } catch (_) {}
      }
    }

    let uri = 'https://myaccount.google.com';
    let friendly = 'System Settings';

    if (s.includes('wifi') || s.includes('internet') || s.includes('network')) {
      uri = this.isWindows() ? 'ms-settings:network-wifi' : 'https://speedtest.net';
      friendly = 'Wi-Fi & Network Settings';
    } else if (s.includes('bluetooth')) {
      uri = this.isWindows() ? 'ms-settings:bluetooth' : 'https://myaccount.google.com';
      friendly = 'Bluetooth Devices';
    } else if (s.includes('sound') || s.includes('volume') || s.includes('audio')) {
      uri = this.isWindows() ? 'ms-settings:sound' : 'https://myaccount.google.com';
      friendly = 'Sound Settings';
    } else if (s.includes('display') || s.includes('brightness')) {
      uri = this.isWindows() ? 'ms-settings:display' : 'https://myaccount.google.com';
      friendly = 'Display Settings';
    }

    this.launchAnchorLink(uri, 'https://myaccount.google.com');
    return {
      success: true,
      action: 'controlWindowsSetting',
      message: `Opened ${friendly}.`,
      data: { settingName: friendly, uri, action: action || 'open' },
      platform: this.isWindows() ? 'windows' : 'android',
    };
  }

  /**
   * Universal In-App Search
   */
  searchApp(appName: string, query: string): ToolExecutionResult {
    if (!appName) {
      return { success: false, action: 'searchApp', error: 'App name required for search.' };
    }
    if (!query) {
      return { success: false, action: 'searchApp', error: 'Search query is required.' };
    }

    const appClean = appName.toLowerCase().trim();
    const encoded = encodeURIComponent(query);
    console.log(`🔍 [DeviceActionBridge] Search: ${appName} -> "${query}"`);

    let targetUrl = `https://www.youtube.com/results?search_query=${encoded}`;

    if (appClean.includes('youtube') || appClean.includes('yt')) {
      targetUrl = `https://www.youtube.com/results?search_query=${encoded}`;
    } else if (appClean.includes('spotify') || appClean.includes('music') || appClean.includes('gaana')) {
      targetUrl = `https://open.spotify.com/search/${encoded}`;
    } else if (appClean.includes('map') || appClean.includes('direction') || appClean.includes('location')) {
      targetUrl = `https://maps.google.com/maps?q=${encoded}`;
    } else if (appClean.includes('amazon')) {
      targetUrl = `https://www.amazon.in/s?k=${encoded}`;
    } else if (appClean.includes('flipkart')) {
      targetUrl = `https://www.flipkart.com/search?q=${encoded}`;
    } else if (appClean.includes('instagram') || appClean.includes('insta')) {
      targetUrl = `https://www.instagram.com/explore/tags/${encoded.replace(/#/g, '')}/`;
    } else if (appClean.includes('twitter') || appClean.includes('x')) {
      targetUrl = `https://x.com/search?q=${encoded}`;
    } else if (appClean.includes('zomato')) {
      targetUrl = `https://www.zomato.com/search?q=${encoded}`;
    } else if (appClean.includes('swiggy')) {
      targetUrl = `https://www.swiggy.com/search?query=${encoded}`;
    }

    this.launchAnchorLink(targetUrl, targetUrl);

    return {
      success: true,
      action: 'searchApp',
      message: `Searching for "${query}" on ${appName}.`,
      data: {
        app: appName,
        query,
        url: targetUrl,
        targetUrl,
        uri: targetUrl,
      },
    };
  }

  showLink(title: string, url: string, description?: string): ToolExecutionResult {
    let validUrl = url.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = `https://${validUrl}`;
    }

    console.log(`🔗 [DeviceActionBridge] showLink: "${title}" -> ${validUrl}`);

    return {
      success: true,
      action: 'showLink',
      message: `Direct link: ${title}`,
      data: {
        title: title || 'Web Link',
        contentType: 'link',
        url: validUrl,
        content: validUrl,
        summary: description || `Click to visit ${title}`,
      },
    };
  }

  openUrl(url: string, title?: string): ToolExecutionResult {
    let validUrl = url.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = `https://${validUrl}`;
    }

    this.launchAnchorLink(validUrl, validUrl);
    return {
      success: true,
      action: 'openUrl',
      message: `Opened ${validUrl}`,
      data: {
        title: title || 'Website Link',
        contentType: 'link',
        url: validUrl,
        content: validUrl,
      },
    };
  }

  sendSMS(recipient?: string, message?: string): ToolExecutionResult {
    if (!recipient && !message) {
      return this.openApp('sms');
    }

    let phone = (recipient || '').replace(/[^\d+]/g, '');
    let name = recipient || 'Contact';

    if (phone.length < 5 && recipient) {
      const { exact } = this.findContact(recipient);
      if (exact) {
        phone = exact.phone;
        name = exact.name;
      }
    }

    const encodedMsg = encodeURIComponent(message || '');
    const smsUrl = phone ? `sms:${phone}?body=${encodedMsg}` : `sms:?body=${encodedMsg}`;

    this.launchAnchorLink(smsUrl, smsUrl);
    return {
      success: true,
      action: 'sendSMS',
      message: phone ? `Opened SMS composer to send message to ${name}.` : `Opened SMS composer.`,
      data: { phone, name, message },
    };
  }

  makeCall(phoneNumber: string): ToolExecutionResult {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return { success: false, action: 'makeCall', error: 'Phone number is required.' };
    }

    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    if (cleanNumber.length < 3) {
      return {
        success: false,
        action: 'makeCall',
        error: `Invalid phone number "${phoneNumber}".`,
      };
    }

    console.log(`📞 [DeviceActionBridge] Calling: ${cleanNumber}`);

    // Android Native Bridge check
    if (typeof window !== 'undefined') {
      const androidBridge = (window as any).AndroidBridge || (window as any).IrisNativeBridge;
      if (androidBridge && typeof androidBridge.postMessage === 'function') {
        try {
          androidBridge.postMessage(JSON.stringify({
            action: 'CALL_CONTACT',
            phoneNumber: cleanNumber,
          }));
          return {
            success: true,
            action: 'makeCall',
            message: `Calling ${cleanNumber} via Android Native Bridge.`,
            data: { phoneNumber: cleanNumber, bridged: true },
            platform: 'android',
          };
        } catch (_) {}
      }
    }

    const telLink = `tel:${cleanNumber}`;
    this.launchAnchorLink(telLink, telLink);

    return {
      success: true,
      action: 'makeCall',
      message: `Calling ${cleanNumber} (opened in device dialer / phone app).`,
      data: { phoneNumber: cleanNumber },
      platform: this.isWindows() ? 'windows' : 'universal',
    };
  }

  callContact(contactName: string): ToolExecutionResult {
    if (!contactName || typeof contactName !== 'string') {
      return { success: false, action: 'callContact', error: 'Contact name is required.' };
    }

    const { exact, matches } = this.findContact(contactName);

    if (exact) {
      const callResult = this.makeCall(exact.phone);
      return {
        success: callResult.success,
        action: 'callContact',
        message: `Calling ${exact.name} on ${exact.phone}.`,
        data: { contact: exact, callResult },
      };
    }

    if (matches.length > 1) {
      const matchNames = matches.map((m) => m.name).join(', ');
      return {
        success: false,
        action: 'callContact',
        error: `I found ${matches.length} contacts matching "${contactName}": ${matchNames}. Which one should I call?`,
        data: {
          matches: matches.map((m) => ({ name: m.name, phone: m.phone })),
        },
      };
    }

    return {
      success: false,
      action: 'callContact',
      error: `Contact "${contactName}" could not be found in device contacts.`,
    };
  }

  /**
   * Google Maps & Precise GPS Location Automation
   */
  async getPreciseLocation(): Promise<ToolExecutionResult> {
    const loc = await locationService.requestPreciseLocation(true);

    // Auto-open interactive map on screen so user sees precise pinpoint immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('iris-open-map', {
          detail: {
            center: { lat: loc.latitude, lng: loc.longitude },
            zoom: 16,
          },
        })
      );
    }

    return {
      success: true,
      action: 'getPreciseLocation',
      message: `Current precise location: ${loc.formattedAddress || `${loc.latitude}, ${loc.longitude}`} (GPS accuracy: ±${loc.accuracy}m). Google Maps opened on screen.`,
      data: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        speed: loc.speed,
        heading: loc.heading,
        address: loc.formattedAddress,
        neighborhood: loc.neighborhood,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        status: loc.status,
      },
    };
  }

  openGoogleMap(options?: { query?: string; category?: string; zoom?: number }): ToolExecutionResult {
    const loc = locationService.getLocation();
    const query = options?.query || '';
    const category = options?.category;
    const zoom = options?.zoom || 15;

    let targetUrl = `https://www.google.com/maps/@${loc.latitude},${loc.longitude},${zoom}z`;
    if (query) {
      targetUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${loc.latitude},${loc.longitude},${zoom}z`;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('iris-open-map', {
          detail: { query, category, zoom, center: { lat: loc.latitude, lng: loc.longitude } },
        })
      );
    }

    return {
      success: true,
      action: 'openGoogleMap',
      message: query
        ? `Opening Google Maps and searching for "${query}" near your location.`
        : `Opening interactive Google Maps centered on your real-time location.`,
      data: {
        query,
        category,
        zoom,
        userLocation: { lat: loc.latitude, lng: loc.longitude },
        targetUrl,
      },
    };
  }

  async searchNearbyPlaces(query: string, category?: string, radiusMeters?: number): Promise<ToolExecutionResult> {
    const loc = locationService.getLocation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('iris-open-map', {
          detail: { query, category, zoom: 15, center: { lat: loc.latitude, lng: loc.longitude } },
        })
      );
    }

    try {
      const res = await fetch(
        `/api/places/search?query=${encodeURIComponent(query)}&lat=${loc.latitude}&lng=${loc.longitude}&radius=${radiusMeters || 5000}`
      );
      if (res.ok) {
        const data = await res.json();
        const count = data.results?.length || 0;
        const topNames = (data.results || []).slice(0, 3).map((r: any) => r.name).join(', ');
        return {
          success: true,
          action: 'searchNearbyPlaces',
          message: count > 0
            ? `Found ${count} places for "${query}" nearby: ${topNames}. Displayed on Google Maps.`
            : `Searched for "${query}" near your location on Google Maps.`,
          data: { query, results: data.results, count },
        };
      }
    } catch (e) {
      // fallback
    }

    return {
      success: true,
      action: 'searchNearbyPlaces',
      message: `Searching for "${query}" on Google Maps around your location.`,
      data: { query },
    };
  }

  getDirectionsAndNavigation(destination: string, travelMode: string = 'driving'): ToolExecutionResult {
    const loc = locationService.getLocation();
    const cleanMode = travelMode.toLowerCase();
    const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${loc.latitude},${loc.longitude}&destination=${encodeURIComponent(destination)}&travelmode=${cleanMode}`;

    if (typeof window !== 'undefined') {
      // Open embedded map view with search and navigation ready
      window.dispatchEvent(
        new CustomEvent('iris-open-map', {
          detail: { query: destination, zoom: 16, center: { lat: loc.latitude, lng: loc.longitude } },
        })
      );
    }

    return {
      success: true,
      action: 'getDirectionsAndNavigation',
      message: `Calculating ${cleanMode} route to "${destination}" from your location and opening route on Google Maps.`,
      data: {
        destination,
        travelMode: cleanMode,
        origin: { lat: loc.latitude, lng: loc.longitude },
        navUrl,
      },
    };
  }

  /**
   * Voice Control for Map POV, Zoom, Layer Styles & Center
   */
  controlGoogleMap(options: {
    mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain' | string;
    zoom?: number | string;
    center?: { lat?: number; lng?: number };
    query?: string;
    traffic?: boolean;
  }): ToolExecutionResult {
    const { mapType, zoom, center, query, traffic } = options;
    console.log('🗺️ [DeviceActionBridge] controlGoogleMap options:', options);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('iris-map-control', {
          detail: {
            mapType,
            zoom,
            center,
            query,
            traffic,
          },
        })
      );
    }

    const changes: string[] = [];
    if (mapType) changes.push(`view mode to ${mapType}`);
    if (zoom) changes.push(`zoom ${zoom}`);
    if (traffic !== undefined) changes.push(`traffic layer ${traffic ? 'on' : 'off'}`);
    if (query) changes.push(`centered on "${query}"`);

    const summary = changes.length > 0 ? changes.join(', ') : 'map updated';
    return {
      success: true,
      action: 'controlGoogleMap',
      message: `Google Map view adjusted: ${summary}.`,
      data: options,
    };
  }
}
