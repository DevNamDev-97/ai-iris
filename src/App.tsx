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
  X,
} from 'lucide-react';
import { screenShareService } from './services/screenShareService.ts';
import { LiveClient, AssistantState } from './services/liveClient.ts';
import { DeviceActionBridge, ToolExecutionResult, Contact } from './services/deviceActionBridge.ts';
import { IrisOrb } from './components/IrisOrb.tsx';
import { JarvisLiveWallpaper } from './components/JarvisLiveWallpaper.tsx';
import { ConversationHistoryPanel, HistoryTurn } from './components/ConversationHistoryPanel.tsx';
import { ConversationHistoryModal } from './components/ConversationHistoryModal.tsx';
import { DeleteHistoryModal } from './components/DeleteHistoryModal.tsx';
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
import { ImageEditorModal } from './components/ImageEditorModal.tsx';
import { SpreadsheetGridModal, StructuredListData } from './components/SpreadsheetGridModal.tsx';
import { locationService } from './services/locationService.ts';
import { toEnglishAlphabets } from './utils/transliteration.ts';
import { crossSessionMemory } from './services/crossSessionMemory.ts';

const BEFORE_DEV_IDENTIFICATION_MESSAGES = [
  "To identify you as Dev, please write the password in the popup I generated.",
  "Aapko Dev ke roop mein verify karne ke liye, kripya screen par aaye pop-up mein password enter kijiye.",
  "To verify your developer identity, please enter the password in the pop-up window.",
  "Dev identity verification: Kripya screen ke pop-up mein password enter kijiye.",
];

const AFTER_DEV_IDENTIFICATION_MESSAGES = [
  "Arey Dev mere creator! Pehchaan confirm ho gayi! Ab har baar password daalne ki koi jhanjhat nahi hai, bol aaj kya banayein?",
  "Mast yaar Dev, full creator session unlock ho gaya! Ab bina kisi password ke direct baat karenge. Bata kya hukum hai mere creator?",
  "Access granted! Welcome back Dev! Ab se session permanent unlock hai, bol bhai aaj kya scene hai?",
  "Identity verified! Arre Dev yaar, welcome back! Ab tujhe baar baar password likhne ki bilkul zaroorat nahi hai. Bata kya kaam hai?",
  "Verification successful! Welcome Dev, full creator control unlock ho chuka hai. Bol mere creator, kya create karein?",
  "Security cleared! Pehchaan pakki ho gayi Dev. Ab koi password nahi chahiye, bol kya dekhna hai ya chalaana hai?",
];

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
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyPersonFilter, setHistoryPersonFilter] = useState<string>('All');
  const [isDeleteHistoryModalOpen, setIsDeleteHistoryModalOpen] = useState<boolean>(false);
  const [deleteHistoryTargetPerson, setDeleteHistoryTargetPerson] = useState<string>('All');
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isRemindersOpen, setIsRemindersOpen] = useState<boolean>(false);
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [devPasswordPromptMessage, setDevPasswordPromptMessage] = useState<string>(() => BEFORE_DEV_IDENTIFICATION_MESSAGES[0]);
  const [devPasswordInput, setDevPasswordInput] = useState<string>('');
  const [isRebootModalOpen, setIsRebootModalOpen] = useState<boolean>(false);
  const [rebootPasswordInput, setRebootPasswordInput] = useState<string>('');
  const [rebootFeedbackMessage, setRebootFeedbackMessage] = useState<string>('');
  const [isDeveloperAuthenticated, setIsDeveloperAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('iris_is_developer') === 'true';
  });
  const [hasDeveloperAuthenticationFailed, setHasDeveloperAuthenticationFailed] = useState<boolean>(() => {
    return localStorage.getItem('iris_developer_failed') === 'true';
  });
  const [authFeedbackMessage, setAuthFeedbackMessage] = useState<string>('');
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
  
  // Professional Interactive Excel Spreadsheet & Grid Catalog states
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState<boolean>(false);
  const [spreadsheetData, setSpreadsheetData] = useState<StructuredListData | null>(null);
  
  // Image Editor / Modification Lab states
  const [isImageEditorOpen, setIsImageEditorOpen] = useState<boolean>(false);
  const [imageEditorInstruction, setImageEditorInstruction] = useState<string>('');
  const [imageEditorAction, setImageEditorAction] = useState<string>('general');

  // Real-Time Word-by-Word Synchronized Speech Caption Engine (Blink-Free Stable Keys)
  const [isCaptionVisible, setIsCaptionVisible] = useState<boolean>(false);
  const [spokenWords, setSpokenWords] = useState<Array<{ id: number; text: string }>>([]);
  const wordsQueueRef = useRef<string[]>([]);
  const captionFadeTimeoutRef = useRef<number | null>(null);
  const wordIdCounterRef = useRef<number>(0);

  // Dynamic Adaptive Speed Word-by-Word Speech Caption Engine
  useEffect(() => {
    let timeoutId: number | null = null;

    const tick = () => {
      if (wordsQueueRef.current.length > 0) {
        const nextWord = wordsQueueRef.current.shift()!;
        setIsCaptionVisible(true);
        const newWordObj = { id: ++wordIdCounterRef.current, text: nextWord };
        setSpokenWords((prev) => {
          const updated = [...prev, newWordObj];
          if (updated.length > 18) {
            return updated.slice(updated.length - 18);
          }
          return updated;
        });

        if (captionFadeTimeoutRef.current) clearTimeout(captionFadeTimeoutRef.current);
        captionFadeTimeoutRef.current = setTimeout(() => {
          setIsCaptionVisible(false);
          setSpokenWords([]);
        }, 3200) as unknown as number;

        // Dynamic speed adaptation: if queue has many words, speed up to keep exact audio sync!
        const queueLen = wordsQueueRef.current.length;
        const delay = queueLen > 8 ? 35 : queueLen > 3 ? 55 : 90;
        timeoutId = setTimeout(tick, delay) as unknown as number;
      } else {
        timeoutId = setTimeout(tick, 100) as unknown as number;
      }
    };

    timeoutId = setTimeout(tick, 90) as unknown as number;

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Smooth gesture overscroll engine (Windows Wheel + Android Touch Swipe)
  const [overscrollY, setOverscrollY] = useState<number>(0);
  const targetOverscrollRef = useRef<number>(0);
  const currentOverscrollRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const wheelTimeoutRef = useRef<number | null>(null);
  const isTouchDraggingRef = useRef<boolean>(false);
  const isTouchBlockedRef = useRef<boolean>(false);
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);

  const updateOverscroll = (newTarget: number) => {
    targetOverscrollRef.current = Math.max(0, Math.min(newTarget, 540));
    if (animFrameRef.current === null) {
      const step = () => {
        const diff = targetOverscrollRef.current - currentOverscrollRef.current;
        if (Math.abs(diff) < 0.15) {
          currentOverscrollRef.current = targetOverscrollRef.current;
          setOverscrollY(targetOverscrollRef.current);
          animFrameRef.current = null;
          return;
        }
        currentOverscrollRef.current += diff * 0.22;
        setOverscrollY(currentOverscrollRef.current);
        animFrameRef.current = requestAnimationFrame(step);
      };
      animFrameRef.current = requestAnimationFrame(step);
    }
  };

  // Wheel listener for Windows / macOS (Mouse Wheel & Trackpad)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (
        isChatOpen ||
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

      const target = e.target as HTMLElement;
      if (target && target.closest('.overflow-y-auto')) {
        return;
      }

      const delta = e.deltaY;
      const nextTarget = targetOverscrollRef.current - delta * 1.2;
      updateOverscroll(nextTarget);

      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = setTimeout(() => {
        if (targetOverscrollRef.current > 120) {
          updateOverscroll(540);
        } else {
          updateOverscroll(0);
        }
      }, 180) as unknown as number;
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, [
    isChatOpen,
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

  // Touch Swipe listener for Android / Mobile
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (
        isChatOpen ||
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
        isTouchBlockedRef.current = true;
        return;
      }

      const target = e.target as HTMLElement;
      // CRITICAL: NEVER hijack touch start on scrollable logs, buttons, inputs, links, dock, or widgets!
      if (
        target.closest('.overflow-y-auto') ||
        target.closest('.overflow-x-auto') ||
        target.closest('button') ||
        target.closest('textarea') ||
        target.closest('input') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('.iris-orb-container')
      ) {
        isTouchBlockedRef.current = true;
        return;
      }

      isTouchBlockedRef.current = false;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartXRef.current = e.touches[0].clientX;
      isTouchDraggingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isTouchBlockedRef.current) return;
      if (!e.touches[0]) return;

      const target = e.target as HTMLElement;
      if (target && (target.closest('.overflow-y-auto') || target.closest('.overflow-x-auto'))) {
        return;
      }

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartYRef.current;
      const deltaX = currentX - touchStartXRef.current;

      if (!isTouchDraggingRef.current) {
        if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
          isTouchDraggingRef.current = true;
        } else {
          return;
        }
      }

      const nextTarget = targetOverscrollRef.current + deltaY * 1.4;
      updateOverscroll(nextTarget);
      touchStartYRef.current = currentY;
    };

    const handleTouchEnd = () => {
      if (isTouchBlockedRef.current) {
        isTouchBlockedRef.current = false;
        return;
      }

      if (isTouchDraggingRef.current) {
        isTouchDraggingRef.current = false;
        if (targetOverscrollRef.current > 120) {
          updateOverscroll(540);
        } else {
          updateOverscroll(0);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    isChatOpen,
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

  // Central function to update user interaction timestamp
  const recordInteraction = () => {
    localStorage.setItem('iris_last_interaction_timestamp', Date.now().toString());
  };

  // Check and enforce Developer Inactivity Timeout (1 hour = 3600000ms)
  const checkDeveloperInactivityTimeout = () => {
    const isDeveloper = localStorage.getItem('iris_is_developer') === 'true';
    if (isDeveloper) {
      const lastInteraction = localStorage.getItem('iris_last_interaction_timestamp');
      if (lastInteraction) {
        const diff = Date.now() - parseInt(lastInteraction, 10);
        if (diff > 3600000) { // 1 hour threshold
          console.log("🕒 [App] Dev session expired due to 1 hour of inactivity. Resetting identity.");
          localStorage.removeItem('iris_is_developer');
          localStorage.removeItem('iris_developer_failed');
          setIsDeveloperAuthenticated(false);
          setHasDeveloperAuthenticationFailed(false);
          if (clientRef.current) {
            clientRef.current.stop();
          }
        }
      } else {
        recordInteraction();
      }
    }
  };

  const triggerDeveloperRejectionGreeting = async () => {
    if (clientRef.current && clientRef.current.getState() !== 'IDLE' && clientRef.current.getState() !== 'ERROR') {
      clientRef.current.sendAuthUpdate(false);
      return;
    }

    const guestGreeting = "Aapka verification fail ho gaya hai. Main aapki kaise sahayata kar sakti hoon, Sir/Ma'am?";
    setIrisText(guestGreeting);
    try {
      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: guestGreeting, voice: selectedVoice })
      });
      if (ttsRes.ok) {
        const ttsData = await ttsRes.json();
        if (ttsData.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${ttsData.audio}`);
          audio.play();
        }
      }
    } catch (err) {
      console.warn('Developer rejection verbalization error:', err);
    }
  };

  useEffect(() => {
    // Check timeout immediately on load
    checkDeveloperInactivityTimeout();

    const interval = setInterval(() => {
      setIsScreenSharing(screenShareService.getIsSharing());
      checkDeveloperInactivityTimeout();
    }, 1000);

    const handleScreenShareRequest = () => {
      console.log('🖥️ [App] iris-request-screenshare event received! Triggering screen share...');
      handleToggleScreenShare();
    };

    const handleOpenChatRequest = () => {
      console.log('💬 [App] iris-open-chat event received! Opening chat panel...');
      setIsChatOpen(true);
    };

    // Track user activity at document level (all clicks, swipes, pointer gestures, and keystrokes)
    const handleUserActivity = () => {
      recordInteraction();
    };

    document.addEventListener('pointerdown', handleUserActivity, { passive: true });
    document.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('iris-request-screenshare', handleScreenShareRequest);
    window.addEventListener('iris-open-chat', handleOpenChatRequest);

    return () => {
      clearInterval(interval);
      document.removeEventListener('pointerdown', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
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

    const handleModifyImageRequest = (e: any) => {
      const detail = e.detail || {};
      setImageEditorInstruction(detail.instruction || '');
      setImageEditorAction(detail.action || 'general');
      setIsImageEditorOpen(true);
    };

    const handleDevChallenge = () => {
      const chosen = BEFORE_DEV_IDENTIFICATION_MESSAGES[Math.floor(Math.random() * BEFORE_DEV_IDENTIFICATION_MESSAGES.length)];
      setDevPasswordPromptMessage(chosen);
      setIsPasswordModalOpen(true);
    };

    const handleRebootChallenge = () => {
      setIsRebootModalOpen(true);
    };

    const handleShowStructuredList = (e: any) => {
      const detail = e.detail;
      if (detail) {
        setSpreadsheetData(detail);
        setIsSpreadsheetOpen(true);
      }
    };

    const handleUpdateSpreadsheet = (e: any) => {
      const { action, rowData, columnData, rowId, rowIndex, columnKey, value, title, description } = e.detail || {};
      setSpreadsheetData((prev) => {
        if (!prev) return prev;
        let updatedRows = [...prev.rows];
        let updatedCols = [...prev.columns];
        let updatedTitle = prev.title;
        let updatedDesc = prev.description;

        if (action === 'add_row' && rowData) {
          updatedRows.push({ id: rowData.id || `r_${Date.now()}`, ...rowData });
        } else if (action === 'update_cell' && columnKey !== undefined) {
          const rIdx = typeof rowIndex === 'number' ? rowIndex : updatedRows.findIndex((r) => r.id === rowId);
          if (rIdx >= 0 && updatedRows[rIdx]) {
            updatedRows[rIdx] = { ...updatedRows[rIdx], [columnKey]: value };
          }
        } else if (action === 'update_row' && rowData) {
          const rIdx = typeof rowIndex === 'number' ? rowIndex : updatedRows.findIndex((r) => r.id === (rowId || rowData.id));
          if (rIdx >= 0) {
            updatedRows[rIdx] = { ...updatedRows[rIdx], ...rowData };
          }
        } else if (action === 'delete_row') {
          if (typeof rowIndex === 'number') {
            updatedRows.splice(rowIndex, 1);
          } else if (rowId) {
            updatedRows = updatedRows.filter((r) => r.id !== rowId);
          }
        } else if (action === 'add_column' && columnData) {
          if (!updatedCols.some((c) => c.key === columnData.key)) {
            updatedCols.push(columnData);
          }
        } else if (action === 'update_title' && title) {
          updatedTitle = title;
          if (description) updatedDesc = description;
        }

        const newSheet = {
          ...prev,
          title: updatedTitle,
          description: updatedDesc,
          columns: updatedCols,
          rows: updatedRows,
        };

        // Sync with backend API
        fetch('/api/spreadsheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSheet),
        }).catch((err) => console.warn('Spreadsheet sync error:', err));

        return newSheet;
      });
    };

    const handleSaveSpreadsheetSync = async (e: any) => {
      const { saveTo, personName } = e.detail || {};
      if (spreadsheetData) {
        try {
          await fetch('/api/spreadsheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...spreadsheetData,
              savedIn: saveTo || 'person_folder',
              personName: personName || 'Dev',
            }),
          });
        } catch (err) {
          console.warn('Error saving spreadsheet sync:', err);
        }
      }
    };

    window.addEventListener('iris-open-map', handleOpenMap);
    window.addEventListener('iris-map-control', handleMapControl);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('iris-open-location-settings', handleOpenLocationSettings);
    window.addEventListener('iris-request-screenshare', handleRequestScreenShare);
    window.addEventListener('iris-open-chat', handleOpenChat);
    window.addEventListener('iris-dev-challenge', handleDevChallenge);
    window.addEventListener('iris-reboot-challenge', handleRebootChallenge);
    window.addEventListener('iris-modify-image-request', handleModifyImageRequest);
    window.addEventListener('iris-show-structured-list', handleShowStructuredList);
    window.addEventListener('iris-update-spreadsheet', handleUpdateSpreadsheet);
    window.addEventListener('iris-save-spreadsheet-sync', handleSaveSpreadsheetSync);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('iris-open-map', handleOpenMap);
      window.removeEventListener('iris-map-control', handleMapControl);
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('iris-open-location-settings', handleOpenLocationSettings);
      window.removeEventListener('iris-request-screenshare', handleRequestScreenShare);
      window.removeEventListener('iris-open-chat', handleOpenChat);
      window.removeEventListener('iris-dev-challenge', handleDevChallenge);
      window.removeEventListener('iris-reboot-challenge', handleRebootChallenge);
      window.removeEventListener('iris-modify-image-request', handleModifyImageRequest);
      window.removeEventListener('iris-show-structured-list', handleShowStructuredList);
      window.removeEventListener('iris-update-spreadsheet', handleUpdateSpreadsheet);
      window.removeEventListener('iris-save-spreadsheet-sync', handleSaveSpreadsheetSync);
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

        if (newState === 'SPEAKING') {
          if (captionFadeTimeoutRef.current) {
            clearTimeout(captionFadeTimeoutRef.current);
            captionFadeTimeoutRef.current = null;
          }
          setIsCaptionVisible(true);
        } else if (newState === 'LISTENING' || newState === 'IDLE' || newState === 'ERROR') {
          // When Iris finishes speaking, fade out caption
          if (captionFadeTimeoutRef.current) clearTimeout(captionFadeTimeoutRef.current);
          captionFadeTimeoutRef.current = setTimeout(() => {
            setIsCaptionVisible(false);
            setSpokenWords([]);
          }, 3200) as unknown as number;

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
        if (!cleanText.trim()) return;

        // Push individual words into queue for word-by-word real-time speech sync
        const words = cleanText.split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          wordsQueueRef.current.push(...words);
          setIsCaptionVisible(true);
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
      },
      onUserTranscription: (text) => {
        const cleanUserText = toEnglishAlphabets(text);
        setUserText(cleanUserText);
        wordsQueueRef.current = [];
        setSpokenWords([]);
        setIsCaptionVisible(false);
        if (captionFadeTimeoutRef.current) clearTimeout(captionFadeTimeoutRef.current);
        if (!cleanUserText.trim()) return;

        // Auto-detect Dev claim to show password pop-up
        const lowerText = cleanUserText.toLowerCase();
        const matchesClaim = 
          lowerText.includes("i am dev") || 
          lowerText.includes("i'm dev") || 
          lowerText.includes("main dev") || 
          lowerText.includes("mein dev") || 
          lowerText.includes("he is dev") || 
          lowerText.includes("she is dev") || 
          lowerText.includes("i am developer") ||
          lowerText.includes("main developer") ||
          lowerText.includes("mein developer") ||
          lowerText.includes("i am the dev");

        if (matchesClaim && !isDeveloperAuthenticated && !hasDeveloperAuthenticationFailed) {
          setIsPasswordModalOpen(true);
        }

        const isRebootRequested = 
          lowerText.includes("reboot") || 
          lowerText.includes("restart") || 
          lowerText.includes("system reboot") ||
          lowerText.includes("reboot system");

        if (isRebootRequested) {
          setIsRebootModalOpen(true);
        }

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
        } else if (
          actionInfo.name === 'showStructuredList' || 
          actionInfo.name === 'createSpreadsheet' || 
          actionInfo.name === 'showSpreadsheet' || 
          actionInfo.name === 'createGridList'
        ) {
          if (actionInfo.result?.data) {
            setSpreadsheetData(actionInfo.result.data);
            setIsSpreadsheetOpen(true);
          }
        } else if (
          actionInfo.name === 'triggerRebootChallenge' || 
          actionInfo.name === 'rebootChallenge' || 
          actionInfo.name === 'rebootSystem'
        ) {
          setIsRebootModalOpen(true);
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
      onShowStructuredList: (data) => {
        setSpreadsheetData(data);
        setIsSpreadsheetOpen(true);
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
        if (targetOverscrollRef.current > 0) updateOverscroll(0);
        else if (isSpreadsheetOpen) setIsSpreadsheetOpen(false);
        else if (isMapOpen) setIsMapOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
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
      } else if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey) {
        updateOverscroll(targetOverscrollRef.current > 0 ? 0 : 540);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [overscrollY, isSpreadsheetOpen, isMapOpen, isSettingsOpen, isInfoOpen, isChatOpen, isGeneratedContentOpen, isVoiceUploadOpen, isContactsOpen, isCalendarOpen, isRemindersOpen, isNotesOpen, isNotificationsOpen, state, selectedVoice]);

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

  const isDark = theme === 'dark';
  const overscrollProgress = Math.min(Math.max(overscrollY / 540, 0), 1);
  const dockOpacity = overscrollProgress;
  const contentOpacity = overscrollProgress < 0.25 ? 0 : (overscrollProgress - 0.25) / 0.75;

  // 1. TOPMOST Widget gets translated up and motion-blurred
  const getTopmostWidgetStyle = (progress: number) => {
    const translateY = -progress * 280;
    const opacity = Math.max(0, 1 - progress * 1.6);
    const blur = progress * 12;
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
    const translateX = progress * 480;
    const opacity = Math.max(0, 1 - progress * 1.6);
    const blur = progress * 12;
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
    const translateX = -progress * 480;
    const opacity = Math.max(0, 1 - progress * 1.6);
    const blur = progress * 12;
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
        theme={theme}
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
        className={`w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between border-b z-20 backdrop-blur-xl rounded-b-2xl transition-colors duration-200 ${
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
          theme={theme}
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
          top: '42%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: '48rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
          pointerEvents: overscrollProgress > 0.35 ? 'auto' : 'none',
        }}
        className="px-4 sm:px-6"
      >
        {/* Dynamic Morphing Telemetry Container (Ball -> Box) */}
        <div 
          style={{
            width: overscrollProgress < 0.25 ? `${48 + (overscrollProgress / 0.25) * 720}px` : '100%',
            height: `${Math.min(410, Math.max(48, overscrollProgress * 410))}px`,
            opacity: dockOpacity,
            filter: overscrollProgress < 0.2 ? 'blur(12px)' : `blur(${Math.max(0, (1 - overscrollProgress) * 12)}px)`,
            borderRadius: overscrollProgress < 0.35 ? '9999px' : '24px',
            boxShadow: overscrollProgress < 0.5 ? '0 0 25px rgba(6, 182, 212, 0.85)' : '0 10px 40px rgba(6, 182, 212, 0.15)',
            willChange: 'width, height, opacity, filter, border-radius',
          }}
          className={`border backdrop-blur-3xl flex flex-col relative overflow-hidden ${
            theme === 'dark' 
              ? 'bg-slate-900/95 border-cyan-500/30' 
              : 'bg-white/95 border-blue-300 shadow-[0_10px_30px_rgba(59,130,246,0.12)]'
          }`}
        >
          {/* Floating Close Button at Top-Center */}
          {overscrollProgress > 0.4 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
              <button
                type="button"
                onClick={() => updateOverscroll(0)}
                className="px-4 py-1 rounded-full bg-slate-900/95 hover:bg-rose-600 text-slate-200 hover:text-white border border-cyan-500/40 hover:border-rose-400 shadow-xl backdrop-blur-md flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer active:scale-95 group"
                title="Close Telemetry Panel"
              >
                <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200 text-cyan-400 group-hover:text-white" />
                <span>CLOSE TELEMETRY</span>
              </button>
            </div>
          )}

          {/* Faded content layer in sync with overscroll progress */}
          <div 
            style={{ 
              opacity: contentOpacity, 
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%'
            }}
            className={`p-5 overflow-hidden w-full h-full pb-10 ${overscrollProgress > 0.4 ? 'pt-10' : ''}`}
          >
            {/* Dynamic Telemetry Header */}
            <div className="flex items-center justify-between border-b border-slate-800/40 pb-3 mb-3 font-mono text-xs shrink-0">
              <div className="flex items-center gap-2 font-bold text-cyan-400">
                <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>I.R.I.S LIVE TELEMETRY LOGS</span>
              </div>
              <div className="flex items-center gap-2 font-bold">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] bg-slate-800/80 text-slate-300 px-2.5 py-0.5 rounded border border-slate-700/40">
                  {conversationTurns.filter(t => t.role !== 'user').length} Assistant Logs
                </span>
                <button
                  type="button"
                  onClick={() => updateOverscroll(0)}
                  className="w-6 h-6 rounded-lg border border-slate-700 hover:border-rose-400 text-slate-400 hover:text-rose-400 bg-slate-800/60 flex items-center justify-center transition-all ml-1 cursor-pointer"
                  title="Close Telemetry Panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
          willChange: 'transform',
        }}
        className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-between z-10 py-2 sm:py-4 space-y-2 h-[calc(100vh-140px)] shrink-0 relative"
      >
        {/* Centered Orb with attached Captions directly beneath it */}
        <div 
          style={{
            transform: `translateY(${overscrollProgress < 0.35 ? 0 : ((overscrollProgress - 0.35) / 0.65) * 140}px) scale(${overscrollProgress < 0.35 ? 1.0 : 1.0 - ((overscrollProgress - 0.35) / 0.65) * 0.48})`,
            filter: `blur(${overscrollProgress * (1 - overscrollProgress) * 12}px) drop-shadow(0 0 ${15 + overscrollProgress * 25}px rgba(6,182,212,${0.25 + overscrollProgress * 0.5}))`,
            willChange: 'transform, filter',
          }}
          className="relative z-50 flex flex-col items-center w-full max-w-lg"
        >
          {/* Central Advanced Ethereal Harmonic Ribbon Orb with I.R.I.S. Central Hologram */}
          <IrisOrb
            state={state}
            audioLevel={audioLevel}
            onClick={toggleSession}
            theme={theme}
            overscrollProgress={overscrollProgress}
          />

          {/* Captions directly attached beneath the Orb! Word-by-Word Progressive Speech Sync */}
          <div 
            style={{
              opacity: spokenWords.length > 0 && isCaptionVisible ? Math.max(0, 1 - overscrollProgress * 2.5) : 0,
              pointerEvents: spokenWords.length > 0 && isCaptionVisible && overscrollProgress < 0.3 ? 'auto' : 'none',
              transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="w-full px-2 mt-1 sm:mt-2"
          >
            <div className={`w-full p-2.5 sm:p-3 rounded-2xl border text-center shadow-md relative overflow-hidden backdrop-blur-md transition-all ${
              theme === 'dark'
                ? 'bg-slate-900/90 border-cyan-500/30 text-cyan-200 shadow-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                : 'bg-white/95 border-blue-200 text-blue-900 shadow-blue-100/50 shadow-[0_0_15px_rgba(37,99,235,0.08)]'
            }`}>
              {/* Top tiny caption helper header */}
              <div className="flex items-center justify-between opacity-50 mb-1 font-mono text-[9px] uppercase tracking-widest px-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-slate-400 font-bold">IRIS SPEECH SYNCHRONIZED CAPTIONS</span>
                </div>
                <span className="text-[8px] text-cyan-400 font-bold">WORD BY WORD</span>
              </div>
              {/* Word-by-Word Progressive Reveal */}
              <div className="px-1 text-xs sm:text-sm font-semibold leading-relaxed min-h-[2.25rem] flex items-center justify-center flex-wrap gap-1">
                {spokenWords.length > 0 ? (
                  spokenWords.map((wordObj) => (
                    <span 
                      key={wordObj.id}
                      className="inline-block animate-bubble-pop transition-all duration-150"
                    >
                      {wordObj.text}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 italic font-normal text-xs">...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic bottom gesture instructions */}
        <div className="flex flex-col items-center gap-1 shrink-0 pb-1 w-full">
          {overscrollProgress < 0.2 ? (
            <button
              type="button"
              onClick={() => updateOverscroll(540)}
              className="group transition-all duration-300 flex flex-col items-center gap-1 cursor-pointer py-1 px-4 rounded-2xl hover:bg-slate-800/20 active:scale-95"
              title="Scroll or Tap for Telemetry Logs"
            >
              <div className="w-5 h-7 border-2 border-slate-500/60 rounded-full flex justify-center p-1 opacity-60 group-hover:opacity-100 group-hover:border-cyan-400 transition-all">
                <div className="w-1.5 h-2 bg-slate-500/80 group-hover:bg-cyan-400 rounded-full animate-bounce" />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-slate-500 group-hover:text-cyan-400 transition-colors uppercase font-bold">
                SCROLL OR TAP FOR TELEMETRY
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => updateOverscroll(0)}
              className="group transition-all duration-300 flex flex-col items-center gap-1 cursor-pointer py-1 px-4 rounded-2xl hover:bg-slate-800/20 active:scale-95"
              title="Close Telemetry Panel"
            >
              <div className="w-5 h-5 flex items-center justify-center opacity-70 group-hover:opacity-100 animate-bounce">
                <ChevronUp className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-cyan-400 group-hover:text-white transition-colors uppercase font-bold">
                CLOSE TELEMETRY
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
        isDeveloperAuthenticated={isDeveloperAuthenticated}
        hasDeveloperAuthenticationFailed={hasDeveloperAuthenticationFailed}
        onTriggerDevChallenge={() => setIsPasswordModalOpen(true)}
        onTriggerRebootChallenge={() => setIsRebootModalOpen(true)}
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
            name === 'openConversationHistory' ||
            name === 'openChatHistory' ||
            name === 'showConversationHistory'
          ) {
            setHistoryPersonFilter(info.args?.personName || info.args?.name || 'Latest');
            setIsHistoryModalOpen(true);
          } else if (
            name === 'triggerDeleteHistoryChallenge' ||
            name === 'deleteConversationHistory' ||
            name === 'deleteChatHistory'
          ) {
            setDeleteHistoryTargetPerson(info.args?.personName || info.args?.name || 'All');
            setIsDeleteHistoryModalOpen(true);
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

      {/* Conversation & Delete History Modals */}
      <ConversationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        initialPersonName={historyPersonFilter}
        theme={theme}
        onRequestDeletePerson={(person) => {
          setDeleteHistoryTargetPerson(person);
          setIsDeleteHistoryModalOpen(true);
        }}
      />

      <DeleteHistoryModal
        isOpen={isDeleteHistoryModalOpen}
        onClose={() => setIsDeleteHistoryModalOpen(false)}
        personName={deleteHistoryTargetPerson}
        theme={theme}
        onSuccess={(msg) => {
          setAuthFeedbackMessage(msg);
        }}
      />

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

      {/* Professional Interactive Excel Spreadsheet & Grid Catalog Modal */}
      <SpreadsheetGridModal
        isOpen={isSpreadsheetOpen}
        onClose={() => setIsSpreadsheetOpen(false)}
        data={spreadsheetData}
        onUpdateData={(updated) => setSpreadsheetData(updated)}
        theme={theme}
      />

      {/* System Reboot Challenge Modal */}
      {isRebootModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-motion-blur-in">
          <div className={`w-full max-w-md p-6 rounded-3xl border flex flex-col shadow-2xl relative ${
            theme === 'dark'
              ? 'bg-slate-900/90 border-red-500/30 text-white shadow-red-500/10'
              : 'bg-white border-red-200 text-slate-900 shadow-red-500/10'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-red-500 animate-spin-slow animate-spin" />
              <h3 className="text-sm font-mono tracking-wider font-bold uppercase text-red-500">System Reboot</h3>
            </div>
            <p className="text-xs sm:text-sm font-semibold mb-4 leading-relaxed">
              to authorize system reboot, kindly write the password in the pop-up
            </p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const trimmedInput = rebootPasswordInput.trim();
              if (trimmedInput === 'pneumonoultramicroscopicsillicovolcanosis') {
                setRebootFeedbackMessage('Authorizing reboot... Please wait.');
                
                try {
                  const res = await fetch('/api/memory/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                  });
                  
                  if (res.ok) {
                    setRebootFeedbackMessage('Reboot successful! Starting fresh session...');
                    
                    localStorage.removeItem('iris_is_developer');
                    localStorage.removeItem('iris_developer_failed');
                    setIsDeveloperAuthenticated(false);
                    setHasDeveloperAuthenticationFailed(false);
                    setConversationTurns([]);
                    setIrisText('');
                    setUserText('');
                    setIsSpreadsheetOpen(false);
                    setIsPasswordModalOpen(false);
                    setIsCameraOpen(false);
                    setIsMapOpen(false);
                    setIsNotesOpen(false);
                    setIsRemindersOpen(false);
                    setIsCalendarOpen(false);
                    setIsNotificationsOpen(false);
                    setIsContactsOpen(false);
                    setIsImageEditorOpen(false);
                    setIsVoiceUploadOpen(false);
                    setIsGeneratedContentOpen(false);
                    
                    // Trigger dynamic welcome message reset across panels
                    window.dispatchEvent(new CustomEvent('iris-system-rebooted'));
                    
                    if (clientRef.current) {
                      clientRef.current.stop();
                    }
                    
                    setTimeout(() => {
                      setIsRebootModalOpen(false);
                      setRebootPasswordInput('');
                      setRebootFeedbackMessage('');
                      setIrisText('System reboot completed successfully! Shuru se shuru karte hain yaar, batao aapka naam kya hai?');
                    }, 1200);
                  } else {
                    setRebootFeedbackMessage('Server reset failed. Please retry.');
                  }
                } catch (err) {
                  setRebootFeedbackMessage('Network error. Reboot aborted.');
                  console.warn('Reboot api error:', err);
                }
              } else {
                setRebootFeedbackMessage('Incorrect reboot password. Authorization denied.');
                setTimeout(() => {
                  setRebootFeedbackMessage('');
                }, 3000);
              }
            }} className="flex flex-col gap-4">
              <input
                type="password"
                required
                value={rebootPasswordInput}
                onChange={(e) => setRebootPasswordInput(e.target.value)}
                placeholder="Reboot Password"
                className={`px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                  theme === 'dark'
                    ? 'bg-slate-950 border-slate-800 text-white focus:ring-red-500/20 focus:border-red-500/50'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-red-500/20 focus:border-red-500/50'
                }`}
              />
              
              {rebootFeedbackMessage && (
                <p className={`text-xs font-mono font-semibold ${rebootFeedbackMessage.includes('successful') || rebootFeedbackMessage.includes('Authorizing') ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {rebootFeedbackMessage}
                </p>
              )}
              
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRebootModalOpen(false);
                    setRebootPasswordInput('');
                    setRebootFeedbackMessage('');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-500/10 transition-all spring-button"
                >
                  Reboot System
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Developer Password Identification Challenge Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-motion-blur-in">
          <div className={`w-full max-w-md p-6 rounded-3xl border flex flex-col shadow-2xl relative ${
            theme === 'dark'
              ? 'bg-slate-900/90 border-cyan-500/30 text-white shadow-cyan-500/10'
              : 'bg-white border-blue-200 text-slate-900 shadow-blue-500/10'
          }`}>
            <h3 className="text-sm font-mono tracking-wider font-bold uppercase text-blue-500 mb-4">Security Verification</h3>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const trimmedInput = devPasswordInput.trim();
              if (trimmedInput === 'supercalifragilisticexpialidocious') {
                setAuthFeedbackMessage('');
                localStorage.setItem('iris_is_developer', 'true');
                localStorage.removeItem('iris_developer_failed');
                setIsDeveloperAuthenticated(true);
                setHasDeveloperAuthenticationFailed(false);
                setDevPasswordInput('');
                setIsPasswordModalOpen(false);
                
                // If LiveClient real-time session is active, notify the live session directly (stops previous speech and prevents double voices)
                if (clientRef.current && clientRef.current.getState() !== 'IDLE' && clientRef.current.getState() !== 'ERROR') {
                  clientRef.current.sendAuthUpdate(true);
                } else {
                  // Direct fast randomized greeting with zero latency
                  const randomGreeting = AFTER_DEV_IDENTIFICATION_MESSAGES[
                    Math.floor(Math.random() * AFTER_DEV_IDENTIFICATION_MESSAGES.length)
                  ];
                  setIrisText(randomGreeting);
                  try {
                    const ttsRes = await fetch('/api/tts', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: randomGreeting, voice: selectedVoice })
                    });
                    if (ttsRes.ok) {
                      const ttsData = await ttsRes.json();
                      if (ttsData.audio) {
                        const audio = new Audio(`data:audio/mp3;base64,${ttsData.audio}`);
                        audio.play();
                      }
                    }
                  } catch (err) {
                    console.warn('Developer welcome verbalization error:', err);
                  }
                }
              } else {
                setAuthFeedbackMessage('Incorrect password. Authorization denied.');
                localStorage.setItem('iris_developer_failed', 'true');
                localStorage.removeItem('iris_is_developer');
                setIsDeveloperAuthenticated(false);
                setHasDeveloperAuthenticationFailed(true);
                setDevPasswordInput('');
                
                setTimeout(() => {
                  setAuthFeedbackMessage('');
                }, 3000);
              }
            }} className="flex flex-col gap-4">
              <input
                type="password"
                required
                value={devPasswordInput}
                onChange={(e) => setDevPasswordInput(e.target.value)}
                placeholder="Password"
                className={`px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                  theme === 'dark'
                    ? 'bg-slate-950 border-slate-800 text-white focus:ring-cyan-500/20 focus:border-cyan-500/50'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20 focus:border-blue-500/50'
                }`}
              />
              
              {authFeedbackMessage && (
                <p className="text-xs font-mono font-semibold text-rose-500">
                  {authFeedbackMessage}
                </p>
              )}
              
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setDevPasswordInput('');
                    setAuthFeedbackMessage('');
                    if (hasDeveloperAuthenticationFailed) {
                      triggerDeveloperRejectionGreeting();
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/10 transition-all spring-button"
                >
                  Verify Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer (fades out on overscroll so its top border line never crosses the small Orb) */}
      <footer 
        style={{
          opacity: Math.max(0, 1 - overscrollProgress * 2.5),
          pointerEvents: overscrollProgress > 0.2 ? 'none' : 'auto',
          transition: 'opacity 0.2s ease-out',
          zIndex: 1,
        }}
        className="w-full max-w-4xl mx-auto px-4 py-3 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200/50 dark:border-slate-800/40 relative"
      >
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Safe Device Actions Bridge • WhatsApp, Phone, Apps, URLs</span>
        </div>
        <div>
          <span>I.R.I.S (Information Retrieval Intelligence System) • CREATOR - Dev</span>
        </div>
      </footer>
    </div>
  );
}
