import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileText, Volume2, Pause, RefreshCw, Target, Play, BookOpen, Lightbulb, Zap, Mic, MicOff, CheckCircle, Languages } from 'lucide-react';
import { VocabularyItem, EnglishLevel } from '../types';
import { ReadingComprehension, ComprehensionQuestion } from './ReadingComprehension';

interface PosterPreviewProps {
  apiKey?: string;
  readingText: string | null;
  translationText: string | null;
  vocabulary: VocabularyItem[];
  generatedTopicName: string | null;
  topic: string;
  level: EnglishLevel;
  showTranslation: boolean;
  audioUrl: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  isAudioLoading: boolean;
  isBrowserTTS: boolean;
  setIsPlaying: (playing: boolean) => void;
  handlePlayAudio: () => Promise<void>;
  isDownloading: boolean;
  onDownloadPoster: () => void;
  onToggleTranslation: () => void;
  posterRef: React.RefObject<HTMLDivElement | null>;
  grammarSummary?: string | null;
  comprehensionQuestions?: ComprehensionQuestion[] | null;
}

// ====== CEFR SPEAKING EVALUATION SECTION ======
interface CEFRCriteria {
  name: string;
  nameEn: string;
  score: number; // 0-10
  feedback: string;
  icon: string;
}

interface CEFRResult {
  criteria: CEFRCriteria[];
  overallScore: number;
  cefrLevel: string;
  overallComment: string;
  missedWords: string[];
  extraWords: string[];
}

const getCEFRLevel = (score: number): string => {
  if (score >= 9.5) return 'C2';
  if (score >= 8.5) return 'C1';
  if (score >= 7) return 'B2';
  if (score >= 5.5) return 'B1';
  if (score >= 4) return 'A2';
  if (score >= 2) return 'A1';
  return 'Pre-A1';
};

const getCEFRColor = (level: string): string => {
  switch (level) {
    case 'C2': return 'from-yellow-400 to-amber-500';
    case 'C1': return 'from-purple-500 to-indigo-600';
    case 'B2': return 'from-blue-500 to-cyan-500';
    case 'B1': return 'from-emerald-500 to-teal-500';
    case 'A2': return 'from-orange-400 to-red-400';
    case 'A1': return 'from-rose-400 to-pink-500';
    default: return 'from-slate-400 to-slate-500';
  }
};

const getCEFRDescription = (level: string): string => {
  switch (level) {
    case 'C2': return 'Thành thạo - Mastery';
    case 'C1': return 'Nâng cao - Advanced';
    case 'B2': return 'Trung cấp cao - Upper Intermediate';
    case 'B1': return 'Trung cấp - Intermediate';
    case 'A2': return 'Sơ cấp - Elementary';
    case 'A1': return 'Nhập môn - Beginner';
    default: return 'Chuẩn bị - Pre-beginner';
  }
};

const evaluateCEFR = (spokenText: string, originalText: string): CEFRResult => {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s']/gi, '').split(/\s+/).filter(Boolean);
  const spokenWords = normalize(spokenText);
  const originalWords = normalize(originalText);

  if (originalWords.length === 0 || spokenWords.length === 0) {
    return {
      criteria: [
        { name: 'Phát âm', nameEn: 'Pronunciation', score: 0, feedback: 'Chưa có dữ liệu để đánh giá.', icon: '🗣️' },
        { name: 'Sự lưu loát', nameEn: 'Fluency', score: 0, feedback: 'Chưa có dữ liệu để đánh giá.', icon: '💨' },
        { name: 'Độ chính xác', nameEn: 'Accuracy', score: 0, feedback: 'Chưa có dữ liệu để đánh giá.', icon: '🎯' },
        { name: 'Vốn từ vựng', nameEn: 'Range & Vocabulary', score: 0, feedback: 'Chưa có dữ liệu để đánh giá.', icon: '📚' },
      ],
      overallScore: 0,
      cefrLevel: 'Pre-A1',
      overallComment: 'Em chưa đọc từ nào, hãy nhấn thu âm và đọc to rõ ràng nhé!',
      missedWords: [],
      extraWords: [],
    };
  }

  // --- Word-level analysis ---
  const spokenFreq: Record<string, number> = {};
  spokenWords.forEach(w => spokenFreq[w] = (spokenFreq[w] || 0) + 1);
  const originalFreq: Record<string, number> = {};
  originalWords.forEach(w => originalFreq[w] = (originalFreq[w] || 0) + 1);

  let matchCount = 0;
  const tempFreq = { ...spokenFreq };
  originalWords.forEach(w => {
    if (tempFreq[w] > 0) {
      matchCount++;
      tempFreq[w]--;
    }
  });

  // Words in original but not spoken
  const missedWords: string[] = [];
  const origFreqCopy = { ...originalFreq };
  const spokenFreqCopy = { ...spokenFreq };
  for (const w of Object.keys(origFreqCopy)) {
    const diff = origFreqCopy[w] - (spokenFreqCopy[w] || 0);
    if (diff > 0) missedWords.push(w);
  }

  // Words spoken but not in original
  const extraWords: string[] = [];
  const origFreqCopy2 = { ...originalFreq };
  const spokenFreqCopy2 = { ...spokenFreq };
  for (const w of Object.keys(spokenFreqCopy2)) {
    const diff = spokenFreqCopy2[w] - (origFreqCopy2[w] || 0);
    if (diff > 0) extraWords.push(w);
  }

  // --- Accuracy: how many original words were correctly said ---
  const accuracyRatio = matchCount / originalWords.length;
  const accuracyScore = Math.min(10, Math.max(0, Math.round(accuracyRatio * 10 * 10) / 10));

  // --- Pronunciation: penalize for extra/wrong words (indicates mispronunciation) ---
  const wrongWordRatio = extraWords.length / Math.max(spokenWords.length, 1);
  const pronScore = Math.min(10, Math.max(0, Math.round((1 - wrongWordRatio * 0.8) * accuracyRatio * 10 * 10) / 10));

  // --- Fluency: based on coverage and length ratio ---
  const lengthRatio = spokenWords.length / originalWords.length;
  let fluencyBase = accuracyRatio;
  if (lengthRatio < 0.3) fluencyBase *= 0.4;
  else if (lengthRatio < 0.5) fluencyBase *= 0.6;
  else if (lengthRatio < 0.7) fluencyBase *= 0.8;
  else if (lengthRatio > 1.5) fluencyBase *= 0.85;
  const fluencyScore = Math.min(10, Math.max(0, Math.round(fluencyBase * 10 * 10) / 10));

  // --- Range: unique vocabulary used vs original unique vocabulary ---
  const spokenUnique = new Set(spokenWords);
  const originalUnique = new Set(originalWords);
  let matchedUnique = 0;
  originalUnique.forEach(w => { if (spokenUnique.has(w)) matchedUnique++; });
  const rangeRatio = matchedUnique / originalUnique.size;
  const rangeScore = Math.min(10, Math.max(0, Math.round(rangeRatio * 10 * 10) / 10));

  // --- Feedback per criterion ---
  const pronFeedback = pronScore >= 9 ? 'Phát âm rất chuẩn xác, gần như hoàn hảo! Giọng đọc tự nhiên và rõ ràng.' :
    pronScore >= 7 ? 'Phát âm khá tốt, đa số các từ được nhận diện chính xác. Một vài từ cần luyện thêm.' :
    pronScore >= 5 ? 'Phát âm ở mức trung bình. Nhiều từ chưa được phát âm rõ ràng, cần luyện tập thêm với audio mẫu.' :
    pronScore >= 3 ? 'Phát âm còn yếu, nhiều từ bị nhận diện sai. Hãy nghe lại bài mẫu và luyện từng từ một.' :
    'Phát âm cần cải thiện nhiều. Hãy bắt đầu bằng việc nghe và lặp lại từng từ đơn giản.';

  const fluencyFeedback = fluencyScore >= 9 ? 'Đọc rất trôi chảy, tốc độ tự nhiên, không bị ngắt quãng.' :
    fluencyScore >= 7 ? 'Đọc khá trôi chảy, đôi khi có ngắt nghỉ nhưng nhìn chung mạch lạc.' :
    fluencyScore >= 5 ? 'Tốc độ đọc chưa đều, có nhiều chỗ ngắt quãng. Cần luyện đọc liền mạch hơn.' :
    fluencyScore >= 3 ? 'Đọc còn chậm và ngắt quãng nhiều. Hãy luyện đọc từng câu ngắn trước.' :
    'Cần luyện tập thêm nhiều. Hãy bắt đầu bằng cách đọc từng cụm từ ngắn.';

  const accFeedback = accuracyScore >= 9 ? 'Độ chính xác xuất sắc! Hầu hết các từ trong bài đều được đọc đúng.' :
    accuracyScore >= 7 ? 'Độ chính xác khá cao, chỉ bỏ sót vài từ. Rất tốt!' :
    accuracyScore >= 5 ? 'Đọc được khoảng một nửa bài. Cần đọc chậm hơn và chú ý từng từ.' :
    accuracyScore >= 3 ? 'Còn bỏ sót nhiều từ trong bài. Hãy đọc lại từng đoạn nhỏ.' :
    'Cần đọc lại toàn bộ bài. Hãy nghe audio mẫu nhiều lần trước khi thử lại.';

  const rangeFeedback = rangeScore >= 9 ? 'Sử dụng được gần như toàn bộ từ vựng trong bài, rất ấn tượng!' :
    rangeScore >= 7 ? 'Vốn từ tốt, đã sử dụng được phần lớn từ vựng trong bài đọc.' :
    rangeScore >= 5 ? 'Sử dụng được khoảng một nửa từ vựng. Cần mở rộng thêm vốn từ.' :
    rangeScore >= 3 ? 'Vốn từ còn hạn chế, chỉ đọc được một số từ cơ bản.' :
    'Cần học thêm từ vựng. Hãy ôn lại phần Word Bank bên trên.';

  const criteria: CEFRCriteria[] = [
    { name: 'Phát âm', nameEn: 'Pronunciation', score: pronScore, feedback: pronFeedback, icon: '🗣️' },
    { name: 'Sự lưu loát', nameEn: 'Fluency', score: fluencyScore, feedback: fluencyFeedback, icon: '💨' },
    { name: 'Độ chính xác', nameEn: 'Accuracy', score: accFeedback ? accuracyScore : 0, feedback: accFeedback, icon: '🎯' },
    { name: 'Vốn từ vựng', nameEn: 'Range & Vocabulary', score: rangeScore, feedback: rangeFeedback, icon: '📚' },
  ];

  const overallScore = Math.round(((pronScore + fluencyScore + accuracyScore + rangeScore) / 4) * 10) / 10;
  const cefrLevel = getCEFRLevel(overallScore);

  let overallComment = '';
  if (overallScore >= 9) {
    overallComment = 'Thật xuất sắc! Cô Yến đánh giá rất cao độ hoàn thiện trong bài đọc của em. Em đã phát âm tròn vành rõ chữ, ngữ điệu tự nhiên và đọc đầy đủ nội dung bài. Hãy tiếp tục duy trì phong độ tuyệt vời này nhé! 🌟';
  } else if (overallScore >= 7) {
    overallComment = 'Bài đọc của em đạt mức khá giỏi. Em đã đọc được phần lớn số từ với phát âm tương đối chuẩn. Để hoàn hảo hơn, em hãy chú ý mở khẩu hình ở các âm đuôi (ending sounds) và đảm bảo không lướt qua hay bỏ sót chữ nào nhé. 👏';
  } else if (overallScore >= 5) {
    overallComment = 'Em đã có một sự nỗ lực đáng ghi nhận. Tuy nhiên, độ bao phủ từ vựng và sự rõ ràng trong phát âm vẫn cần được cải thiện. Cô Yến khuyên em nên chia nhỏ bài đọc, nghe kỹ audio gốc và lặp lại từng cụm từ để không bị rớt chữ. 💪';
  } else if (overallScore >= 3) {
    overallComment = 'Cô Yến thấy em đang gặp chút khó khăn. Số từ em bỏ sót khá nhiều và nhiều âm tiết chưa rõ, khiến nội dung bị gián đoạn. Không sao cả! Em hãy nghe lại audio mẫu thêm vài lần, sau đó đọc thật chậm rãi từng từ một trước khi ghép thành câu nhé. 📚';
  } else {
    overallComment = 'Bài đọc này đang hơi quá sức vì tỷ lệ hoàn thiện từ và độ chuẩn xác âm của em còn thấp. Em hãy tạm dừng việc đọc cả bài, bắt đầu lại bằng cách nghe audio mẫu và luyện tập thật kỹ từng câu ngắn. Cô Yến tin với sự kiên trì, em sẽ tiến bộ! ❤️';
  }

  return { criteria, overallScore, cefrLevel, overallComment, missedWords: missedWords.slice(0, 10), extraWords: extraWords.slice(0, 5) };
};

const getScoreColor = (score: number) => {
  if (score >= 8) return { bar: 'bg-gradient-to-r from-emerald-400 to-green-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 6) return { bar: 'bg-gradient-to-r from-blue-400 to-cyan-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (score >= 4) return { bar: 'bg-gradient-to-r from-amber-400 to-orange-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { bar: 'bg-gradient-to-r from-rose-400 to-red-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
};

const ReadingPractice: React.FC<{ originalText: string | null }> = ({ originalText }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<CEFRResult | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [insufficientCoverage, setInsufficientCoverage] = useState(false);
  const [coveragePercent, setCoveragePercent] = useState(0);
  const recognitionRef = useRef<any>(null);

  const MIN_COVERAGE = 70;

  const calculateCoverage = (spokenText: string, origText: string): number => {
    const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s']/gi, '').split(/\s+/).filter(Boolean);
    const spokenWords = normalize(spokenText);
    const originalWords = normalize(origText);
    if (originalWords.length === 0) return 0;
    const spokenFreq: Record<string, number> = {};
    spokenWords.forEach(w => spokenFreq[w] = (spokenFreq[w] || 0) + 1);
    let matchCount = 0;
    const tempFreq = { ...spokenFreq };
    originalWords.forEach(w => {
      if (tempFreq[w] > 0) { matchCount++; tempFreq[w]--; }
    });
    return Math.round((matchCount / originalWords.length) * 100);
  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Chrome.');
      return;
    }

    // Stop any existing recognition instance to prevent InvalidStateError
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    // Track the latest transcript via a local variable to avoid stale state in callbacks
    let latestTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
      setResult(null);
      setInsufficientCoverage(false);
      setCoveragePercent(0);
    };
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      latestTranscript = finalTranscript;
      setTranscript(finalTranscript);
      if (originalText) setCoveragePercent(calculateCoverage(finalTranscript, originalText));
    };
    recognition.onerror = (event: any) => { console.error(event.error); setIsRecording(false); };
    recognition.onend = () => {
      setIsRecording(false);
      // Auto-evaluate if recognition ended unexpectedly (e.g., silence timeout)
      // but the user had already spoken some content
      if (latestTranscript && originalText) {
        setTranscript(latestTranscript);
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error('[ReadingPractice] Failed to start recognition:', e);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (!isRecording && transcript && originalText) {
      const coverage = calculateCoverage(transcript, originalText);
      setCoveragePercent(coverage);
      // Removed the MIN_COVERAGE check as per new requirements
      setInsufficientCoverage(false);
      setResult(evaluateCEFR(transcript, originalText));
    }
  }, [isRecording, transcript, originalText]);

  const getCoverageBarColor = (pct: number) => {
    if (pct >= MIN_COVERAGE) return 'bg-gradient-to-r from-emerald-400 to-green-500';
    if (pct >= 50) return 'bg-gradient-to-r from-amber-400 to-orange-500';
    return 'bg-gradient-to-r from-rose-400 to-red-500';
  };

  return (
    <div className="mt-6 p-4 sm:p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col items-center" data-html2canvas-ignore>
      <div className="text-center mb-4">
        <h4 className="text-sm sm:text-base font-black text-indigo-800 uppercase tracking-wide">🎤 Reading & Speaking Evaluation</h4>
        <p className="text-xs text-indigo-600/70 mt-1">Evaluated based on CEFR — Max Score 10</p>
        <p className="text-[10px] text-indigo-500 font-bold mt-1.5 bg-indigo-50 px-3 py-1 rounded-full inline-block border border-indigo-200">
          💡 You will be scored based on how much you read.
        </p>
      </div>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isRecording 
            ? 'bg-rose-500 text-white animate-pulse shadow-rose-300 scale-110' 
            : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:scale-105 shadow-indigo-200'
        }`}
      >
        {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
      </button>
      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-2">
        {isRecording ? '🔴 Recording...' : 'Tap to Record'}
      </p>

      {isRecording && (
        <div className="mt-4 w-full space-y-2">
          <div className="flex items-center gap-2 text-xs text-rose-500 font-medium animate-pulse justify-center">
            <div className="flex gap-1">
              <div className="w-1 h-3 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 h-4 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1 h-3 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              <div className="w-1 h-5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
              <div className="w-1 h-3 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '250ms' }}></div>
            </div>
            Read aloud clearly!
          </div>
          <div className="bg-white rounded-xl p-3 border border-indigo-100 shadow-sm">
            <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
              <span className="text-slate-500">📊 Reading Progress</span>
              <span className="text-emerald-600">
                {coveragePercent}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${getCoverageBarColor(coveragePercent)}`} style={{ width: `${Math.min(100, coveragePercent)}%` }} />
            </div>
          </div>
        </div>
      )}


      {!isRecording && transcript && (
        <div className="mt-3 w-full bg-white rounded-xl p-3 border border-indigo-100 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-600">📊 Reading Coverage</span>
            <span className="font-black text-emerald-600">{coveragePercent}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${getCoverageBarColor(coveragePercent)}`} style={{ width: `${Math.min(100, coveragePercent)}%` }} />
          </div>
        </div>
      )}

      {insufficientCoverage && !isRecording && (
        <div className="mt-4 w-full p-4 bg-rose-50 rounded-xl border-2 border-rose-200 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-200 border-2 border-rose-300 flex items-center justify-center shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <h5 className="font-black text-rose-700 text-sm mb-1">Chưa đủ điều kiện chấm điểm</h5>
              <p className="text-xs text-rose-800 font-medium leading-relaxed">
                Bạn mới đọc được <span className="font-black text-rose-600">{coveragePercent}%</span> bài đọc.
                Cần đọc ít nhất <span className="font-black text-rose-600">{MIN_COVERAGE}%</span> nội dung bài mới được chấm điểm.
              </p>
              <p className="text-xs text-rose-600 mt-2 font-bold">💡 Hãy đọc to, rõ ràng và đọc hết toàn bộ bài văn rồi thử lại nhé!</p>
            </div>
          </div>
          <button
            onClick={() => { setTranscript(''); setResult(null); setInsufficientCoverage(false); setCoveragePercent(0); }}
            className="mt-3 w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl transition-all text-sm shadow-sm active:scale-[0.98] uppercase tracking-wider"
          >
            🔄 Đọc lại từ đầu
          </button>
        </div>
      )}

      {result && !isRecording && !insufficientCoverage && (
        <div className="mt-6 w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative overflow-hidden bg-white rounded-2xl border-2 border-indigo-100 shadow-md p-5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full opacity-50"></div>
            <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getCEFRColor(result.cefrLevel)} flex flex-col items-center justify-center shadow-lg`}>
                <span className="text-white text-2xl font-black leading-none">{result.cefrLevel}</span>
                <span className="text-white/80 text-[8px] font-bold uppercase tracking-wider">CEFR</span>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="text-3xl font-black text-slate-800">{result.overallScore}<span className="text-lg text-slate-400">/10</span></div>
                <p className="text-xs font-bold text-indigo-600 mt-0.5">{getCEFRDescription(result.cefrLevel)}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide font-bold">Overall Speaking Score</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-all text-sm font-bold text-slate-600"
          >
            <span>📊 Detailed Criteria Breakdown</span>
            <span className={`transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {showDetails && (
            <div className="space-y-3 animate-in fade-in duration-300">
              {result.criteria.map((c, idx) => {
                const colors = getScoreColor(c.score);
                return (
                  <div key={idx} className={`p-4 rounded-xl border ${colors.border} ${colors.bg} shadow-sm`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.icon}</span>
                        <div>
                          <span className="font-black text-sm text-slate-800">{c.name}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-medium">({c.nameEn})</span>
                        </div>
                      </div>
                      <span className={`text-lg font-black ${colors.text}`}>{c.score}/10</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/80 rounded-full overflow-hidden mb-2 border border-white/50">
                      <div className={`h-full rounded-full ${colors.bar} transition-all duration-700`} style={{ width: `${c.score * 10}%` }} />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{c.feedback}</p>
                  </div>
                );
              })}
            </div>
          )}

          {result.missedWords.length > 0 && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
              <h5 className="text-xs font-black text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                ⚠️ Unread Words ({result.missedWords.length} words)
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {result.missedWords.map((w, i) => (
                  <span key={i} className="px-2.5 py-1 bg-white rounded-lg text-xs font-bold text-amber-800 border border-amber-200 shadow-sm">{w}</span>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-pink-50 rounded-xl border-2 border-pink-100 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-200 border-2 border-pink-300 flex items-center justify-center shrink-0">
                <span className="text-xl">👩‍🏫</span>
              </div>
              <div>
                <h5 className="font-black text-pink-700 text-sm mb-1">Nhận xét chung của Ms. Yến</h5>
                <p className="text-sm text-pink-900 font-medium leading-relaxed">{result.overallComment}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => { setTranscript(''); setResult(null); setCoveragePercent(0); }}
            className="w-full py-3 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 font-black rounded-xl transition-all text-sm shadow-sm active:scale-[0.98] uppercase tracking-wider"
          >
            🔄 Try Again
          </button>
        </div>
      )}
    </div>
  );
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5];

const renderMarkdown = (text: string) => {
  if (!text) return null;
  // Strip ALL asterisks from the text
  let cleaned = text.replace(/\*/g, '');
  // Support both [word] bracket notation and **word** markdown for backward compatibility
  // Split on [word] brackets OR **word** patterns
  const parts = cleaned.split(/(\[.*?\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return <strong key={i} className="font-black text-brand-blue-dark">{part.slice(1, -1)}</strong>;
    }
    return <span key={i} className="font-medium">{part}</span>;
  });
};

const getEnglishVoice = () => {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'en-US' && v.name.includes('Samantha')) || 
         voices.find(v => v.lang === 'en-US' && v.name.includes('Siri')) ||
         voices.find(v => v.lang === 'en-US') || 
         voices.find(v => v.lang.startsWith('en')) ||
         null;
};

const playWordAudio = (e: React.MouseEvent, word: string) => {
  e.stopPropagation();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  const voice = getEnglishVoice();
  if (voice) {
    utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
};

interface MindMapNode {
  label: string;
  children: MindMapNode[];
}

const parseMarkdownToTree = (md: string): MindMapNode[] => {
  const lines = md.split('\n').filter(line => line.trim().length > 0);
  const rootNodes: MindMapNode[] = [];
  const stack: { node: MindMapNode, indent: number }[] = [];

  lines.forEach(line => {
    const match = line.match(/^(\s*)-\s+(.*)/);
    if (!match) return;
    const indent = match[1].length;
    let label = match[2];
    label = label.replace(/\*\*/g, '');

    const newNode = { label, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(newNode);
    } else {
      stack[stack.length - 1].node.children.push(newNode);
    }
    stack.push({ node: newNode, indent });
  });

  if (rootNodes.length === 0) {
    return [{ label: "Grammar", children: [{ label: md, children: [] }] }];
  }
  return rootNodes;
};

const MindMapTree = ({ nodes, level = 0 }: { nodes: MindMapNode[], level?: number }) => {
  const colors = [
    'bg-indigo-600 text-white shadow-md border border-indigo-700', 
    'bg-indigo-100 text-indigo-900 shadow-sm border border-indigo-200', 
    'bg-blue-50 text-blue-800 border border-blue-100', 
    'bg-white text-slate-700 border border-slate-200'
  ];
  
  return (
    <div className={`flex flex-col gap-3 ${level > 0 ? 'ml-6 pl-4 border-l-2 border-indigo-200 relative' : ''}`}>
      {nodes.map((node, i) => {
        const colorClass = colors[Math.min(level, colors.length - 1)];
        return (
          <div key={i} className="flex flex-col gap-3 relative">
            {level > 0 && (
              <div className="absolute -left-4 top-[14px] w-4 h-[2px] bg-indigo-200"></div>
            )}
            <div className={`w-fit px-4 py-2.5 rounded-xl font-bold text-sm sm:text-base ${colorClass} max-w-full sm:max-w-[90%] whitespace-normal`}>
              {node.label}
            </div>
            {node.children && node.children.length > 0 && (
              <MindMapTree nodes={node.children} level={level + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ====== GRAMMAR DETAIL SECTION ======
interface GrammarBlock {
  title: string;
  explanation: string;
  formula: string | null;
  examples: string[];
  tip: string | null;
}

const parseGrammarBlocks = (md: string): GrammarBlock[] => {
  const lines = md.split('\n').filter(l => l.trim().length > 0);
  const blocks: GrammarBlock[] = [];
  let current: Partial<GrammarBlock> | null = null;
  let collectingExamples = false;
  let collectingTip = false;

  const flushBlock = () => {
    if (current && current.title) {
      blocks.push({
        title: current.title || '',
        explanation: current.explanation || '',
        formula: current.formula || null,
        examples: current.examples || [],
        tip: current.tip || null,
      });
    }
    current = null;
    collectingExamples = false;
    collectingTip = false;
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    const cleanLine = trimmed.replace(/^-\s*/, '').replace(/\*\*/g, '');

    // Detect top-level grammar point (no leading spaces or minimal indent)
    const indent = line.search(/\S/);
    const isBullet = trimmed.startsWith('-');

    if (isBullet && indent <= 2) {
      // This is a top-level grammar point
      flushBlock();
      current = { title: cleanLine, explanation: '', formula: null, examples: [], tip: null };
      collectingExamples = false;
      collectingTip = false;
    } else if (current) {
      const lower = cleanLine.toLowerCase();
      
      // Detect formula / công thức / cấu trúc
      if (lower.includes('công thức') || lower.includes('cấu trúc') || lower.includes('structure') || lower.includes('formula') || lower.includes('pattern')) {
        const formulaContent = cleanLine.replace(/^(công thức|cấu trúc|structure|formula|pattern)\s*[:：]\s*/i, '').trim();
        if (formulaContent) {
          current.formula = formulaContent;
        }
        collectingExamples = false;
        collectingTip = false;
      }
      // Detect examples / ví dụ
      else if (lower.includes('ví dụ') || lower.includes('example') || lower.includes('e.g.')) {
        collectingExamples = true;
        collectingTip = false;
        const exContent = cleanLine.replace(/^(ví dụ|example|e\.g\.)\s*[:：]\s*/i, '').trim();
        if (exContent) {
          (current.examples = current.examples || []).push(exContent);
        }
      }
      // Detect tips / mẹo
      else if (lower.includes('mẹo') || lower.includes('tip') || lower.includes('lưu ý') || lower.includes('nhớ') || lower.includes('ghi nhớ')) {
        collectingTip = true;
        collectingExamples = false;
        const tipContent = cleanLine.replace(/^(mẹo|tip|lưu ý|ghi nhớ|nhớ)\s*[:：]\s*/i, '').trim();
        current.tip = tipContent || null;
      }
      // Continue collecting examples or add to explanation
      else if (collectingExamples && cleanLine) {
        (current.examples = current.examples || []).push(cleanLine);
      }
      else if (collectingTip && cleanLine) {
        current.tip = (current.tip ? current.tip + ' ' : '') + cleanLine;
      }
      else if (cleanLine) {
        // Check if this looks like a formula (contains S + V, arrows, etc.)
        if (cleanLine.match(/[+→=>]/) && cleanLine.length < 100) {
          current.formula = cleanLine;
        } else {
          current.explanation = (current.explanation ? current.explanation + ' ' : '') + cleanLine;
        }
      }
    }
  });
  flushBlock();

  // Fallback: if no blocks were parsed, create a single block from the text
  if (blocks.length === 0 && md.trim()) {
    blocks.push({
      title: 'Key Grammar',
      explanation: md.replace(/\*\*/g, '').replace(/^-\s*/gm, ''),
      formula: null,
      examples: [],
      tip: null,
    });
  }

  return blocks;
};

const GRAMMAR_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-gradient-to-r from-blue-600 to-blue-700', badge: 'bg-blue-100 text-blue-700', accent: 'text-blue-600' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-gradient-to-r from-emerald-600 to-teal-600', badge: 'bg-emerald-100 text-emerald-700', accent: 'text-emerald-600' },
  { bg: 'bg-violet-50', border: 'border-violet-200', header: 'bg-gradient-to-r from-violet-600 to-purple-600', badge: 'bg-violet-100 text-violet-700', accent: 'text-violet-600' },
  { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-gradient-to-r from-amber-600 to-orange-600', badge: 'bg-amber-100 text-amber-700', accent: 'text-amber-600' },
  { bg: 'bg-rose-50', border: 'border-rose-200', header: 'bg-gradient-to-r from-rose-600 to-pink-600', badge: 'bg-rose-100 text-rose-700', accent: 'text-rose-600' },
];

const GrammarDetailSection: React.FC<{ grammarText: string }> = ({ grammarText }) => {
  const blocks = useMemo(() => parseGrammarBlocks(grammarText), [grammarText]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  return (
    <div className="mt-6 space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
          <BookOpen size={18} />
        </div>
        <div>
          <h3 className="text-base font-black uppercase tracking-widest" style={{ color: '#4338ca' }}>
            Grammar Summary
          </h3>
          <p className="text-[10px] text-slate-400 font-medium">Grammar Summary & Examples</p>
        </div>
      </div>

      {/* Grammar Cards */}
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          const colors = GRAMMAR_COLORS[idx % GRAMMAR_COLORS.length];
          const isExpanded = expandedIdx === idx;

          return (
            <div
              key={idx}
              className={`rounded-2xl border-2 ${colors.border} ${colors.bg} overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md`}
            >
              {/* Card Header - clickable */}
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className={`w-full flex items-center gap-3 p-3 sm:p-4 text-left transition-all ${isExpanded ? colors.header + ' text-white' : 'hover:bg-white/50'}`}
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${isExpanded ? 'bg-white/20 text-white' : colors.badge}`}>
                  {idx + 1}
                </span>
                <span className={`text-sm sm:text-base font-bold flex-1 ${isExpanded ? 'text-white' : 'text-slate-800'}`}>
                  {block.title}
                </span>
                <span className={`text-xs transition-transform duration-300 ${isExpanded ? 'rotate-180 text-white/70' : 'text-slate-400'}`}>
                  ▼
                </span>
              </button>

              {/* Card Body - expandable */}
              {isExpanded && (
                <div className="p-3 sm:p-4 space-y-3 animate-in fade-in duration-300">
                  {/* Explanation */}
                  {block.explanation && (
                    <div className="text-sm text-slate-700 leading-relaxed">
                      <span className="font-semibold text-slate-500 text-xs uppercase tracking-wide mr-1">📖 Explanation:</span>
                      <span>{block.explanation}</span>
                    </div>
                  )}

                  {/* Formula / Structure */}
                  {block.formula && (
                    <div className="relative p-3 sm:p-4 rounded-xl bg-white border-2 border-dashed border-indigo-200 shadow-inner">
                      <div className="absolute -top-2.5 left-3 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-md shadow-sm">
                        Structure
                      </div>
                      <p className="text-base sm:text-lg font-black text-center text-indigo-800 mt-1 font-mono tracking-wide">
                        {block.formula}
                      </p>
                    </div>
                  )}

                  {/* Examples */}
                  {block.examples.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Zap size={14} className={colors.accent} />
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Examples</span>
                      </div>
                      <div className="space-y-2 pl-1">
                        {block.examples.map((ex, exIdx) => (
                          <div
                            key={exIdx}
                            className="flex items-start gap-2 p-2.5 sm:p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors"
                          >
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                              {exIdx + 1}
                            </span>
                            <p className="text-sm text-slate-700 leading-relaxed italic">
                              "{ex}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tip */}
                  {block.tip && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                      <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wide text-amber-600 block mb-0.5">💡 Tip</span>
                        <p className="text-xs text-slate-500 font-medium">Keep practicing!</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Component for individual comprehension question with microphone
const ComprehensionQuestionItem: React.FC<{ index: number, question: string, suggestedAnswer: string }> = ({ index, question, suggestedAnswer }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const calculateScore = (recognized: string, expected: string) => {
    const normalize = (t: string) => t.toLowerCase().replace(/[.,!?]/g, '').trim();
    const rWords = normalize(recognized).split(/\s+/);
    const eWords = normalize(expected).split(/\s+/);
    
    let matches = 0;
    rWords.forEach(w => {
      if (eWords.includes(w)) matches++;
    });
    
    return Math.min(10, Math.round((matches / Math.max(eWords.length, 1)) * 10));
  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Your browser does not support speech recognition. Please use Chrome.');
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
      setScore(null);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setTranscript(finalTranscript);
        setScore(calculateScore(finalTranscript, suggestedAnswer));
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex gap-3 mb-3">
        <span className="font-bold text-indigo-400 shrink-0">Question {index}.</span>
        <p className="font-medium text-slate-800 flex-1">{question}</p>
      </div>
      <div className="ml-9 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
            isRecording 
              ? 'bg-rose-500 text-white animate-pulse shadow-rose-200' 
              : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:scale-105'
          }`}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        
        <div className="flex-1 min-w-0 space-y-2 w-full">
          {transcript && (
            <div className="text-sm bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 italic mr-2">You:</span>
              <span className="text-slate-700 font-medium">{transcript}</span>
            </div>
          )}
          {score !== null && !isRecording && (
            <div className={`text-xs font-bold px-2 py-1 rounded w-fit ${score >= 7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {score >= 7 ? 'Great job!' : 'Keep trying!'} ({score}/10)
            </div>
          )}
          {(!isRecording && score !== null && score < 7) && (
            <div className="text-[10px] text-indigo-500 font-medium bg-indigo-50 px-2 py-1 rounded">
              Suggestion: {suggestedAnswer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PosterPreview: React.FC<PosterPreviewProps> = ({
  apiKey,
  readingText,
  translationText,
  vocabulary,
  generatedTopicName,
  topic,
  level,
  showTranslation,
  audioUrl,
  audioRef,
  isPlaying,
  isAudioLoading,
  isBrowserTTS,
  setIsPlaying,
  handlePlayAudio,
  isDownloading,
  onDownloadPoster,
  onToggleTranslation,
  posterRef,
  grammarSummary,
  comprehensionQuestions,
}) => {
  const [isVocabPlaying, setIsVocabPlaying] = useState(false);

  const handlePlayVocab = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVocabPlaying || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsVocabPlaying(false);
    } else if (vocabulary && vocabulary.length > 0) {
      setIsVocabPlaying(true);
      window.speechSynthesis.cancel(); // Clear any existing speech
      vocabulary.forEach((item, index) => {
        const utterance = new SpeechSynthesisUtterance(item.word);
        utterance.lang = 'en-US';
        const voice = getEnglishVoice();
        if (voice) {
          utterance.voice = voice;
        }
        if (index === vocabulary.length - 1) {
          utterance.onend = () => setIsVocabPlaying(false);
          utterance.onerror = () => setIsVocabPlaying(false);
        }
        window.speechSynthesis.speak(utterance);
      });
    }
  }, [vocabulary, isVocabPlaying]);

  return (
    <div
      ref={posterRef}
      data-poster-container
      className="p-3 sm:p-4 flex flex-col gap-4 relative overflow-hidden"
      style={{
        fontFamily: "'Libre Baskerville', serif",
        backgroundColor: '#ffffff',
        backgroundImage: 'radial-gradient(#f1f5f9 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        color: '#1a1a1a',
        borderRadius: '24px',
        border: '2px solid #e2e8f0',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        width: '100%',
        maxWidth: '600px'
      }}
    >

      {/* Text Section */}
      <div className="flex-1 p-3" style={{ backgroundColor: '#ffffff', border: '3px solid #1D4ED8', borderRadius: '16px', boxShadow: '0 4px 0 #1E3A8A' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText size={18} style={{ color: '#1D4ED8' }} />
            <h2 className="text-base font-black" style={{ color: '#1E3A8A', margin: 0 }}>Open Minds Language Center</h2>
          </div>
          <div className="flex items-center gap-2" data-html2canvas-ignore>
            <button
              onClick={handlePlayVocab}
              className="p-2 rounded-full transition-all hover:bg-blue-50"
              style={{
                backgroundColor: isVocabPlaying ? '#DBEAFE' : '#f9fafb',
                color: isVocabPlaying ? '#1D4ED8' : '#9ca3af'
              }}
              title={isVocabPlaying ? "Stop" : "Listen to Vocabulary"}
            >
              {isVocabPlaying ? <Pause size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-3">

          {/* Vocabulary */}
          {vocabulary && vocabulary.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Target size={18} /></div>
                <h3 className="text-base font-black uppercase tracking-widest" style={{ color: '#0369a1' }}>Word Bank</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vocabulary.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl flex flex-col transition-all hover:scale-[1.02] shadow-sm hover:shadow-indigo-100 bg-white border-2 border-indigo-100/50">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xl leading-tight" style={{ color: '#0c4a6e' }}>{item.word}</span>
                        <button 
                          onClick={(e) => playWordAudio(e, item.word)}
                          className="text-brand-blue hover:text-brand-gold transition-colors"
                          title="Listen to pronunciation"
                        >
                          <Volume2 size={20} />
                        </button>
                      </div>
                      <span className="text-sm font-bold font-serif text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200 shadow-sm shrink-0">{item.ipa}</span>
                    </div>
                    <span className="text-base font-medium italic text-slate-700 whitespace-normal leading-relaxed mb-1">{item.meaning} {item.emoji}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Grammar Summary */}
          {grammarSummary && (
            <div className="mt-6 p-5 bg-indigo-50 border-2 border-indigo-200 rounded-[1.5rem] shadow-sm overflow-x-auto">
              <h4 className="text-sm font-black text-indigo-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                Grammar Mindmap
              </h4>
              <MindMapTree nodes={parseMarkdownToTree(grammarSummary)} />
            </div>
          )}
          <div className="bg-white/40 mt-8 p-3 sm:p-4 md:p-8 rounded-[2rem] border-2 border-white shadow-lg backdrop-blur-sm mx-auto w-full max-w-[95%]">
            {(generatedTopicName || (topic && topic.length < 50)) && (
              <div className="text-center mb-6">
                <h3 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight" style={{ color: '#0369a1', lineHeight: '1.1' }}>
                  {generatedTopicName || topic}
                </h3>
              </div>
            )}
            {/* Custom Audio Player */}
            {audioUrl ? (
              <div data-html2canvas-ignore className="mb-6">
                <CustomAudioPlayer audioUrl={audioUrl} audioRef={audioRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
              </div>
            ) : (
              <div data-html2canvas-ignore className="flex items-center justify-center gap-2 mb-6">
                <button
                  onClick={handlePlayAudio}
                  disabled={isAudioLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-[#0369a1] text-white rounded-xl shadow-lg border-2 border-[#075985] hover:bg-[#0284c7] transition-all font-bold group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAudioLoading ? (
                    <Loader2 size={24} className="animate-spin text-white" />
                  ) : (
                    <Volume2 size={24} className="text-white group-hover:scale-110 transition-transform" />
                  )}
                  {isAudioLoading ? 'Loading Audio...' : 'Listen to AI Audio'}
                </button>
              </div>
            )}
            <div className="text-[11px] font-black uppercase tracking-[0.4em] mb-4 text-center" style={{ color: '#0369a1', opacity: 0.5 }}>READING PASSAGE</div>
            <div
              className="leading-[1.6] whitespace-pre-wrap text-left md:text-justify px-2"
              style={{
                color: '#1e293b',
                fontSize: readingText && readingText.length > 500 ? '18px' : readingText && readingText.length > 300 ? '22px' : readingText && readingText.length > 150 ? '26px' : '30px',
                fontFamily: '"Outfit", sans-serif'
              }}
            >
              {readingText ? renderMarkdown(readingText) : null}
            </div>
            
            {translationText && (
              <div data-html2canvas-ignore className="mt-6 flex justify-center">
                <button
                  onClick={onToggleTranslation}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm
                    ${showTranslation ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50'}`}
                >
                  <Languages size={18} /> {showTranslation ? 'Ẩn bản dịch' : 'Dịch bài đọc'}
                </button>
              </div>
            )}
            {showTranslation && translationText && (
              <div className="space-y-2 pt-3 mt-4" style={{ borderTop: '2px solid #fef3c7' }}>
                <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#d97706' }}>Vietnamese Translation</div>
                <div className="text-sm sm:text-lg leading-relaxed whitespace-pre-wrap font-bold italic" style={{ color: '#334155' }}>
                  {translationText}
                </div>
              </div>
            )}
            
            {readingText && <ReadingPractice originalText={readingText} />}
            {comprehensionQuestions && comprehensionQuestions.length > 0 && (
              <div data-html2canvas-ignore className="mt-8">
                <ReadingComprehension questions={comprehensionQuestions} apiKey={apiKey || ""} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid #f3f4f6' }}>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#9ca3af' }}>OPEN MINDS LANGUAGE CENTER</span>
        <span className="text-[10px] font-black" style={{ color: '#1D4ED8' }}>Level: {level}</span>
      </div>
    </div>
  );
};


// ====== CUSTOM AUDIO PLAYER ======
const CustomAudioPlayer: React.FC<{
  audioUrl: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
}> = ({ audioUrl, audioRef, isPlaying, setIsPlaying }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    // Set initial duration if already loaded
    if (audio.duration) setDuration(audio.duration);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [audioRef, setIsPlaying]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  }, [audioRef, isPlaying]);

  const handleSpeedChange = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentIdx = SPEED_OPTIONS.indexOf(speed);
    const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
    const newSpeed = SPEED_OPTIONS[nextIdx];
    audio.playbackRate = newSpeed;
    setSpeed(newSpeed);
  }, [audioRef, speed]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = ratio * duration;
  }, [audioRef, duration]);

  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mb-3 px-1 space-y-2">
      {/* Hidden native audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Play/Pause Button */}
        <button onClick={togglePlay}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm"
          style={{
            background: isPlaying ? 'linear-gradient(135deg, #1D4ED8, #DC2626)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#ffffff'
          }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        {/* Progress Bar */}
        <div className="flex-1 space-y-0.5">
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="w-full h-2 bg-slate-100 rounded-full cursor-pointer group relative overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #1D4ED8)' }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-indigo-500 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 7px)` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-bold text-slate-400 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Speed Button */}
        <button
          onClick={handleSpeedChange}
          className="px-2 py-1 rounded-lg text-[10px] font-black transition-all shrink-0 border"
          style={{
            backgroundColor: speed !== 1 ? '#eef2ff' : '#f9fafb',
            borderColor: speed !== 1 ? '#c7d2fe' : '#e5e7eb',
            color: speed !== 1 ? '#4f46e5' : '#6b7280'
          }}
          title="Change Speed"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
};

