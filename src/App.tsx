import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Smartphone,
  Globe,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  Settings,
  Info,
  Monitor,
  Volume2,
  MapPin,
  Eye,
  Tv,
} from 'lucide-react';
import { screenShareService } from './services/screenShareService.ts';
import { LiveClient, AssistantState } from './services/liveClient.ts';
import { DeviceActionBridge, ToolExecutionResult, Contact } from './services/deviceActionBridge.ts';
import { IrisOrb } from './components/IrisOrb.tsx';
import { JarvisLiveWallpaper } from './components/JarvisLiveWallpaper.tsx';
import { ConversationHistoryPanel, HistoryTurn } from './components/ConversationHistoryPanel.tsx';
import { RippleButton } from './components/RippleButton.tsx';
import { SpeakerDiagnostic } from './components/SpeakerDiagnostic.tsx';
import { ActionFeedback } from './components/ActionFeedback.tsx';
import { DeviceContactsModal } from './components/DeviceContactsModal.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { VoiceUploadModal } from './components/VoiceUploadModal.tsx';
import { GeneratedContentModal, GeneratedContentData } from './components/GeneratedContentModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { InformationModal } from './components/InformationModal.tsx';
import { PlatformDock } from './components/PlatformDock.tsx';
import { CalendarModal } from './components/CalendarModal.tsx';
import { RemindersModal } from './components/RemindersModal.tsx';
import { NotesModal } from './components/NotesModal.tsx';
import { NotificationsModal } from './components/NotificationsModal.tsx';
import { LocationTimeBar } from './components/LocationTimeBar.tsx';
import { GoogleMapModal } from './components/GoogleMapModal.tsx';
import { LocationPermissionModal } from './components/LocationPermissionModal.tsx';
import { ScreenAnnotationOverlay } from './components/ScreenAnnotationOverlay.tsx';
import { CameraCaptureModal } from './components/CameraCaptureModal.tsx';
import { locationService } from './services/locationService.ts';
import { toEnglishAlphabets } from './utils/transliteration.ts';
import { crossSessionMemory } from './services/crossSessionMemory.ts';

export default function App() {
  const [state, setState] = useState<AssistantState>('IDLE');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [irisText, setIrisText] = useState<string>('');
  const [userText, setUserText] = useState<string>('');
  const [conversationTurns, setConversationTurns] = useState<HistoryTurn[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Modals state
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isRemindersOpen, setIsRemindersOpen] = useState<boolean>(false);
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  const [platformMode, setPlatformMode] = useState<'auto' | 'windows' | 'android'>(() => {
    return (localStorage.getItem('iris_platform_mode') as any) || 'auto';
  });
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('iris_preferred_voice') || 'Kore';
  });
  const [isVoiceUploadOpen, setIsVoiceUploadOpen] = useState<boolean>(false);
  const [voiceUploadType, setVoiceUploadType] = useState<'image' | 'video' | 'document' | 'any'>('any');
  const [voiceUploadPrompt, setVoiceUploadPrompt] = useState<string>('');
  const [isGeneratedContentOpen, setIsGeneratedContentOpen] = useState<boolean>(false);
  const [generatedContentData, setGeneratedContentData] = useState<GeneratedContentData | null>(null);
  const [lastAction, setLastAction] = useState<{
    name: string;
    args: any;
    result: ToolExecutionResult;
    timestamp: number;
  } | null>(null);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isNativeMode, setIsNativeMode] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapModalProps, setMapModalProps] = useState<{
    query?: string;
    category?: string;
    center?: { lat: number; lng: number };
    zoom?: number;
  }>({});
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isLocationPermissionOpen, setIsLocationPermissionOpen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsScreenSharing(screenShareService.getIsSharing());
    }, 1000);

    const handleScreenShareRequest = () => {
      console.log('🖥️ [App] iris-request-screenshare event received! Triggering screen share...');
      handleToggleScreenShare();
    };

    const handleOpenChatRequest = () => {
      console.log('💬 [App] iris-open-chat event received! Opening chat panel...');
      setIsChatOpen(true);
    };

    window.addEventListener('iris-request-screenshare', handleScreenShareRequest);
    window.addEventListener('iris-open-chat', handleOpenChatRequest);

    return () => {
      clearInterval(interval);
      window.removeEventListener('iris-request-screenshare', handleScreenShareRequest);
      window.removeEventListener('iris-open-chat', handleOpenChatRequest);
    };
  }, []);

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      clientRef.current?.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      if (state === 'IDLE') {
        await toggleSession();
      }
      const success = await clientRef.current?.startScreenShare();
      setIsScreenSharing(!!success);
    }
  };

  const handleCameraCapture = (dataUrl: string, fileName: string) => {
    console.log('📸 [App] Camera photo captured & sending to Iris:', fileName);

    setConversationTurns((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        text: `Captured camera photo: ${fileName}`,
        file: {
          name: fileName,
          type: 'image',
          mimeType: 'image/jpeg',
          previewUrl: dataUrl,
        },
        timestamp: Date.now(),
      },
    ]);

    if (clientRef.current) {
      clientRef.current.getDeviceBridge().setUploadedFile({
        name: fileName,
        type: 'image',
        mimeType: 'image/jpeg',
      });
    }

    if (clientRef.current && (state === 'LISTENING' || state === 'SPEAKING' || state === 'CONNECTING')) {
      clientRef.current.sendFile({
        name: fileName,
        type: 'image',
        mimeType: 'image/jpeg',
        data: dataUrl,
      });
    } else {
      setIsChatOpen(true);
    }
  };

  const clientRef = useRef<LiveClient | null>(null);

  // Initialize precise geolocation and listeners on component mount
  useEffect(() => {
    locationService.requestPreciseLocation(true).catch(() => {});

    const handleOpenMap = (e: any) => {
      const detail = e.detail || {};
      setMapModalProps({
        query: detail.query || '',
        category: detail.category,
        center: detail.center,
        zoom: detail.zoom || 15,
      });
      setIsMapOpen(true);
    };

    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };

    const handleOpenLocationSettings = () => {
      setIsLocationPermissionOpen(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && clientRef.current) {
        clientRef.current.ensureAudio();
      }
    };

    window.addEventListener('iris-open-map', handleOpenMap);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('iris-open-location-settings', handleOpenLocationSettings);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('iris-open-map', handleOpenMap);
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('iris-open-location-settings', handleOpenLocationSettings);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Initialize LiveClient on component mount
  useEffect(() => {
    const client = new LiveClient({
      onStateChange: (newState) => {
        setState(newState);
        if (newState !== 'ERROR') {
          setErrorMessage(null);
        }
        // When Iris stops speaking and transitions to listening, close streaming state
        if (newState === 'LISTENING') {
          setConversationTurns((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'iris' && last.isStreaming) {
              return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            }
            return prev;
          });
        }
      },
      onAudioLevel: (level) => {
        setAudioLevel(level);
      },
      onIrisTranscription: (text) => {
        const cleanText = toEnglishAlphabets(text);
        setIrisText((prev) => (prev ? `${prev} ${cleanText}` : cleanText));
        if (!cleanText.trim()) return;

        // Record assistant speech in cross-session memory database
        crossSessionMemory.recordSpeechLog('iris', cleanText);

        // Auto-detect links shared by Iris
        const urlMatch = cleanText.match(/https?:\/\/[^\s<>)"]+/i);
        if (urlMatch) {
          const foundUrl = urlMatch[0].replace(/[.,;:!?)]+$/, '');
          setGeneratedContentData({
            title: 'Web Link',
            contentType: 'link',
            content: foundUrl,
            url: foundUrl,
            summary: `Destination: ${foundUrl}`,
          });
          setIsGeneratedContentOpen(true);
        }

        setConversationTurns((prev) => {
          const lastIndex = prev.length - 1;
          const lastTurn = lastIndex >= 0 ? prev[lastIndex] : null;

          if (lastTurn && lastTurn.role === 'iris' && lastTurn.isStreaming) {
            return [
              ...prev.slice(0, -1),
              {
                ...lastTurn,
                text: `${lastTurn.text} ${cleanText}`.trim(),
                timestamp: Date.now(),
              },
            ];
          }

          return [
            ...prev,
            {
              id: `iris-${Date.now()}`,
              role: 'iris',
              text: cleanText.trim(),
              timestamp: Date.now(),
              isStreaming: true,
            },
          ];
        });
      },
      onUserTranscription: (text) => {
        const cleanUserText = toEnglishAlphabets(text);
        setUserText(cleanUserText);
        if (!cleanUserText.trim()) return;

        // Record user speech in cross-session memory database
        crossSessionMemory.recordSpeechLog('user', cleanUserText);

        setConversationTurns((prev) => {
          const trimmed = cleanUserText.trim();
          const lastIndex = prev.length - 1;
          if (lastIndex < 0) {
            return [
              {
                id: `user-${Date.now()}`,
                role: 'user',
                text: trimmed,
                timestamp: Date.now(),
              },
            ];
          }

          const lastTurn = prev[lastIndex];

          if (lastTurn.role === 'iris') {
            if (lastTurn.isStreaming) {
              const priorIndex = lastIndex - 1;
              const priorTurn = priorIndex >= 0 ? prev[priorIndex] : null;

              if (priorTurn && priorTurn.role === 'user') {
                const updated = [...prev];
                updated[priorIndex] = {
                  ...priorTurn,
                  text: trimmed,
                };
                return updated;
              } else {
                const newUserTurn: HistoryTurn = {
                  id: `user-${Date.now()}`,
                  role: 'user',
                  text: trimmed,
                  timestamp: lastTurn.timestamp - 1,
                };
                return [...prev.slice(0, lastIndex), newUserTurn, lastTurn];
              }
            } else {
              return [
                ...prev,
                {
                  id: `user-${Date.now()}`,
                  role: 'user',
                  text: trimmed,
                  timestamp: Date.now(),
                },
              ];
            }
          }

          if (lastTurn.role === 'user') {
            return [
              ...prev.slice(0, -1),
              {
                ...lastTurn,
                text: trimmed,
                timestamp: Date.now(),
              },
            ];
          }

          return [
            ...prev,
            {
              id: `user-${Date.now()}`,
              role: 'user',
              text: trimmed,
              timestamp: Date.now(),
            },
          ];
        });
      },
      onInterruption: () => {
        setConversationTurns((prev) => {
          const lastTurn = prev[prev.length - 1];
          if (lastTurn && lastTurn.role === 'iris' && lastTurn.isStreaming) {
            return [
              ...prev.slice(0, -1),
              {
                ...lastTurn,
                interrupted: true,
                isStreaming: false,
              },
            ];
          }
          return prev;
        });
      },
      onToolAction: (actionInfo) => {
        setLastAction({
          ...actionInfo,
          timestamp: Date.now(),
        });

        if (actionInfo.name === 'showLink' && actionInfo.result?.data) {
          setGeneratedContentData(actionInfo.result.data);
          setIsGeneratedContentOpen(true);
        } else if (actionInfo.name === 'retrieveFile' && actionInfo.result?.data) {
          // Open retrieved file card from cross-session memory
          setGeneratedContentData(actionInfo.result.data);
          setIsGeneratedContentOpen(true);
        } else if (actionInfo.name === 'scheduleMeeting' || actionInfo.name === 'createCalendarEvent' || actionInfo.name === 'listCalendarEvents') {
          setIsCalendarOpen(true);
        } else if (actionInfo.name === 'setReminder' || actionInfo.name === 'listReminders') {
          setIsRemindersOpen(true);
        } else if (actionInfo.name === 'createNote' || actionInfo.name === 'listNotes') {
          setIsNotesOpen(true);
        } else if (actionInfo.name === 'readNotifications' || actionInfo.name === 'replyNotification') {
          setIsNotificationsOpen(true);
        }
      },
      onRequestFileUpload: (data) => {
        setVoiceUploadType((data.fileType as any) || 'any');
        setVoiceUploadPrompt(data.message || 'Haan bilkul, upload kar na! Main dekh rahi hoon!');
        setIsVoiceUploadOpen(true);
      },
      onShowGeneratedContent: (data) => {
        setGeneratedContentData(data);
        setIsGeneratedContentOpen(true);
      },
      onError: (err) => {
        setErrorMessage(err);
      },
    });

    clientRef.current = client;
    client.getDeviceBridge().setPlatformOverride(platformMode);
    setContacts(client.getDeviceBridge().getContacts());
    setIsNativeMode(client.getDeviceBridge().isAndroidNative());

    return () => {
      client.stop();
    };
  }, [selectedVoice]);

  // Update platform override when platformMode changes
  useEffect(() => {
    if (clientRef.current) {
      clientRef.current.getDeviceBridge().setPlatformOverride(platformMode);
      setIsNativeMode(clientRef.current.getDeviceBridge().isAndroidNative());
    }
  }, [platformMode]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        toggleSession();
      } else if (e.code === 'Escape') {
        if (isSettingsOpen) setIsSettingsOpen(false);
        else if (isInfoOpen) setIsInfoOpen(false);
        else if (isChatOpen) setIsChatOpen(false);
        else if (isCalendarOpen) setIsCalendarOpen(false);
        else if (isRemindersOpen) setIsRemindersOpen(false);
        else if (isNotesOpen) setIsNotesOpen(false);
        else if (isNotificationsOpen) setIsNotificationsOpen(false);
        else if (isGeneratedContentOpen) setIsGeneratedContentOpen(false);
        else if (isVoiceUploadOpen) setIsVoiceUploadOpen(false);
        else if (isContactsOpen) setIsContactsOpen(false);
        else if (state !== 'IDLE' && clientRef.current) clientRef.current.stop();
      } else if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
        setIsChatOpen((prev) => !prev);
      } else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        setIsSettingsOpen((prev) => !prev);
      } else if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey) {
        setIsInfoOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isInfoOpen, isChatOpen, isGeneratedContentOpen, isVoiceUploadOpen, isContactsOpen, isCalendarOpen, isRemindersOpen, isNotesOpen, isNotificationsOpen, state, selectedVoice]);

  // Toggle Live Session
  const toggleSession = async () => {
    if (!clientRef.current) return;

    if (state === 'IDLE' || state === 'ERROR') {
      setErrorMessage(null);
      setIrisText('');
      setUserText('');
      try {
        await clientRef.current.start(selectedVoice);
      } catch (err: any) {
        console.error('Session start error:', err);
        setErrorMessage(err?.message || 'Could not start voice session');
      }
    } else {
      clientRef.current.stop();
    }
  };

  const handleSpeakerTest = async () => {
    if (!clientRef.current) {
      return { success: false, message: 'Client not initialized' };
    }
    return clientRef.current.runSpeakerTest();
  };

  const handleAddContact = (contact: Contact) => {
    if (!clientRef.current) return;
    clientRef.current.getDeviceBridge().addContact(contact);
    setContacts([...clientRef.current.getDeviceBridge().getContacts()]);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white relative overflow-x-hidden">
      {/* Google Maps Quota Defense Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Dynamic Ambient Background Canvas */}
      <JarvisLiveWallpaper
        audioLevel={audioLevel}
        isLiveActive={state !== 'IDLE' && state !== 'ERROR'}
      />

      {/* Floating Action Feedback Notification */}
      <ActionFeedback lastAction={lastAction} onClear={() => setLastAction(null)} />

      {/* Contacts Modal */}
      <DeviceContactsModal
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        contacts={contacts}
        onAddContact={handleAddContact}
      />

      {/* Top Navigation Bar: Settings Icon (Top-Left) & Information Icon (Top-Right) */}
      <header className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between border-b border-white/70 z-20 backdrop-blur-xl bg-white/50 shadow-[0_15px_35px_rgba(14,165,233,0.14)] rounded-b-2xl transition-all duration-300">
        {/* Top Left: Settings Icon */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 flex items-center justify-center text-slate-700 hover:text-blue-600 transition-all shadow-sm hover:scale-105 active:scale-95 group"
            title="Settings & Voice Preferences (Hotkey: S)"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-slate-600 group-hover:text-blue-600 group-hover:rotate-45 transition-transform" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm tracking-wider text-slate-900">
                  I.R.I.S
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  LIVE AI
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono hidden sm:block">
                Multimodal Assistant • CREATOR - Dev
              </p>
            </div>
          </div>
        </div>

        {/* Top Right: Screen Share, Google Maps, Platform Indicator & Information Icon */}
        <div className="flex items-center gap-2">
          {/* Live Screen Share Toggle Button */}
          <button
            type="button"
            onClick={handleToggleScreenShare}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-mono transition-all shadow-sm hover:scale-105 active:scale-95 group spring-button ${
              isScreenSharing
                ? 'bg-emerald-500 text-white font-bold border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                : 'bg-white/90 border-slate-200/90 hover:border-emerald-400 text-slate-800 hover:text-emerald-600'
            }`}
            title="See my screen / Toggle live screen share & cursor tracking (or say 'See my screen' to Iris)"
          >
            <Tv className={`w-4 h-4 ${isScreenSharing ? 'text-white animate-spin-slow' : 'text-emerald-600'}`} />
            <span className="font-semibold">{isScreenSharing ? 'Screening Live' : 'See Screen'}</span>
          </button>

          {/* Google Maps Button */}
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-400 text-xs font-mono text-slate-700 hover:text-cyan-600 transition-all shadow-sm hover:scale-105 active:scale-95 group"
            title="Open Interactive Google Maps & Live GPS Radar (Hotkey: M)"
            aria-label="Google Maps"
          >
            <MapPin className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-semibold">Google Map</span>
          </button>

          {/* Environment status indicator */}
          <div
            className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium"
            title={`Active Platform: ${platformMode.toUpperCase()}`}
          >
            {clientRef.current?.getDeviceBridge().isWindows() ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-blue-600" />
                <span>Windows PC</span>
              </>
            ) : isNativeMode ? (
              <>
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Android Native</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Universal Web</span>
              </>
            )}
          </div>

          {/* Voice selector badge button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-mono text-slate-700 transition-colors"
            title="Active voice"
          >
            <Volume2 className="w-3 h-3 text-blue-600" />
            <span>Voice: {selectedVoice}</span>
          </button>

          {/* Dedicated Information Button on Top Right */}
          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 flex items-center justify-center text-slate-700 hover:text-blue-600 transition-all shadow-sm hover:scale-105 active:scale-95 group"
            title="I.R.I.S Information & Voice Commands Guide (Hotkey: I)"
            aria-label="Information"
          >
            <Info className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
          </button>
        </div>
      </header>

      {/* Active Screen Sharing Live Banner Overlay */}
      {isScreenSharing && (
        <div className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-4 py-2 flex items-center justify-between text-xs font-mono font-bold shadow-md z-30 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <Tv className="w-4 h-4 text-emerald-100 shrink-0" />
            <span className="tracking-wider">IRIS SCREEN VIEW ACTIVE • MOUSE CURSOR TRACKED</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] text-emerald-100 font-normal">
              Iris can see your display and mouse cursor position in real time!
            </span>
            <button
              onClick={handleToggleScreenShare}
              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-rose-500 text-white transition-all spring-button font-bold text-[11px] border border-white/30"
            >
              Stop Sharing
            </button>
          </div>
        </div>
      )}

      {/* Real-Time Live Clock, Location & Timezone Bar */}
      <LocationTimeBar
        bridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onOpenReminders={() => setIsRemindersOpen(true)}
        onOpenNotes={() => setIsNotesOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenContacts={() => setIsContactsOpen(true)}
        unreadCount={unreadNotifCount}
      />

      {/* Quick Platform App Dock */}
      <div className="w-full my-1">
        <PlatformDock
          deviceBridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
          currentPlatform={platformMode}
          onSelectPlatform={(mode) => {
            setPlatformMode(mode);
            localStorage.setItem('iris_platform_mode', mode);
          }}
          onExecuteApp={(appId, query) => {
            if (clientRef.current) {
              const bridge = clientRef.current.getDeviceBridge();
              const res = bridge.openApp(appId, undefined, query);
              setLastAction({
                name: res.action || 'openApp',
                args: { appName: appId, query },
                result: res,
                timestamp: Date.now(),
              });
            }
          }}
        />
      </div>

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="w-full max-w-xl mx-auto px-4 z-20 mb-2">
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 shadow-md text-rose-900 text-xs sm:text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <RippleButton
                variant="primary"
                size="sm"
                onClick={() => setIsChatOpen(true)}
              >
                <MessageSquare className="w-3 h-3" /> Use Chat
              </RippleButton>
              <RippleButton
                variant="danger"
                size="sm"
                onClick={toggleSession}
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </RippleButton>
            </div>
          </div>
        </div>
      )}

      {/* Central Interactive Focus Area with Centralized Glowing Blue Orb & Expanded Speech Log */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-between z-10 py-2 sm:py-3 space-y-3">
        {/* Central Advanced Glowing Blue Orb bisected by Dynamic Audio Wave Line with I.R.I.S. Central Text */}
        <IrisOrb
          state={state}
          audioLevel={audioLevel}
          onClick={toggleSession}
        />

        {/* Live Conversation Stream / Speech Log - Expanded in length right up to the Chat button */}
        <div className="w-full flex-1 flex flex-col">
          <ConversationHistoryPanel
            turns={conversationTurns}
            state={state}
            onOpenPopup={(data) => {
              setGeneratedContentData(data);
              setIsGeneratedContentOpen(true);
            }}
            onOpenCamera={() => setIsCameraOpen(true)}
          />
        </div>

        {/* Dedicated Chat Panel Button at the Bottom Center */}
        <div className="pt-1 pb-2 flex justify-center w-full">
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-[0_15px_35px_rgba(37,99,235,0.35)] hover:shadow-[0_20px_45px_rgba(37,99,235,0.45)] hover:scale-105 active:scale-95 transition-all group spring-button"
            title="Open Multimodal Chat & File Lab (Hotkey: C)"
          >
            <div className="p-1 rounded-lg bg-white/20 text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span>Open Chat Panel</span>
            <span className="text-xs px-2 py-0.5 rounded bg-white/20 font-mono text-white/90">
              C
            </span>
          </button>
        </div>
      </main>

      {/* Multimodal Chat & File Lab Modal */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        deviceBridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
        onToolExecuted={(info) => {
          setLastAction({
            ...info,
            timestamp: Date.now(),
          });
        }}
        hasMicError={state === 'ERROR' || !!errorMessage}
      />

      {/* Hidden Mobile Camera Input with HTML capture='environment' */}
      <input
        id="iris-mobile-camera-capture"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              setConversationTurns((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: 'user',
                  text: `Captured camera photo: ${file.name}`,
                  file: {
                    name: file.name,
                    type: 'image',
                    mimeType: file.type || 'image/jpeg',
                    previewUrl: URL.createObjectURL(file),
                  },
                  timestamp: Date.now(),
                },
              ]);
              if (clientRef.current && (state === 'LISTENING' || state === 'SPEAKING' || state === 'CONNECTING')) {
                clientRef.current.sendFile({
                  name: file.name,
                  type: 'image',
                  mimeType: file.type || 'image/jpeg',
                  data: result,
                });
              }
            };
            reader.readAsDataURL(file);
          }
          e.target.value = '';
        }}
      />

      {/* Voice File Upload Dedicated Pop-up Modal */}
      <VoiceUploadModal
        isOpen={isVoiceUploadOpen}
        onClose={() => setIsVoiceUploadOpen(false)}
        fileType={voiceUploadType}
        irisMessage={voiceUploadPrompt}
        onSendToVoice={(file) => {
          try {
            clientRef.current?.getDeviceBridge().setUploadedFile({
              name: file.name,
              type: file.type,
              mimeType: file.mimeType,
            });

            setConversationTurns((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'user',
                text: `Sent file to Iris: ${file.name}`,
                file: {
                  name: file.name,
                  type: file.type,
                  mimeType: file.mimeType,
                  previewUrl: file.previewUrl,
                },
                timestamp: Date.now(),
              },
            ]);

            if (clientRef.current && (state === 'LISTENING' || state === 'SPEAKING' || state === 'CONNECTING')) {
              clientRef.current.sendFile(file);
            } else {
              setIsChatOpen(true);
            }
          } catch (err: any) {
            console.error('Failed to send file to voice session:', err);
          }
        }}
        onOpenInChat={() => setIsChatOpen(true)}
      />

      {/* Generated Code & Prompts Dedicated Pop-up Modal */}
      <GeneratedContentModal
        isOpen={isGeneratedContentOpen}
        onClose={() => setIsGeneratedContentOpen(false)}
        data={generatedContentData}
      />

      {/* Calendar & Meetings Management Modal */}
      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        bridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
      />

      {/* Reminders Management Modal */}
      <RemindersModal
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
        bridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
      />

      {/* Notes & Memos Management Modal */}
      <NotesModal
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        bridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
      />

      {/* Notifications & Messaging Inbox Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        bridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
        onReadAloud={async (text) => {
          try {
            const res = await fetch('/api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, voice: selectedVoice }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.audio) {
                const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                audio.play();
              }
            }
          } catch (e) {
            console.warn('TTS vocalization error:', e);
          }
        }}
      />

      {/* Settings Modal (Opened from Top-Left) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedVoice={selectedVoice}
        onSelectVoice={(voiceId) => {
          setSelectedVoice(voiceId);
          localStorage.setItem('iris_preferred_voice', voiceId);
        }}
        platformMode={platformMode}
        onSelectPlatform={(mode) => {
          setPlatformMode(mode);
          localStorage.setItem('iris_platform_mode', mode);
        }}
        onRunDiagnostic={handleSpeakerTest}
      />

      {/* Information Modal (Opened from Top-Right) */}
      <InformationModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />

      {/* Google Maps & Live GPS Radar Modal */}
      <GoogleMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        initialQuery={mapModalProps.query}
        initialCategory={mapModalProps.category}
        initialCenter={mapModalProps.center}
        initialZoom={mapModalProps.zoom}
        isLiveActive={state !== 'IDLE' && state !== 'ERROR'}
        audioLevel={audioLevel}
        onToggleSession={toggleSession}
      />

      {/* Location Access & Permission Guide Modal */}
      <LocationPermissionModal
        isOpen={isLocationPermissionOpen}
        onClose={() => setIsLocationPermissionOpen(false)}
        onRetry={() => {
          setIsLocationPermissionOpen(false);
          locationService.requestPreciseLocation(true);
        }}
      />

      {/* Iris Visual Screen Annotation & Highlight Layer */}
      <ScreenAnnotationOverlay />

      {/* Camera Snapshot Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapturePhoto={handleCameraCapture}
      />

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto px-4 py-3 text-center text-xs text-slate-500 z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Safe Device Actions Bridge • WhatsApp, Phone, Apps, URLs</span>
        </div>
        <div>
          <span>I.R.I.S Multimodal Voice Assistant • CREATOR - Dev</span>
        </div>
      </footer>
    </div>
  );
}
