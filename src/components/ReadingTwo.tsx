import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, CheckCircle, XCircle, Award, Play, Pause, Languages } from 'lucide-react';
import { EnglishLevel, VocabularyItem } from '../types';
import { HomeworkSection } from './HomeworkSection';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5];

interface ReadingTwoProps {
  readingText: string;
  translationText: string | null;
  vocabulary: VocabularyItem[];
  answers: string[] | null;
  topicName: string | null;
  level: EnglishLevel;
  showTranslation: boolean;
  audioUrl: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  isAudioLoading: boolean;
  setIsPlaying: (playing: boolean) => void;
  handlePlayAudio: () => Promise<void>;
  homeworkData?: any;
  onToggleTranslation: () => void;
}

export const ReadingTwo: React.FC<ReadingTwoProps> = ({
  readingText,
  translationText,
  vocabulary,
  answers,
  topicName,
  level,
  showTranslation,
  audioUrl,
  audioRef,
  isPlaying,
  isAudioLoading,
  setIsPlaying,
  handlePlayAudio,
  homeworkData,
  onToggleTranslation,
}) => {
  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Audio player state
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
    if (!audio) {
      // If audio hasn't been loaded yet, use handlePlayAudio
      handlePlayAudio();
      return;
    }
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  }, [audioRef, isPlaying, handlePlayAudio]);

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

  const handleInputChange = (index: number, value: string) => {
    setUserInputs(prev => ({ ...prev, [index]: value }));
  };

  const checkAnswers = () => {
    setIsSubmitted(true);
  };

  // Helper to normalize strings for comparison
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const totalQuestions = answers?.length || 0;
  const correctCount = answers?.reduce((acc, ans, idx) => {
    const num = idx + 1;
    const userAns = normalize(userInputs[num] || '');
    return acc + (userAns === normalize(ans) ? 1 : 0);
  }, 0) || 0;
  const scoreStr = totalQuestions > 0 ? ((correctCount / totalQuestions) * 10).toFixed(1).replace('.0', '') : "0";

  // Parse text like "Some text (1) more text (2)." into parts
  // We look for "(1)", "(2)", etc.
  const parts = readingText.split(/(\(\d+\))/g);

  return (
    <div className="bg-white rounded-[2rem] shadow-xl p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden border-[6px] border-brand-blue-dark">
      <div className="flex items-center justify-between">
        <h3 className="text-xl sm:text-2xl font-black text-brand-blue uppercase tracking-widest">
          Reading 2 (Fill in the blanks)
        </h3>
      </div>

      {/* Word Bank */}
      <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
        <h4 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">Word Bank</h4>
        <div className="flex flex-wrap gap-2">
          {vocabulary.map((v, idx) => (
            <span key={idx} className="bg-white border border-blue-200 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold shadow-sm">
              {v.word}
            </span>
          ))}
        </div>
      </div>

      {/* Custom Audio Player Bar */}
      <div className="px-1 space-y-2">
        {audioUrl ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause Button */}
            <button onClick={togglePlay}
              disabled={isAudioLoading}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm disabled:opacity-50"
              style={{
                background: isPlaying ? 'linear-gradient(135deg, #1D4ED8, #DC2626)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                color: '#ffffff'
              }}
            >
              {isAudioLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause size={16} />
              ) : (
                <Play size={16} className="ml-0.5" />
              )}
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
              title="Change speed"
            >
              {speed}x
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayAudio}
              disabled={isAudioLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-blue bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm disabled:opacity-50"
            >
              {isAudioLoading ? <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /> : <Volume2 size={14} />}
              {isAudioLoading ? 'Loading AI Audio...' : 'Listen to AI Audio'}
            </button>
          </div>
        )}
      </div>

      <div className="text-sm sm:text-base font-medium text-slate-700 leading-loose mt-2">
        {parts.map((part, i) => {
          const match = part.match(/^\((\d+)\)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            const index = num - 1; // zero based
            const expectedAns = answers?.[index] || '';
            const userAns = userInputs[num] || '';
            const isCorrect = normalize(userAns) === normalize(expectedAns);

            return (
              <span key={i} className="inline-flex flex-col items-center mx-1 relative top-2">
                <div className="relative">
                  <input
                    type="text"
                    value={userInputs[num] || ''}
                    onChange={(e) => handleInputChange(num, e.target.value)}
                    disabled={isSubmitted}
                    className={`w-24 sm:w-32 border-b-2 bg-slate-50 text-center font-bold px-2 py-1 outline-none transition-colors ${
                      isSubmitted
                        ? isCorrect
                          ? 'border-green-500 text-green-700 bg-green-50'
                          : 'border-red-500 text-red-700 bg-red-50'
                        : 'border-slate-300 focus:border-brand-blue text-brand-blue-dark focus:bg-white'
                    }`}
                    placeholder={`(${num})`}
                  />
                  {isSubmitted && (
                    <div className="absolute -top-2 -right-2 bg-white rounded-full z-10">
                      {isCorrect ? (
                        <CheckCircle size={18} className="text-green-500" />
                      ) : (
                        <XCircle size={18} className="text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {isSubmitted && !isCorrect && answers && answers[index] && (
                  <span className="text-[11px] font-black text-green-700 mt-1 bg-green-100 px-2 py-0.5 rounded-md border border-green-200">
                    {answers[index]}
                  </span>
                )}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
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
        <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
          <p className="text-slate-600 italic text-sm sm:text-base leading-relaxed">
            {translationText}
          </p>
        </div>
      )}

      {!isSubmitted ? (
        <button
          onClick={checkAnswers}
          className="mt-4 px-6 py-3 bg-brand-blue hover:bg-brand-blue-dark text-white font-black rounded-xl uppercase tracking-widest transition-all self-center shadow-lg active:scale-95"
        >
          Check Answers
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-100 rounded-xl">
            <h4 className="font-black text-blue-900 flex items-center gap-2">
              <Award size={20} className="text-blue-600" />
              Your Score
            </h4>
            <div className="text-2xl font-black text-blue-700">
              {scoreStr} <span className="text-base text-blue-400">/ 10</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-pink-50 border-2 border-pink-100 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-pink-200 border-2 border-pink-300 flex items-center justify-center shrink-0">
               <span className="text-xl">👩‍🏫</span>
            </div>
            <div>
              <h4 className="font-black text-pink-700 text-sm mb-1">Feedback from Ms. Yen</h4>
              <p className="text-pink-900 font-medium text-sm">
                {parseFloat(scoreStr) >= 9 ? "Tuyệt vời quá con yêu! Con làm rất xuất sắc, cô Yến rất tự hào về con! 🌟" :
                 parseFloat(scoreStr) >= 7 ? "Làm tốt lắm! Con hãy xem lại phần gợi ý để rút kinh nghiệm nhé, sắp hoàn hảo rồi! 👍" :
                 parseFloat(scoreStr) >= 5 ? "Cố lên con! Lần sau con chú ý nghe kỹ hơn một chút là điểm sẽ cao ngay. Cô tin con làm được! 💪" :
                 "Không sao đâu con, bài này hơi khó một chút. Con hãy nghe lại và làm lại cùng cô Yến nhé! ❤️"}
              </p>
            </div>
          </div>

            <div className="p-4 bg-slate-100 rounded-xl space-y-3 text-sm border border-slate-200">
              <h4 className="font-black text-slate-700 flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                Suggested Answers, Pronunciation & Translation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {answers?.map((ans, idx) => {
                  const vocabMatch = vocabulary.find(v => v.word.toLowerCase() === ans.toLowerCase());
                  return (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-800">{ans}</span>
                          {vocabMatch?.ipa && (
                            <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{vocabMatch.ipa}</span>
                          )}
                        </div>
                        {vocabMatch?.meaning && (
                          <span className="text-xs text-slate-500 italic truncate">{vocabMatch.meaning}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            <button 
              onClick={() => { setIsSubmitted(false); setUserInputs({}); }}
              className="mt-4 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-xs shadow-sm active:scale-95"
            >
              Try Again
            </button>
          </div>
          
          {homeworkData && <HomeworkSection data={homeworkData} />}
        </div>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      )}
    </div>
  );
};
