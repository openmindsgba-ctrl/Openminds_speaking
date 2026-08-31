import { useState, useRef, useCallback, useEffect } from 'react';
import { evaluateSpeech } from '../services/geminiService';
import { EnglishLevel, EvaluationResult } from '../types';

interface UseRecorderReturn {
  isRecording: boolean;
  isEvaluating: boolean;
  evaluation: EvaluationResult | null;
  setEvaluation: (evaluation: EvaluationResult | null) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useRecorder(
  readingText: string | null,
  level: EnglishLevel,
  setError: (error: string | null) => void
): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Use refs to avoid stale closures in callbacks
  const isRecordingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const readingTextRef = useRef(readingText);
  const levelRef = useRef(level);
  const recordingStartTimeRef = useRef<number>(0);

  // Keep refs in sync with props/state
  readingTextRef.current = readingText;
  levelRef.current = level;

  // Grace period (ms) after recording starts â€” anti-cheat is disabled during this window
  // to allow browser permission popups to appear without triggering false positives
  const ANTI_CHEAT_GRACE_MS = 2000;

  // Helper to safely stop the stream tracks
  const stopStreamTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleEvaluate = useCallback(async (audioBlob: Blob, mimeType: string) => {
    const currentText = readingTextRef.current;
    const currentLevel = levelRef.current;

    if (!currentText) {
      console.error("handleEvaluate: readingText is null, cannot evaluate");
      setIsEvaluating(false);
      setError("KhĂ´ng cĂ³ ná»™i dung bĂ i Ä‘á»c Ä‘á»ƒ cháº¥m Ä‘iá»ƒm. Vui lĂ²ng táº¡o bĂ i Ä‘á»c trÆ°á»›c.");
      return;
    }

    setIsEvaluating(true);
    try {
      // â”€â”€ Step 1: Convert raw recorded audio to base64 â”€â”€
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            if (!base64 || base64.length < 100) {
              reject(new Error("Audio data is empty or too small. Please try recording again."));
              return;
            }
            console.log(`[Recorder] Raw Base64 ready: ${base64.length} chars, mimeType=${mimeType}`);
            resolve(base64);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read audio file"));
        reader.readAsDataURL(audioBlob);
      });

      // â”€â”€ Step 2: Send raw base64 to Gemini for evaluation â”€â”€
      // Gemini natively accepts audio/webm, audio/mp4, audio/ogg, audio/wav, audio/mp3
      const result = await evaluateSpeech(currentText, base64Audio, currentLevel, mimeType);
      setEvaluation(result);
      setIsEvaluating(false);
    } catch (err: any) {
      console.error("Evaluation error:", err);
      const errorMessage = err?.message || String(err);
      
      if (errorMessage === "QUOTA_EXCEEDED") {
        setError("Báº¡n Ä‘Ă£ háº¿t háº¡n má»©c sá»­ dá»¥ng (Quota) cá»§a API Key nĂ y. Vui lĂ²ng nháº¥n vĂ o nĂºt 'CĂ i Ä‘áº·t API Key' Ä‘á»ƒ Ä‘á»•i key má»›i hoáº·c thá»­ láº¡i sau.");
      } else if (errorMessage === "INVALID_KEY") {
        setError("API Key khĂ´ng há»£p lá»‡. Vui lĂ²ng kiá»ƒm tra láº¡i cáº¥u hĂ¬nh trong 'CĂ i Ä‘áº·t API Key'.");
      } else {
        let treatedAsQuota = false;
        try {
          const parsedError = JSON.parse(errorMessage);
          if (parsedError?.error?.code === 429 || parsedError?.status === 429) {
            setError("Báº¡n Ä‘Ă£ háº¿t háº¡n má»©c sá»­ dá»¥ng (Quota) cá»§a API Key nĂ y. Vui lĂ²ng nháº¥n vĂ o nĂºt 'CĂ i Ä‘áº·t API Key' Ä‘á»ƒ Ä‘á»•i key má»›i.");
            treatedAsQuota = true;
          }
        } catch (e) { 
          if (errorMessage.includes('"code":429') || errorMessage.includes('"code": 429')) {
            setError("Báº¡n Ä‘Ă£ háº¿t háº¡n má»©c sá»­ dá»¥ng (Quota) cá»§a API Key nĂ y. Vui lĂ²ng nháº¥n vĂ o nĂºt 'CĂ i Ä‘áº·t API Key' Ä‘á»ƒ Ä‘á»•i key má»›i.");
            treatedAsQuota = true;
          }
        }

        if (!treatedAsQuota) {
          setError(`Lá»—i cháº¥m Ä‘iá»ƒm: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}. (Vui lĂ²ng thá»­ láº¡i)`);
        }
      }
      setIsEvaluating(false);
    }
  }, [setError]);

  const startRecording = useCallback(async () => {
    // Prevent starting a new recording while one is stopping
    if (isStoppingRef.current) {
      console.warn("[Recorder] Cannot start: a recording is currently stopping.");
      return;
    }

    try {
      // Request audio with noise reduction for better speech recognition
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 1 },
        } 
      });
      streamRef.current = stream;

      // Choose the best MIME type supported by this browser
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ];
      const supportedType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
      console.log('[Recorder] MediaRecorder MIME type:', supportedType || 'browser default');

      const recorderOptions: MediaRecorderOptions = {};
      if (supportedType) {
        recorderOptions.mimeType = supportedType;
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          
          console.log(`[Recorder] Recording stopped: ${audioBlob.size} bytes, ${mimeType}, ${audioChunksRef.current.length} chunks`);

          if (audioBlob.size < 100) {
            console.error("[Recorder] Audio blob is too small:", audioBlob.size);
            setError("KhĂ´ng thu Ä‘Æ°á»£c Ă¢m thanh. Vui lĂ²ng kiá»ƒm tra micro vĂ  thá»­ láº¡i.");
            setIsEvaluating(false);
            return;
          }

          await handleEvaluate(audioBlob, mimeType);
        } catch (err: any) {
          console.error("[Recorder] Error in onstop handler:", err);
          setError("CĂ³ lá»—i xáº£y ra khi xá»­ lĂ½ audio. Vui lĂ²ng thá»­ láº¡i.");
          setIsEvaluating(false);
        } finally {
          stopStreamTracks();
          isStoppingRef.current = false;
        }
      };

      // Start recording. Do NOT pass a timeslice (e.g. 1000) so the browser buffers
      // and outputs a single, well-formed container file upon stop. This is far more robust
      // across different browsers and avoids chunk index/header corruption issues.
      mediaRecorder.start();
      isRecordingRef.current = true;
      isStoppingRef.current = false;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setEvaluation(null);
      setError(null);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      stopStreamTracks();
      const isPermissionError = 
        err.name === 'NotAllowedError' || 
        err.name === 'PermissionDeniedError' || 
        (err.message && err.message.toLowerCase().includes('permission denied'));

      if (isPermissionError) {
        setError("KhĂ´ng thá»ƒ truy cáº­p micro. Báº¡n vui lĂ²ng: \n1. Nháº¥n 'Cho phĂ©p' khi trĂ¬nh duyá»‡t yĂªu cáº§u.\n2. Kiá»ƒm tra cĂ i Ä‘áº·t quyá»n truy cáº­p micro cá»§a trĂ¬nh duyá»‡t.\n3. Nháº¥n nĂºt 'Má»Ÿ trong tab má»›i' (gĂ³c trĂªn bĂªn pháº£i) Ä‘á»ƒ á»©ng dá»¥ng hoáº¡t Ä‘á»™ng tá»‘t nháº¥t.");
      } else {
        setError(`Lá»—i micro: ${err.message || "Vui lĂ²ng kiá»ƒm tra láº¡i thiáº¿t bá»‹ cá»§a báº¡n."}`);
      }
    }
  }, [handleEvaluate, setError, stopStreamTracks]);

  const stopRecording = useCallback(() => {
    // Guard: prevent double-tap / race condition
    if (!isRecordingRef.current || isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;

    // Set evaluating immediately so UI transitions smoothly
    setIsEvaluating(true);
    isRecordingRef.current = false;
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      if (recorder.state === 'recording') {
        recorder.stop();
      } else if (recorder.state === 'paused') {
        recorder.resume();
        recorder.stop();
      } else {
        console.warn("[Recorder] MediaRecorder already inactive, state:", recorder.state);
        setIsEvaluating(false);
        isStoppingRef.current = false;
        stopStreamTracks();
      }
    } else {
      setIsEvaluating(false);
      isStoppingRef.current = false;
      stopStreamTracks();
    }
  }, [stopStreamTracks]);

  // --- ANTI-CHEAT: Stop recording if tab is switched (with grace period) ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden || !isRecordingRef.current) return;

      // Grace period: don't trigger anti-cheat within the first few seconds
      // This prevents false positives from browser permission popups,
      // notification banners, etc. that cause the page to lose visibility briefly.
      const elapsed = Date.now() - recordingStartTimeRef.current;
      if (elapsed < ANTI_CHEAT_GRACE_MS) {
        console.log(`[Recorder] Anti-cheat grace period active (${elapsed}ms < ${ANTI_CHEAT_GRACE_MS}ms), ignoring visibility change.`);
        return;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      stopStreamTracks();
      isRecordingRef.current = false;
      isStoppingRef.current = false;
      setIsRecording(false);
      setIsEvaluating(false);
      setError("Lá»—i vi pháº¡m (Anti-Cheat): Báº¡n khĂ´ng Ä‘Æ°á»£c phĂ©p chuyá»ƒn tab hoáº·c áº©n á»©ng dá»¥ng trong khi Ä‘ang ghi Ă¢m pháº§n thi Speaking. YĂªu cáº§u lĂ m láº¡i tá»« Ä‘áº§u.");
    };

    // NOTE: We intentionally do NOT listen to 'window.blur' anymore.
    // The blur event fires when:
    //   - Browser shows the microphone permission popup
    //   - User clicks on the address bar or DevTools
    //   - System notifications appear
    // All of these are legitimate actions, not cheating.
    // We only care about actual tab switches (visibilitychange â†’ document.hidden).

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setError, stopStreamTracks]);

  // --- CLEANUP: Stop recording and release microphone on unmount ---
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      isRecordingRef.current = false;
      isStoppingRef.current = false;
    };
  }, []);

  return {
    isRecording,
    isEvaluating,
    evaluation,
    setEvaluation,
    startRecording,
    stopRecording,
  };
}

