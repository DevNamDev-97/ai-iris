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
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Terminal,
  History,
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
import { PersonMemoryFoldersModal } from './components/PersonMemoryFoldersModal.tsx';
import { ImageEditorModal } from './components/ImageEditorModal.tsx';
import { locationService } from './services/locationService.ts';
import { toEnglishAlphabets } from './utils/transliteration.ts';
import { crossSessionMemory } from './services/crossSessionMemory.ts';
import { speakerMemoryStore } from './services/speakerMemoryStore.ts';

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
  const [isPersonFoldersOpen, setIsPersonFoldersOpen] = useState<boolean>(false);
  const [livePitchHz, setLivePitchHz] = useState<number>(0);
  const [liveCentroidHz, setLiveCentroidHz] = useState<number>(0);
  const [liveDetectedGender, setLiveDetectedGender] = useState<'male' | 'female' | 'ambiguous'>('ambiguous');
  const [matchedSpeakerName, setMatchedSpeakerName] = useState<string>(() => {
    const active = speakerMemoryStore.getActiveFolder();
    return active.id === 'guest' || !active.name || active.name === 'Unknown Voice' ? 'Listening...' : active.name;
  });
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

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

  const [platformMode, setPlatformMode] = useState<'auto' | 'windows' | 'android'>(() => {
    return (localStorage.getItem('iris_platform_mode') as any) || 'auto';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('iris_theme') as 'light' | 'dark') || 'light';
  });
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('iris_preferred_voice') || 'Leda';
  });
  const [isVoiceUploadOpen, setIsVoiceUploadOpen] = useState<boolean>(false);
  const [voiceUploadType, setVoiceUploadType] = useState<'image' | 'video' | 'document' | 'any'>('any');
  const [voiceUploadPrompt, setVoiceUploadPrompt] = useState<string>('');
  const [isGeneratedContentOpen, setIsGeneratedContentOpen] = useState<boolean>(false);
  const [generatedContentData, setGeneratedContentData] = useState<GeneratedContentData | null>(null);
  
  // Image Editor / Modification Lab states
  const [isImageEditorOpen, setIsImageEditorOpen] = useState<boolean>(false);
  const [imageEditorInstruction, setImageEditorInstruction] = useState<string>('');
  const [imageEditorAction, setImageEditorAction] = useState<string>('general');

  // Telemetry Dock states
  const [isTelemetryDockExpanded, setIsTelemetryDockExpanded] = useState<boolean>(false);
  
  // Real-time custom top overscroll engine for fluid cinematic drawers with 90-120fps continuous physics
  const [overscrollY, setOverscrollY] = useState<number>(0);
  const [targetOverscrollY, setTargetOverscrollY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartY = useRef<number>(0);
  const wheelTimeoutRef = useRef<number | null>(null);
  const currentOverscrollYRef = useRef<number>(0);

  // Sync current value in mutable ref to avoid dependency updates in the main physics loop
  useEffect(() => {
    currentOverscrollYRef.current = overscrollY;
  }, [overscrollY]);

  // Buttery-smooth requestAnimationFrame continuous physics loop (90-120fps standard)
  useEffect(() => {
    if (isDragging) return; // Pause physics loop while dragging to let finger drag directly

    let animationFrameId: number;
    const tick = () => {
      setOverscrollY((current) => {
        const diff = targetOverscrollY - current;
        if (Math.abs(diff) < 0.05) {
          return targetOverscrollY;
        }
        // Only schedule next frame if still actively moving to avoid endless loop
        animationFrameId = requestAnimationFrame(tick);
        return current + diff * 0.28;
      });
    };
    
    // Always initiate the loop if target and current are different
    if (Math.abs(currentOverscrollYRef.current - targetOverscrollY) > 0.05) {
      animationFrameId = requestAnimationFrame(tick);
    }
    
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [targetOverscrollY, isDragging]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Ignore overscroll actions if modal dialogs are open
      if (
        isChatOpen ||
        isPersonFoldersOpen ||
        isMapOpen ||
        isCalendarOpen ||
        isRemindersOpen ||
        isNotesOpen ||
        isNotificationsOpen ||
        isContactsOpen ||
        isImageEditorOpen ||
        isSettingsOpen ||
        isGeneratedContentOpen
      ) {
        return;
      }

      setTargetOverscrollY((prev) => {
        // Pull down is scroll up (e.deltaY < 0)
        let next = prev - e.deltaY * 1.6;
        next = Math.max(0, Math.min(next, 540));
        return next;
      });

      // Stop scrolling detection to auto-complete animation smoothly to either fully opened or fully closed state
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = setTimeout(() => {
        setTargetOverscrollY((current) => {
          if (current > 140) {
            return 540; // fully open
          } else {
            return 0; // fully closed
          }
        });
      }, 150) as unknown as number;
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, [
    isChatOpen,
    isPersonFoldersOpen,
    isMapOpen,
    isCalendarOpen,
    isRemindersOpen,
    isNotesOpen,
    isNotificationsOpen,
    isContactsOpen,
    isImageEditorOpen,
    isSettingsOpen,
    isGeneratedContentOpen,
  ]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (
        isChatOpen ||
        isPersonFoldersOpen ||
        isMapOpen ||
        isCalendarOpen ||
        isRemindersOpen ||
        isNotesOpen ||
        isNotificationsOpen ||
        isContactsOpen ||
        isImageEditorOpen ||
        isSettingsOpen ||
        isGeneratedContentOpen
      ) {
        return;
      }

      // Do not hijack dragging if the user is touching inside scrollable logs, buttons, or interactive inputs
      const target = e.target as HTMLElement;
      if (target.closest('.overflow-y-auto') || target.closest('button') || target.closest('textarea') || target.closest('input')) {
        return;
      }

      dragStartY.current = e.touches[0].clientY;
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - dragStartY.current;

      setTargetOverscrollY((prev) => {
        let next = prev + deltaY * 1.6;
        next = Math.max(0, Math.min(next, 540));
        // Direct state synchronization for zero lag tracking on mobile!
        setOverscrollY(next);
        return next;
      });
      dragStartY.current = currentY;

      if (e.cancelable) e.preventDefault();
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setTargetOverscrollY((prev) => {
        if (prev > 140) {
          return 540; // smoothly complete to open
        } else {
          return 0; // smoothly complete to closed
        }
      });
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    isDragging,
    isChatOpen,
    isPersonFoldersOpen,
    isMapOpen,
    isCalendarOpen,
    isRemindersOpen,
    isNotesOpen,
    isNotificationsOpen,
    isContactsOpen,
    isImageEditorOpen,
    isSettingsOpen,
    isGeneratedContentOpen,
  ]);

  const [lastAction, setLastAction] = useState<{
    name: string;
    args: any;
    result: ToolExecutionResult;
    timestamp: number;
  } | null>(null);
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

    const unsubSpeaker = speakerMemoryStore.subscribe(() => {
      const active = speakerMemoryStore.getActiveFolder();
      setMatchedSpeakerName(active.id === 'guest' || !active.name || active.name === 'Unknown Voice' ? 'Listening...' : active.name);
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('iris-request-screenshare', handleScreenShareRequest);
      window.removeEventListener('iris-open-chat', handleOpenChatRequest);
      unsubSpeaker();
    };
  }, []);

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      clientRef.current?.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      if (state === 'IDLE') {
        try {
          await clientRef.current?.start(selectedVoice);
        } catch (e) {
          console.warn('Auto start voice session for screen share:', e);
        }
      }
      const success = await clientRef.current?.startScreenShare();
      setIsScreenSharing(!!success);
      if (!success) {
        console.log('ℹ️ [App] Display capture was not started (dialog dismissed or unsupported).');
      }
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

    const handleRequestScreenShare = async () => {
      await handleToggleScreenShare();
    };

    const handleOpenChat = () => {
      setIsChatOpen(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && clientRef.current) {
        clientRef.current.ensureAudio();
      }
    };

    const handleMapControl = (e: any) => {
      setIsMapOpen(true);
    };

    const handleOpenPersonFolders = () => {
      setIsPersonFoldersOpen(true);
    };

    const handleModifyImageRequest = (e: any) => {
      const detail = e.detail || {};
      setImageEditorInstruction(detail.instruction || '');
      setImageEditorAction(detail.action || 'general');
      setIsImageEditorOpen(true);
    };

    window.addEventListener('iris-open-map', handleOpenMap);
    window.addEventListener('iris-map-control', handleMapControl);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('iris-open-location-settings', handleOpenLocationSettings);
    window.addEventListener('iris-request-screenshare', handleRequestScreenShare);
    window.addEventListener('iris-open-chat', handleOpenChat);
    window.addEventListener('iris-open-person-folders', handleOpenPersonFolders);
    window.addEventListener('iris-modify-image-request', handleModifyImageRequest);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('iris-open-map', handleOpenMap);
      window.removeEventListener('iris-map-control', handleMapControl);
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('iris-open-location-settings', handleOpenLocationSettings);
      window.removeEventListener('iris-request-screenshare', handleRequestScreenShare);
      window.removeEventListener('iris-open-chat', handleOpenChat);
      window.removeEventListener('iris-open-person-folders', handleOpenPersonFolders);
      window.removeEventListener('iris-modify-image-request', handleModifyImageRequest);
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
        setIrisText(''); // Clear Iris captions when user starts speaking!
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
      onAcousticPitch: (data) => {
        setLivePitchHz(data.pitchHz);
        if (data.spectralCentroid) setLiveCentroidHz(data.spectralCentroid);
        if (data.detectedGender) setLiveDetectedGender(data.detectedGender);
        if (data.speakerName && data.speakerName !== 'Unknown Voice') {
          setMatchedSpeakerName(data.speakerName);
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

  const handleToggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('iris_theme', newTheme);
    if (typeof document !== 'undefined') {
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  const handleAddContact = (contact: Contact) => {
    if (!clientRef.current) return;
    clientRef.current.getDeviceBridge().addContact(contact);
    setContacts([...clientRef.current.getDeviceBridge().getContacts()]);
  };

  const isDark = theme === 'dark'; // Custom scroll physics and widget morphing engine

  // Real-time custom top overscroll values
  const overscrollProgress = Math.min(Math.max(overscrollY / 540, 0), 1);
  const dockOpacity = overscrollProgress;
  const contentOpacity = overscrollProgress < 0.25 ? 0 : (overscrollProgress - 0.25) / 0.75;
  const captionOpacity = Math.max(0, 1 - overscrollProgress * 2.5);

  // 1. TOPMOST Widget gets translated up and motion-blurred
  const getTopmostWidgetStyle = (progress: number) => {
    const translateY = -progress * 280; // translates up smoothly
    const opacity = Math.max(0, 1 - progress * 1.6);
    const blur = progress * 12; // Premium motion blur effect
    return {
      transform: `translate3d(0, ${translateY}px, 0)`,
      opacity,
      filter: blur > 0.05 ? `blur(${blur}px)` : 'none',
      willChange: 'transform, opacity, filter',
      pointerEvents: progress > 0.35 ? ('none' as const) : ('auto' as const),
    };
  };

  // 2. MIDDLE Dock moves to the right and motion-blurred
  const getMiddleDockStyle = (progress: number) => {
    const translateX = progress * 480; // translates to the right smoothly
    const opacity = Math.max(0, 1 - progress * 1.6);
    const blur = progress * 12; // Premium motion blur effect
    return {
      transform: `translate3d(${translateX}px, 0, 0)`,
      opacity,
      filter: blur > 0.05 ? `blur(${blur}px)` : 'none',
      willChange: 'transform, opacity, filter',
      pointerEvents: progress > 0.35 ? ('none' as const) : ('auto' as const),
    };
  };

  // 3. LOWER Widget moves to the left and motion-blurred
  const getLowerWidgetStyle = (progress: number) => {
    const translateX = -progress * 480; // translates to the left smoothly
    const opacity = Math.max(0, 1 - progress * 1.6);
    const blur = progress * 12; // Premium motion blur effect
    return {
      transform: `translate3d(${translateX}px, 0, 0)`,
      opacity,
      filter: blur > 0.05 ? `blur(${blur}px)` : 'none',
      willChange: 'transform, opacity, filter',
      pointerEvents: progress > 0.35 ? ('none' as const) : ('auto' as const),
    };
  };

  return (
    <div className={`h-screen overflow-hidden flex flex-col font-sans selection:bg-blue-500 selection:text-white relative transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
    }`}>
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
      <header 
        style={getTopmostWidgetStyle(overscrollProgress)}
        className={`w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between border-b z-20 backdrop-blur-xl rounded-b-2xl transition-all duration-300 ${
          isDark
            ? 'bg-slate-950/60 border-cyan-500/20 shadow-[0_15px_35px_rgba(6,182,212,0.14)] text-white'
            : 'bg-white/50 border-white/70 shadow-[0_15px_35px_rgba(14,165,233,0.14)] text-slate-900'
        }`}
      >
        {/* Top Left: Settings Icon */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all shadow-sm hover:scale-105 active:scale-95 group ${
              isDark
                ? 'bg-slate-900/90 border-slate-700/80 hover:border-cyan-400 text-slate-200 hover:text-cyan-400'
                : 'bg-white border-slate-200/90 hover:border-blue-400 text-slate-700 hover:text-blue-600'
            }`}
            title="Settings & Voice Preferences (Hotkey: S)"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-bold text-sm tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  I.R.I.S
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold border ${
                  isDark
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  LIVE AI
                </span>
              </div>
              <p className={`text-[10px] font-mono hidden sm:block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Multimodal Assistant • CREATOR - Dev
              </p>
            </div>
          </div>
        </div>

        {/* Top Right: Screen Share, Google Maps, Theme Toggle & Information Icon */}
        <div className="flex items-center gap-2">
          {/* Live Screen Share Toggle Button */}
          <button
            type="button"
            onClick={handleToggleScreenShare}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-mono transition-all shadow-sm hover:scale-105 active:scale-95 group spring-button ${
              isScreenSharing
                ? 'bg-emerald-500 text-white font-bold border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                : isDark
                ? 'bg-slate-900/90 border-slate-700 hover:border-emerald-400 text-slate-200 hover:text-emerald-400'
                : 'bg-white/90 border-slate-200/90 hover:border-emerald-400 text-slate-800 hover:text-emerald-600'
            }`}
            title="See my screen / Toggle live screen share & cursor tracking (or say 'See my screen' to Iris)"
          >
            <Tv className={`w-4 h-4 ${isScreenSharing ? 'text-white animate-spin-slow' : 'text-emerald-500'}`} />
            <span className="font-semibold">{isScreenSharing ? 'Screening Live' : 'See Screen'}</span>
          </button>

          {/* Google Maps Button */}
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-mono transition-all shadow-sm hover:scale-105 active:scale-95 group ${
              isDark
                ? 'bg-slate-900/90 border-slate-700 hover:border-cyan-400 text-slate-200 hover:text-cyan-400'
                : 'bg-white border-slate-200 hover:border-cyan-400 text-slate-700 hover:text-cyan-600'
            }`}
            title="Open Interactive Google Maps & Live GPS Radar (Hotkey: M)"
            aria-label="Google Maps"
          >
            <MapPin className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-semibold">Google Map</span>
          </button>

          {/* Quick Theme Toggle Button in Header */}
          <button
            type="button"
            onClick={() => handleToggleTheme(isDark ? 'light' : 'dark')}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all shadow-sm hover:scale-105 active:scale-95 group spring-button ${
              isDark
                ? 'bg-slate-900/90 border-slate-700/80 hover:border-cyan-400 text-cyan-400'
                : 'bg-white border-slate-200/90 hover:border-amber-400 text-amber-500'
            }`}
            title={isDark ? 'Switch to Glossy White Glass Mode' : 'Switch to Cyber Dark Mode'}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Moon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            ) : (
              <Sun className="w-5 h-5 group-hover:rotate-45 transition-transform" />
            )}
          </button>

          {/* Dedicated Information Button on Top Right */}
          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all shadow-sm hover:scale-105 active:scale-95 group ${
              isDark
                ? 'bg-slate-900/90 border-slate-700/80 hover:border-blue-400 text-slate-200 hover:text-blue-400'
                : 'bg-white border-slate-200/90 hover:border-blue-400 text-slate-700 hover:text-blue-600'
            }`}
            title="I.R.I.S Information & Voice Commands Guide (Hotkey: I)"
            aria-label="Information"
          >
            <Info className="w-5 h-5 transition-colors" />
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
      <div style={getLowerWidgetStyle(overscrollProgress)} className="w-full">
        <LocationTimeBar
          bridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
          onOpenCalendar={() => setIsCalendarOpen(true)}
          onOpenReminders={() => setIsRemindersOpen(true)}
          onOpenNotes={() => setIsNotesOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenContacts={() => setIsContactsOpen(true)}
          onOpenPersonFolders={() => setIsPersonFoldersOpen(true)}
          unreadCount={unreadNotifCount}
          theme={theme}
        />
      </div>

      {/* Quick Platform App Dock */}
      <div style={getMiddleDockStyle(overscrollProgress)} className="w-full my-1">
        <PlatformDock
          deviceBridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
          currentPlatform={platformMode}
          onSelectPlatform={(mode) => {
            setPlatformMode(mode);
            localStorage.setItem('iris_platform_mode', mode);
          }}
          onOpenChat={() => setIsChatOpen(true)}
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

      {/* Fold 1: Centered Sliding Telemetry Panel on Overscroll */}
      <section 
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: '48rem', // max-w-3xl matching main area
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
          pointerEvents: overscrollProgress > 0.65 ? 'auto' : 'none',
        }}
        className="px-4 sm:px-6"
      >
        {/* Dynamic Morphing Telemetry Container (Ball -> Line -> Box) */}
        <div 
          style={{
            width: overscrollProgress < 0.35 ? `${48 + (overscrollProgress / 0.35) * 720}px` : '100%',
            height: overscrollProgress < 0.35 ? `${48 - (overscrollProgress / 0.35) * 44}px` : `${4 + ((overscrollProgress - 0.35) / 0.65) * 446}px`,
            opacity: dockOpacity,
            filter: overscrollProgress < 0.3 ? 'blur(16px)' : `blur(${Math.max(0, (1 - overscrollProgress) * 16)}px)`,
            borderRadius: overscrollProgress < 0.35 ? '9999px' : overscrollProgress < 0.6 ? '2px' : '24px',
            boxShadow: overscrollProgress < 0.5 ? '0 0 25px rgba(6, 182, 212, 0.85)' : '0 10px 40px rgba(6, 182, 212, 0.15)',
          }}
          className={`border backdrop-blur-3xl flex flex-col relative ${
            theme === 'dark' 
              ? 'bg-slate-900/95 border-cyan-500/30' 
              : 'bg-white/95 border-blue-300 shadow-[0_10px_30px_rgba(59,130,246,0.12)]'
          }`}
        >
          {/* Faded content layer in sync with overscroll progress */}
          <div 
            style={{ 
              opacity: contentOpacity, 
              transition: 'opacity 0.1s ease-out',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%'
            }}
            className="p-5 overflow-hidden w-full h-full pb-10"
          >
            {/* Dynamic Telemetry Header */}
            <div className="flex items-center justify-between border-b border-slate-800/40 pb-3 mb-3 font-mono text-xs shrink-0">
              <div className="flex items-center gap-2 font-bold text-cyan-400">
                <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>I.R.I.S LIVE TELEMETRY LOGS</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700/20">
                  {conversationTurns.filter(t => t.role !== 'user').length} Assistant Logs
                </span>
              </div>
            </div>

            {/* Conversation list panel */}
            <div className="flex-1 overflow-y-auto pr-1">
              <ConversationHistoryPanel
                turns={conversationTurns.filter(t => t.role !== 'user')}
                state={state}
                theme={theme}
                onOpenPopup={(data) => {
                  setGeneratedContentData(data);
                  setIsGeneratedContentOpen(true);
                }}
                onOpenCamera={() => setIsCameraOpen(true)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Fold 2: Central Interactive Focus Area with Centralized Glowing Blue Orb */}
      <main 
        style={{
          transform: `translateY(${overscrollY * 0.25}px)`,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-between z-10 py-4 sm:py-6 space-y-4 h-[calc(100vh-140px)] shrink-0 relative"
      >
        {/* Centered Orb with sliding translation into bottom center bezel of Telemetry Panel (Mathematically Synchronized with 0.35 phase curve) */}
        <div 
          style={{
            transform: `translateY(${overscrollProgress < 0.35 ? 0 : ((overscrollProgress - 0.35) / 0.65) * 200}px) scale(${overscrollProgress < 0.35 ? 1.0 : 1.0 - ((overscrollProgress - 0.35) / 0.65) * 0.45})`,
            filter: `blur(${overscrollProgress * (1 - overscrollProgress) * 12}px) drop-shadow(0 0 ${15 + overscrollProgress * 25}px rgba(6,182,212,${0.25 + overscrollProgress * 0.5}))`,
          }}
          className="relative z-40 flex flex-col items-center"
        >
          {/* Central Advanced Ethereal Harmonic Ribbon Orb with I.R.I.S. Central Hologram */}
          <IrisOrb
            state={state}
            audioLevel={audioLevel}
            onClick={toggleSession}
            theme={theme}
            overscrollProgress={overscrollProgress}
          />
        </div>

        {/* Real-Time Acoustic Voice Recognition & Identified Speaker Pill */}
        <div 
          style={getLowerWidgetStyle(overscrollProgress)}
          className="flex items-center justify-center -mt-2 mb-2 z-10"
        >
          <button
            type="button"
            onClick={() => setIsPersonFoldersOpen(true)}
            title="Click to view Voice Biometrics & Person Memory Folders"
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-2 border shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              theme === 'dark'
                ? 'bg-slate-900/80 border-cyan-500/30 text-slate-200 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'bg-white/80 border-blue-200 text-slate-700 hover:border-blue-400 shadow-xs'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${state === 'IDLE' ? 'bg-slate-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span>Voice: <strong className={theme === 'dark' ? 'text-cyan-300' : 'text-blue-600'}>{matchedSpeakerName}</strong></span>
            {livePitchHz > 50 && (
              <>
                <span className="text-slate-400 font-sans">•</span>
                <span className="text-slate-400 font-mono text-[11px]">{Math.round(livePitchHz)} Hz</span>
                {liveCentroidHz > 300 && (
                  <span className="text-slate-400 font-mono text-[10px]">T:{Math.round(liveCentroidHz)}</span>
                )}
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  liveDetectedGender === 'female'
                    ? (theme === 'dark' ? 'bg-pink-950 text-pink-300 border border-pink-500/30' : 'bg-pink-100 text-pink-700')
                    : liveDetectedGender === 'male'
                    ? (theme === 'dark' ? 'bg-blue-950 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-700')
                    : (theme === 'dark' ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-600')
                }`}>
                  {liveDetectedGender === 'female' ? 'Female' : liveDetectedGender === 'male' ? 'Male' : 'Acoustic'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Beautiful Captions with Fade-in and Fade-out Transitions */}
        <div 
          style={{
            opacity: irisText && state === 'SPEAKING' ? captionOpacity : 0,
            pointerEvents: captionOpacity < 0.15 ? 'none' : 'auto',
            transform: `translateY(${overscrollProgress * 30}px)`,
            transition: 'opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1), transform 0.2s ease-out',
          }}
          className="w-full max-w-xl mx-auto px-4 my-1 flex-1 flex items-center justify-center"
        >
          <div className={`w-full p-4 rounded-2xl border text-center shadow-md relative overflow-hidden backdrop-blur-md ${
            theme === 'dark'
              ? 'bg-slate-900/90 border-cyan-500/25 text-cyan-200 shadow-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.12)]'
              : 'bg-white/95 border-blue-200 text-blue-900 shadow-blue-100/50 shadow-[0_0_15px_rgba(37,99,235,0.08)]'
          }`}>
            {/* Top tiny caption helper icon */}
            <div className="absolute top-1 right-2 flex items-center gap-1 opacity-45">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[8px] font-mono tracking-widest text-slate-400">IRIS CAPTIONS</span>
            </div>
            {/* 2-lines limited caption text block */}
            <p className="text-xs sm:text-sm font-semibold leading-relaxed line-clamp-2 overflow-hidden text-ellipsis select-text">
              {irisText || "..."}
            </p>
          </div>
        </div>

        {/* Dynamic bottom gesture instructions */}
        <div className="flex flex-col items-center gap-1 shrink-0 pb-1 w-full">
          {overscrollProgress < 0.1 ? (
            <button
              onClick={() => setOverscrollY(540)}
              className="group transition-all duration-300 flex flex-col items-center gap-1 cursor-pointer"
            >
              <div className="w-5 h-8 border-2 border-slate-500/60 rounded-full flex justify-center p-1 opacity-50 animate-bounce">
                <div className="w-1.5 h-2.5 bg-slate-500/80 rounded-full" />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-slate-500 group-hover:text-cyan-400 transition-colors uppercase">
                SCROLL UP OR PULL DOWN FOR TELEMETRY
              </span>
            </button>
          ) : (
            <button
              onClick={() => setOverscrollY(0)}
              className="group transition-all duration-300 flex flex-col items-center gap-1 cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center opacity-60 animate-bounce">
                <ChevronUp className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-cyan-400/80 group-hover:text-white transition-colors uppercase">
                SCROLL DOWN OR PUSH UP TO CLOSE
              </span>
            </button>
          )}
        </div>
      </main>

      {/* Multimodal Chat & File Lab Modal */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        theme={theme}
        deviceBridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
        onToolExecuted={(info) => {
          setLastAction({
            ...info,
            timestamp: Date.now(),
          });

          // Open the corresponding feature modal depending on which tool was executed from the text chat!
          const { name, result } = info;
          if (
            name === 'openGoogleMap' ||
            name === 'controlGoogleMap' ||
            name === 'getCurrentLocation' ||
            name === 'getPreciseLocation' ||
            name === 'searchNearbyPlaces' ||
            name === 'getDirectionsAndNavigation'
          ) {
            setIsMapOpen(true);
          } else if (
            name === 'scheduleMeeting' ||
            name === 'createCalendarEvent' ||
            name === 'listCalendarEvents'
          ) {
            setIsCalendarOpen(true);
          } else if (
            name === 'setReminder' ||
            name === 'addReminder' ||
            name === 'listReminders'
          ) {
            setIsRemindersOpen(true);
          } else if (
            name === 'createNote' ||
            name === 'listNotes'
          ) {
            setIsNotesOpen(true);
          } else if (
            name === 'readNotifications' ||
            name === 'replyNotification'
          ) {
            setIsNotificationsOpen(true);
          } else if (
            (name === 'showGeneratedContent' || name === 'showLink' || name === 'retrieveFile') &&
            result?.data
          ) {
            setGeneratedContentData(result.data);
            setIsGeneratedContentOpen(true);
          } else if (name === 'modifyImage' || name === 'editImage') {
            setImageEditorInstruction(info.args?.instruction || '');
            setImageEditorAction(info.args?.action || 'general');
            setIsImageEditorOpen(true);
          }
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
        theme={theme}
        onToggleTheme={handleToggleTheme}
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

      {/* Multimodal Image Modification Lab & Canvas Modal */}
      <ImageEditorModal
        isOpen={isImageEditorOpen}
        onClose={() => setIsImageEditorOpen(false)}
        bridge={clientRef.current ? clientRef.current.getDeviceBridge() : new DeviceActionBridge()}
        initialInstruction={imageEditorInstruction}
        initialAction={imageEditorAction}
      />

      {/* Iris Visual Screen Annotation & Highlight Layer */}
      <ScreenAnnotationOverlay />

      {/* Camera Snapshot Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapturePhoto={handleCameraCapture}
      />

      {/* Person-Specific Memory Folders & Voice Recognition Modal */}
      <PersonMemoryFoldersModal
        isOpen={isPersonFoldersOpen}
        onClose={() => setIsPersonFoldersOpen(false)}
        currentPitchHz={livePitchHz}
        detectedSpeakerName={matchedSpeakerName}
        theme={theme}
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
