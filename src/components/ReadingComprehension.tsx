import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, MessageSquare, AlertCircle, CheckCircle2, Award } from 'lucide-react';
import { evaluateComprehensionAnswer } from '../services/geminiService';

export interface ComprehensionQuestion {
  question: string;
  options: string[];  // Kept for backward compatibility
  correctAnswer: string;
  suggestedAnswer: string;
}

interface ReadingComprehensionProps {
  questions: ComprehensionQuestion[];
  apiKey: string;
}

interface EvaluationResult {
  isCorrect: boolean;
  feedback: string;
  studentAnswer: string;
}

export const ReadingComprehension: React.FC<ReadingComprehensionProps> = ({ questions, apiKey }) => {
  const [evaluations, setEvaluations] = useState<Record<number, EvaluationResult>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [activeMic, setActiveMic] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startSpeechRecognition = (qIdx: number) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Your browser doesn't support speech recognition. Please use Chrome.");
      return;
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setActiveMic(qIdx);
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      setActiveMic(null);
    };

    recognition.onend = () => {
      // We don't auto evaluate on end, we wait for manual stop to ensure full transcript is captured, 
      // but if it ends unexpectedly, we could evaluate if transcript is full.
      // For now, let's keep it manual stop for better UX control.
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleStopAndEvaluate = async (qIdx: number) => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setActiveMic(null);
    
    const finalAnswer = transcript.trim();
    if (!finalAnswer) return;

    setLoadingMap(prev => ({ ...prev, [qIdx]: true }));
    setTranscript("");
    
    try {
      const q = questions[qIdx];
      const result = await evaluateComprehensionAnswer(apiKey, q.question, finalAnswer, q.suggestedAnswer);
      
      setEvaluations(prev => ({
        ...prev,
        [qIdx]: {
          isCorrect: result.isCorrect,
          feedback: result.feedback,
          studentAnswer: finalAnswer
        }
      }));
    } catch (err) {
      console.error(err);
      alert("Grading error: " + (err as Error).message);
    } finally {
      setLoadingMap(prev => ({ ...prev, [qIdx]: false }));
    }
  };

  const isAllAnswered = Object.keys(evaluations).length === questions.length && questions.length > 0;
  const correctCount = Object.values(evaluations).filter(e => e.isCorrect).length;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 10) : 0;

  return (
    <div className="bg-white rounded-[2rem] shadow-xl border-[6px] border-brand-blue-dark overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-black text-brand-blue uppercase tracking-widest mb-2">
            READING COMPREHENSION
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Click the Microphone button and read your answer out loud in English!
          </p>
        </div>

        <div className="space-y-8">
          {questions.map((q, qIdx) => {
            const evaluation = evaluations[qIdx];
            const isLoading = loadingMap[qIdx];

            return (
              <div key={qIdx} className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center font-black text-sm shrink-0 mt-1">
                    {qIdx + 1}
                  </div>
                  <div className="flex-1 font-semibold text-slate-800 pt-1 leading-relaxed">
                    {q.question}
                    
                    {/* Live transcript feedback for active mic */}
                    {activeMic === qIdx && transcript && (
                      <div className="mt-2 text-xs text-blue-600 font-medium italic bg-blue-50 p-2 rounded-lg border border-blue-100 shadow-inner">
                        You are saying: "{transcript}"
                      </div>
                    )}
                  </div>
                  
                  {/* Voice Answer Button */}
                  <button
                    onClick={() => activeMic === qIdx ? handleStopAndEvaluate(qIdx) : startSpeechRecognition(qIdx)}
                    disabled={isLoading}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm border-2 ${
                      isLoading ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' :
                      activeMic === qIdx
                        ? 'bg-rose-50 border-rose-200 text-rose-500 animate-pulse'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-brand-blue hover:border-brand-blue hover:bg-blue-50'
                    }`}
                    title="Answer by voice"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : activeMic === qIdx ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                </div>

                {/* Evaluation Result */}
                {evaluation && !isLoading && activeMic !== qIdx && (
                  <div className={`ml-0 sm:ml-12 p-4 rounded-xl border-2 animate-in fade-in slide-in-from-top-2 ${
                    evaluation.isCorrect ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'
                  }`}>
                    <div className="flex gap-3 mb-2">
                      {evaluation.isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 mb-0.5 uppercase tracking-wider">Em đã trả lời:</div>
                        <div className={`font-medium ${evaluation.isCorrect ? 'text-green-800' : 'text-orange-800'} italic`}>
                          "{evaluation.studentAnswer}"
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <div className="flex gap-2 items-start">
                        <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${evaluation.isCorrect ? 'text-green-600' : 'text-orange-500'}`} />
                        <div>
                          <span className={`text-xs font-black block mb-0.5 ${evaluation.isCorrect ? 'text-green-700' : 'text-orange-700'}`}>
                            Cô Yến nhận xét:
                          </span>
                          <span className={`text-sm ${evaluation.isCorrect ? 'text-green-900' : 'text-orange-900'} leading-relaxed block`}>
                            {evaluation.feedback}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isAllAnswered && (
          <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-3 text-brand-blue font-bold mb-4">
                <Award className="w-6 h-6" />
                <span className="uppercase tracking-wider">Your Result</span>
              </div>
              <div className="text-4xl font-black text-brand-blue-dark text-center mb-2">
                {score}/10
              </div>
              <div className="text-center text-sm font-medium text-brand-blue/80">
                (Correct {correctCount}/{questions.length})
              </div>
            </div>

            <div className="bg-pink-50 border-2 border-pink-100 rounded-xl p-6">
              <div className="font-black text-pink-600 mb-4 uppercase tracking-wide">Feedback from Cô Yến:</div>
              {correctCount === questions.length ? (
                <p className="text-pink-800 font-medium">Tuyệt vời! Em đã trả lời chính xác tất cả các câu hỏi! 🎉</p>
              ) : (
                <div className="text-pink-800 space-y-4 text-sm">
                  <p className="font-bold">Khá lắm! Tuy nhiên em hãy xem lại đáp án gợi ý cho các câu chưa chính xác nhé:</p>
                  <div className="space-y-3">
                    {questions.map((q, idx) => {
                      const evalResult = evaluations[idx];
                      if (evalResult && !evalResult.isCorrect) {
                        return (
                          <div key={idx} className="bg-white/80 p-4 rounded-xl border border-pink-100 shadow-sm">
                            <span className="font-black text-pink-700 block mb-1">Question {idx + 1}:</span> 
                            <span className="text-slate-700 font-medium leading-relaxed">{q.suggestedAnswer}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-8">
              <button
                onClick={() => setEvaluations({})}
                className="w-full bg-slate-100 text-slate-700 font-black uppercase tracking-wider py-4 rounded-xl hover:bg-slate-200 transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5 border-2 border-slate-200"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
