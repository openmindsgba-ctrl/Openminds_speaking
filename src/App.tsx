import React, { useState, useRef, useCallback } from 'react';
import { 
  Image as ImageIcon, Sparkles, Download, RefreshCw, 
  Star, GraduationCap, Trophy, Mic, Languages, Clock, KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { generateContent, generateAudio, generateExercise } from './services/geminiService';
import { EnglishLevel, ContentMode, VocabularyItem, ExerciseData } from './types';

// Components
import { Header } from './components/Header';
import { BrandLogo } from './components/BrandLogo';
import { ApiKeyModal } from './components/ApiKeyModal';
import { InputPanel } from './components/InputPanel';
import { PosterPreview } from './components/PosterPreview';
import { ReadingTwo } from './components/ReadingTwo';
import { SpeechEvaluator } from './components/SpeechEvaluator';
import { CertificateModal } from './components/CertificateModal';
import { Footer } from './components/Footer';
import { LessonHistory } from './components/LessonHistory';
import { ExerciseSection } from './components/ExerciseSection';
import { ContentProtection } from './components/ContentProtection';

// Hooks
import { useFileProcessor } from './hooks/useFileProcessor';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useRecorder } from './hooks/useRecorder';
import { useLessonHistory, LessonRecord } from './hooks/useLessonHistory';

export default function App() {
  // Core state
  const [topic, setTopic] = useState('');
  const [grammarTopic, setGrammarTopic] = useState('');
  const [level, setLevel] = useState<EnglishLevel>("Starters");
  const [apiKey, setApiKey] = useState(localStorage.getItem("GEMINI_API_KEY") || "");
  
  const hasEnvKey = false;
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [contentMode, setContentMode] = useState<ContentMode>("generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generated content
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [readingText, setReadingText] = useState<string | null>(null);
  const [readingText2, setReadingText2] = useState<string | null>(null);
  const [translationText, setTranslationText] = useState<string | null>(null);
  const [translationText2, setTranslationText2] = useState<string | null>(null);
  const [overallGrammar, setOverallGrammar] = useState<string | null>(null);
  const [reading2Answers, setReading2Answers] = useState<string[] | undefined>(undefined);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [comprehensionQuestions, setComprehensionQuestions] = useState<{question: string, options: string[], correctAnswer: string, suggestedAnswer: string}[] | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [generatedTopicName, setGeneratedTopicName] = useState<string | null>(null);
  const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null);
  const [homeworkData, setHomeworkData] = useState<any>(null); // from types/index.ts
  const [exerciseScore, setExerciseScore] = useState<number | null>(null);

  // UI state
  const [isDownloading, setIsDownloading] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [teacherName, setTeacherName] = useState('Ms. Yến');
  const [showCertificate, setShowCertificate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const posterRef2 = useRef<HTMLDivElement>(null);

  // Custom hooks
  const fileProcessor = useFileProcessor(setTopic, setImagePreview, setContentMode, setError, contentMode);
  const audioPlayer = useAudioPlayer(readingText, level, setError);
  const audioPlayer2 = useAudioPlayer(readingText2, level, setError);
  const recorder = useRecorder(readingText, level, setError);
  const lessonHistory = useLessonHistory();

  // API Key check on mount
  React.useEffect(() => {
    if (!apiKey && !hasEnvKey) {
      setShowApiKeyModal(true);
    }
  }, [apiKey, hasEnvKey]);

  // Save score to history when evaluation completes
  React.useEffect(() => {
    if (recorder.evaluation && recorder.evaluation.isComplete && currentLessonId && recorder.evaluation.score > 0) {
      lessonHistory.updateScore(currentLessonId, recorder.evaluation.score);
    }
  }, [recorder.evaluation]);

  const handleUpdateApiKey = useCallback((newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem("GEMINI_API_KEY", newKey);
    setShowApiKeyModal(false);
    setError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!topic && !imagePreview) {
      setError("Please enter a topic or upload an image.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setReadingText(null);
    setReadingText2(null);

    try {
      // 1. Generate content
      const result = await generateContent(
        topic || (contentMode === "useInput" ? "Extract text from image" : "A scene based on the provided image"), 
        level, grammarTopic, contentMode, imagePreview || undefined
      );
      
      setGeneratedPrompt(result.prompt);
      setReadingText(result.readingText);
      setReadingText2(result.readingText2 || null);
      setTranslationText(result.translation);
      setTranslationText2(result.translation2 || null);
      setVocabulary(result.vocabulary);
      setOverallGrammar(result.overallGrammar || null);
      setReading2Answers(result.reading2Answers || undefined);
      setGeneratedTopicName(result.topicName);
      setHomeworkData(result.homework || null);
      setComprehensionQuestions(result.comprehensionQuestions || null);
      
      setShowTranslation(false);
      audioPlayer.setAudioUrl(null);
      audioPlayer2.setAudioUrl(null);
      recorder.setEvaluation(null);

      // 2. Generate exercises (with a short delay to avoid quota limits on free-tier keys)
      await new Promise(r => setTimeout(r, 2000));
      const exData = result.readingText ? await generateExercise(result.readingText, level).catch(err => {
        console.error("Exercise generation failed", err);
        return null;
      }) : null;
      
      setExerciseData(exData);
      setExerciseScore(null);

      // 3. Then generate audio (or fallback to TTS)
      audioPlayer.setIsAudioLoading(true);
      audioPlayer2.setIsAudioLoading(true);
      
      const audioUrl = result.readingText ? await generateAudio(result.readingText, level).catch(err => {
        console.error("Background audio generation failed", err);
        const msg = err?.message || "";
        if (msg === "QUOTA_EXCEEDED" || msg === "INVALID_KEY") throw err;
        return null;
      }) : null;
      
      const audioUrl2Result = result.readingText2 ? await generateAudio(result.readingText2, level).catch(err => {
        console.error("Background audio generation 2 failed", err);
        return null;
      }) : null;
      
      if (audioUrl) audioPlayer.setAudioUrl(audioUrl);
      if (audioUrl2Result) audioPlayer2.setAudioUrl(audioUrl2Result);
      
      audioPlayer.setIsAudioLoading(false);
      audioPlayer2.setIsAudioLoading(false);

      // 3. Save to lesson history
      const lessonId = lessonHistory.addLesson({
        topicName: result.topicName,
        level,
        readingText: result.readingText,
        readingText2: result.readingText2 || undefined,
        translationText: result.translation,
        translationText2: result.translation2 || undefined,
        vocabulary: result.vocabulary,
        overallGrammar: result.overallGrammar,
        reading2Answers: result.reading2Answers,
        generatedImage: null,
        generatedPrompt: result.prompt,
        exerciseData: exData,
        comprehensionQuestions: result.comprehensionQuestions,
      });
      setCurrentLessonId(lessonId);

    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || String(err);
      if (errorMessage === "QUOTA_EXCEEDED") {
        setError("You have exceeded the usage quota for this API Key. Please click on 'API Key Settings' to change the key or try again later.");
      } else if (errorMessage === "INVALID_KEY") {
        setError("Invalid or disabled API Key. Please check in 'API Key Settings'.");
      } else if (errorMessage.includes("safety") || errorMessage.includes("Safety")) {
        setError("Content or image blocked by safety filter. Please try another topic.");
      } else if (errorMessage.includes("parsing") || errorMessage.includes("parse")) {
        setError("Error processing data from AI. Please try again.");
      } else {
        let treatedAsQuota = false;
        try {
          const parsedError = JSON.parse(errorMessage);
          if (parsedError?.error?.code === 429 || parsedError?.status === 429) {
            setError("You have exceeded the usage quota. Please click on 'API Key Settings' to change the key.");
            treatedAsQuota = true;
          }
        } catch (e) { 
          if (errorMessage.includes('"code":429') || errorMessage.includes('"code": 429')) {
            setError("You have exceeded the usage quota. Please click on 'API Key Settings' to change the key.");
            treatedAsQuota = true;
          }
        }
        if (!treatedAsQuota) {
          setError(`Error: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}. (Please try again or check your network connection)`);
        }
      }
      audioPlayer.setIsAudioLoading(false);
    } finally {
      setIsGenerating(false);
    }
  }, [topic, imagePreview, contentMode, level, audioPlayer, recorder, lessonHistory]);

  // Pre-load voices on iOS to prevent the Vietnamese voice fallback bug
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    handleGenerate();
  }, [handleGenerate]);

  const handleLoadLesson = useCallback((lesson: LessonRecord) => {
    setReadingText(lesson.readingText);
    setReadingText2(lesson.readingText2 || null);
    setTranslationText(lesson.translationText);
    setTranslationText2(lesson.translationText2 || null);
    setVocabulary(lesson.vocabulary || []);
    setOverallGrammar(lesson.overallGrammar || null);
    setReading2Answers(lesson.reading2Answers || undefined);
    setGeneratedTopicName(lesson.topicName);
    setGeneratedPrompt(lesson.generatedPrompt);
    setExerciseData(lesson.exerciseData || null);
    setHomeworkData((lesson as any).homeworkData || null);
    setExerciseScore(lesson.exerciseScore ?? null);
    setComprehensionQuestions(lesson.comprehensionQuestions || null);
    setLevel(lesson.level);
    setShowTranslation(false);
    setCurrentLessonId(lesson.id);
    audioPlayer.setAudioUrl(null);
    audioPlayer2.setAudioUrl(null);
    recorder.setEvaluation(null);
    setError(null);
  }, [audioPlayer, audioPlayer2, recorder]);

  const handleExerciseComplete = useCallback((score: number) => {
    setExerciseScore(score);
    if (currentLessonId) {
      lessonHistory.updateExerciseScore(currentLessonId, score);
    }
  }, [currentLessonId, lessonHistory]);

  const downloadPoster = useCallback(async () => {
    if (!posterRef.current || isDownloading) return;
    setIsDownloading(true);
    
    const images = posterRef.current.querySelectorAll('img');
    const originalSrcs = new Map<HTMLImageElement, string>();

    try {
      // 1. Convert all images to base64 to prevent canvas tainting on Vercel
      const loadPromises = Array.from(images).map(async (img) => {
        const image = img as HTMLImageElement;
        const originalSrc = image.src;
        
        if (!originalSrc.startsWith('data:')) {
          originalSrcs.set(image, originalSrc);
          try {
            // Attempt to fetch the image and convert to base64
            // We use a proxy as a fallback if the direct fetch fails due to CORS
            let blob: Blob;
            try {
              const res = await fetch(originalSrc);
              if (!res.ok) throw new Error("Direct fetch failed");
              blob = await res.blob();
            } catch (e) {
              const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalSrc)}`;
              const res = await fetch(proxyUrl);
              blob = await res.blob();
            }

            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            image.src = base64;
          } catch (e) {
            console.warn("Failed to convert image to base64", e);
            // Ignore error, html2canvas will just try to use the original src
          }
        }

        if (image.complete) return Promise.resolve();
        return new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      });

      await Promise.all(loadPromises);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Generate the canvas
      const canvas = await html2canvas(posterRef.current, {
        useCORS: true, 
        allowTaint: false, // Critical: prevent taint to avoid SecurityError on toDataURL
        scale: 2,
        backgroundColor: '#ffffff', logging: true, imageTimeout: 15000, removeContainer: true,
        onclone: (clonedDoc) => {
          const container = clonedDoc.querySelector('[data-poster-container]') as HTMLElement;
          if (container) { container.style.backgroundImage = 'none'; container.style.boxShadow = 'none'; container.style.transform = 'none'; container.style.transition = 'none'; }
          const blurredElements = clonedDoc.querySelectorAll('.backdrop-blur-sm, .backdrop-blur-md, .backdrop-blur-lg');
          blurredElements.forEach((el: any) => { el.style.backdropFilter = 'none'; el.style.background = 'rgba(255, 255, 255, 0.9)'; });
          const style = clonedDoc.createElement('style');
          style.innerHTML = `* { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; print-color-adjust: exact !important; box-shadow: none !important; text-shadow: none !important; }`;
          clonedDoc.head.appendChild(style);
        },
        ignoreElements: (element) => element.hasAttribute('data-html2canvas-ignore'),
      });

      // 3. Download
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.style.display = 'none'; link.href = dataUrl;
      link.download = `Open Minds-English-Poster-${Date.now()}.png`;
      document.body.appendChild(link); link.click();
      setTimeout(() => { if (link.parentNode) document.body.removeChild(link); }, 500);
    } catch (err: any) {
      console.error("Critical: Failed to download poster", err);
      const msg = err?.message || "";
      if (msg.includes("tainted") || msg.includes("CORS") || msg.includes("insecure") || msg.includes("toDataURL")) {
        setError("Image copyright error (CORS). Please try again or take a screenshot of the results.");
      } else {
        setError("Cannot download the poster automatically. Please take a screenshot or try again.");
      }
    } finally {
      // 4. Restore original image sources
      originalSrcs.forEach((src, img) => {
        img.src = src;
      });
      setIsDownloading(false);
    }
  }, [isDownloading]);



  return (
    <div className="min-h-screen bg-brand-blue-dark text-white font-sans selection:bg-brand-gold/20 relative overflow-hidden">
      <ContentProtection />
      
      {/* Decorative Background Icons */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
        <KeyRound className="absolute top-10 left-10 w-24 h-24 text-blue-300 opacity-10 -rotate-45" />
        <KeyRound className="absolute top-1/4 right-20 w-32 h-32 text-indigo-400 opacity-10 rotate-12" />
        <KeyRound className="absolute bottom-20 left-1/4 w-40 h-40 text-blue-400 opacity-10 -rotate-12" />
        <KeyRound className="absolute bottom-1/3 right-10 w-28 h-28 text-indigo-300 opacity-10 rotate-45" />
        <KeyRound className="absolute top-1/2 left-10 w-24 h-24 text-blue-400 opacity-10 -rotate-90" />
        <KeyRound className="absolute top-20 right-1/3 w-36 h-36 text-indigo-400 opacity-10 rotate-180" />
        <KeyRound className="absolute bottom-10 right-1/4 w-20 h-20 text-blue-300 opacity-10 rotate-90" />
      </div>

      {/* Header */}
      <Header apiKey={apiKey} onOpenApiKeyModal={() => setShowApiKeyModal(true)} />

      {/* API Key Modal */}
      <ApiKeyModal 
        show={showApiKeyModal} 
        currentApiKey={apiKey} 
        onSave={handleUpdateApiKey} 
        onClose={() => { if (apiKey || hasEnvKey) setShowApiKeyModal(false); }} 
        hasEnvKey={hasEnvKey}
      />

      {/* Lesson History Sidebar */}
      <LessonHistory
        lessons={lessonHistory.lessons}
        show={showHistory}
        onClose={() => setShowHistory(false)}
        onLoadLesson={handleLoadLesson}
        onRemoveLesson={lessonHistory.removeLesson}
        onClearAll={lessonHistory.clearAll}
      />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        {/* Hero / Mode Selector */}
        <div className="mb-8 sm:mb-12 flex flex-col items-center justify-center text-center space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
            <div className="bg-white rounded-[2rem] border-[6px] border-brand-gold shadow-xl mb-6 overflow-hidden max-w-3xl w-full">
              <img 
                src="https://i.postimg.cc/XvxRpN61/1785032880200-7192141980250174577-7192141980250174577-83a344d5e87f6ed90f57f99b10c6f832.jpg" 
                alt="Open Minds English Centre Logo" 
                className="w-full h-auto object-cover" 
              />
            </div>
          </motion.div>
          
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 bg-slate-100/50 p-2 rounded-2xl border border-slate-200">
            {([
              { mode: "generate" as ContentMode, icon: "💡", label: "Topic" },
              { mode: "image" as ContentMode, icon: "🖼️", label: "Image" },
              { mode: "useInput" as ContentMode, icon: "📝", label: "Text" },
            ]).map(({ mode, icon, label }) => (
              <button key={mode} onClick={() => setContentMode(mode)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-all text-sm sm:text-base
                  ${contentMode === mode ? 'bg-gradient-to-r from-blue-600 to-brand-blue text-white shadow-lg' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                {icon} {label}
              </button>
            ))}

            {/* History Button */}
            <button onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-all text-sm sm:text-base text-slate-600 hover:bg-slate-200 relative"
            >
              <Clock size={16} /> History
              {lessonHistory.lessons.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-blue text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                  {lessonHistory.lessons.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 text-[#1A1A1A]">
          <InputPanel
            topic={topic} setTopic={setTopic}
            grammarTopic={grammarTopic} setGrammarTopic={setGrammarTopic}
            level={level} setLevel={setLevel}
            contentMode={contentMode} setContentMode={setContentMode}
            imagePreview={imagePreview} setImagePreview={setImagePreview}
            isGenerating={isGenerating}
            isProcessingFile={fileProcessor.isProcessingFile}
            isDragging={fileProcessor.isDragging}
            error={error}
            onGenerate={handleGenerate}
            onRetry={handleRetry}
            onOpenApiKeyModal={() => setShowApiKeyModal(true)}
            imageInputRef={fileProcessor.imageInputRef}
            docFileInputRef={fileProcessor.docFileInputRef}
            handleImageUpload={fileProcessor.handleImageUpload}
            handleDragOver={fileProcessor.handleDragOver}
            handleDragLeave={fileProcessor.handleDragLeave}
            handleDrop={fileProcessor.handleDrop}
            handlePaste={fileProcessor.handlePaste}
            processFile={fileProcessor.processFile}
          />

          {/* Preview Panel */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border-4 border-blue-100 overflow-hidden min-h-[400px] sm:min-h-[600px] flex flex-col relative">
              {/* Preview Header */}
              <div className="p-3 sm:p-5 border-b-4 border-red-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50/30">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Super engaging learning content</span>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-blue rounded-full flex items-center justify-center text-white shadow-sm"><ImageIcon size={16} /></div>
                    <span className="text-xs sm:text-sm font-black text-brand-blue-dark uppercase tracking-widest">Student's Learning Corner</span>
                    {readingText && <span className="px-3 py-1 bg-red-200 text-blue-900 text-[10px] font-black rounded-full shadow-sm uppercase">{level}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {readingText && (
                    <button onClick={() => setShowTranslation(!showTranslation)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm
                        ${showTranslation ? 'bg-brand-blue text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                      <Languages size={14} /> {showTranslation ? 'Hide translation' : 'Show translation'}
                    </button>
                  )}
                  {readingText && (
                    <button onClick={downloadPoster} disabled={isDownloading}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-lg
                        ${isDownloading ? 'bg-blue-400 cursor-not-allowed' : 'bg-brand-blue hover:bg-blue-800 shadow-blue-100'}`}
                    >
                      {isDownloading ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
                      {isDownloading ? 'Processing...' : 'Download Poster'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Content Area */}
              <div className="flex-1 flex items-center justify-center p-2 sm:p-6 bg-[#FAFAFA] overflow-auto">
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
                      </div>
                      <p className="text-gray-500 font-medium animate-pulse text-center px-4">Gemini is preparing the lesson for you...</p>
                    </motion.div>
                  ) : readingText ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex flex-col items-center gap-4">
                      {/* Poster */}
                      <PosterPreview
                        apiKey={apiKey}
                        readingText={readingText}
                        translationText={translationText} vocabulary={vocabulary}
                        generatedTopicName={generatedTopicName} topic={topic} level={level}
                        showTranslation={showTranslation}
                        grammarSummary={overallGrammar}
                        comprehensionQuestions={comprehensionQuestions}
                        audioUrl={audioPlayer.audioUrl} audioRef={audioPlayer.audioRef}
                        isPlaying={audioPlayer.isPlaying} isAudioLoading={audioPlayer.isAudioLoading}
                        isBrowserTTS={audioPlayer.isBrowserTTS}
                        setIsPlaying={audioPlayer.setIsPlaying} handlePlayAudio={audioPlayer.handlePlayAudio}
                        isDownloading={isDownloading}
                        onDownloadPoster={downloadPoster}
                        onToggleTranslation={() => setShowTranslation(!showTranslation)}
                        posterRef={posterRef}
                      />




                      {/* Reading 2 Poster (Fill in the blanks) */}
                      {readingText2 && (
                        <div className="w-full max-w-4xl mx-auto mt-8">
                          <ReadingTwo
                            readingText={readingText2}
                            translationText={translationText2}
                            vocabulary={vocabulary}
                            answers={reading2Answers}
                            homeworkData={homeworkData}
                            topicName={generatedTopicName}
                            level={level}
                            showTranslation={showTranslation}
                            audioUrl={audioPlayer2.audioUrl}
                            audioRef={audioPlayer2.audioRef}
                            isPlaying={audioPlayer2.isPlaying}
                            isAudioLoading={audioPlayer2.isAudioLoading}
                            setIsPlaying={audioPlayer2.setIsPlaying}
                            handlePlayAudio={audioPlayer2.handlePlayAudio}
                            onToggleTranslation={() => setShowTranslation(!showTranslation)}
                          />
                        </div>
                      )}

                      {/* Exercise Section */}
                      {!exerciseData ? (
                        <div className="w-full max-w-[800px] p-6 bg-amber-50/75 rounded-2xl border-2 border-dashed border-amber-200 flex flex-col items-center justify-center text-center space-y-3 mt-8">
                          <span className="text-2xl">📝</span>
                          <div>
                            <h4 className="font-bold text-amber-900 text-sm sm:text-base">Lesson has no exercises yet</h4>
                            <p className="text-xs text-amber-700/80 mt-1 max-w-md">Due to network connection or system overload from Google. Please click the button below to generate exercises now!</p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!readingText) return;
                              setIsGenerating(true);
                              setError(null);
                              try {
                                const exData = await generateExercise(readingText, level);
                                setExerciseData(exData);
                                // Save to lesson history
                                if (currentLessonId) {
                                  lessonHistory.updateExerciseData(currentLessonId, exData);
                                }
                              } catch (err: any) {
                                console.error(err);
                                setError("Cannot generate exercises at this time. Please check your API key and try again later.");
                              } finally {
                                setIsGenerating(false);
                              }
                            }}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all"
                          >
                            <RefreshCw className={isGenerating ? "animate-spin" : ""} size={14} />
                            Generate Exercises
                          </button>
                        </div>
                      ) : (
                        <div className="mt-8">
                          <ExerciseSection 
                            exerciseData={exerciseData} 
                            savedScore={exerciseScore} 
                            onComplete={handleExerciseComplete} 
                          />
                        </div>
                      )}

                      {/* Certificate Modal */}
                      <CertificateModal
                        show={showCertificate} onClose={() => setShowCertificate(false)}
                        evaluation={recorder.evaluation}
                        studentName={studentName} teacherName={teacherName}
                        generatedTopicName={generatedTopicName} topic={topic} level={level}
                        isDownloading={isDownloading} setIsDownloading={setIsDownloading} setError={setError}
                        exerciseScore={exerciseScore}
                      />

                      {/* AI Prompt Debug */}
                      {generatedPrompt && (
                        <div className="w-full max-w-[600px] p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                          <p className="text-[10px] uppercase font-bold text-blue-400 mb-1 tracking-widest">AI Prompt</p>
                          <p className="text-xs text-blue-900/70 italic leading-relaxed">{generatedPrompt}</p>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 max-w-xs">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-300"><ImageIcon size={40} /></div>
                      <div className="space-y-2">
                        <h3 className="font-bold text-gray-700">No Posters yet</h3>
                        <p className="text-sm text-gray-400">Select a level, enter a topic, and click the button to get started!</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

