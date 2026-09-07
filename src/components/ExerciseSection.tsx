import React, { useState } from 'react';
import { ExerciseData, WrittenQuestion, QuestionType } from '../types';
import { CheckCircle, X, Award, FileText, Info } from 'lucide-react';
import { motion } from 'motion/react';

import { evaluateEssay } from '../services/geminiService';
import { EnglishLevel } from '../types';

interface ExerciseSectionProps {
  exerciseData: ExerciseData;
  onComplete: (score: number) => void;
  onWritingComplete?: (score: number) => void;
  savedScore?: number | null;
  level: EnglishLevel;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  fill_blank: "Part 1: Fill in the blank",
  rearrange: "Part 2: Rearrange words into a complete sentence",
  find_mistake: "Part 3: Find and correct the mistakes",
  complete_sentence: "Part 4: Complete the sentence using the given words"
};

export const ExerciseSection: React.FC<ExerciseSectionProps> = ({ exerciseData, onComplete, onWritingComplete, savedScore, level }) => {
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Essay states
  const [isEssayGrading, setIsEssayGrading] = useState(false);
  const [essayScore, setEssayScore] = useState<number | null>(null);
  const [essayFeedback, setEssayFeedback] = useState<string | null>(null);

  const questions = exerciseData.questions || [];

  const handleInputChange = (id: string, value: string) => {
    setUserInputs(prev => ({ ...prev, [id]: value }));
  };

  const calculateScore = () => {
    let correctCount = 0;
    questions.forEach(q => {
      const userAns = String(userInputs[q.id] || "").trim().toLowerCase();
      const expected = String(q.expectedAnswer || "").trim().toLowerCase();
      if (userAns === expected && expected !== "") {
        correctCount++;
      }
    });
    // Scale to 10 points
    return Math.round((correctCount / Math.max(questions.length, 1)) * 10 * 10) / 10;
  };

  const handleSubmit = () => {
    if (window.confirm("Are you sure you want to submit?")) {
      setIsSubmitted(true);
      const score = calculateScore();
      onComplete(score);
    }
  };

  const getMsYenFeedback = (score: number) => {
    if (score >= 9) return "Tuyệt vời quá em yêu! Em làm rất xuất sắc, Cô Yến rất tự hào về em! 🌟";
    if (score >= 7) return "Làm tốt lắm! Em hãy xem lại phần giải thích để rút kinh nghiệm những câu sai nhé, sắp hoàn hảo rồi! 👍";
    if (score >= 5) return "Cố lên em! Lần sau em chú ý đọc kỹ đề hơn một chút là điểm sẽ cao ngay. Cô Yến tin em làm được! 💪";
    return "Không sao đâu em, bài này hơi khó một chút. Em hãy xem kỹ lại đáp án và giải thích nhé! ❤️";
  };

  // Group questions by type
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.type]) acc[q.type] = [];
    acc[q.type].push(q);
    return acc;
  }, {} as Record<QuestionType, WrittenQuestion[]>);

  const order: QuestionType[] = ['fill_blank', 'rearrange', 'find_mistake', 'complete_sentence'];

  const score = isSubmitted ? calculateScore() : (savedScore || 0);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 mt-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 sm:p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-20"><FileText size={150} /></div>
        <h3 className="text-2xl sm:text-3xl font-black flex items-center gap-3 relative z-10">
          Practice Exercises
        </h3>
        <p className="text-blue-100 mt-3 font-medium text-sm sm:text-base max-w-lg relative z-10">
          Complete the {questions.length} questions below. After submitting, Cô Yến will grade and give you feedback.
        </p>
      </div>

      <div className="space-y-8">
        {order.map((type) => {
          const typeQuestions = groupedQuestions[type];
          if (!typeQuestions || typeQuestions.length === 0) return null;

          return (
            <div key={type} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h4 className="text-xl font-black text-brand-blue-dark mb-6 border-b-2 border-brand-blue/20 pb-3">
                {TYPE_LABELS[type]}
              </h4>
              <div className="space-y-6">
                {typeQuestions.map((q, idx) => {
                  const userAns = String(userInputs[q.id] || "").trim().toLowerCase();
                  const expected = String(q.expectedAnswer || "").trim().toLowerCase();
                  const isCorrect = userAns === expected;

                  return (
                    <div key={q.id} className="p-4 sm:p-5 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <div className="flex-shrink-0">
                          <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 font-bold rounded-full">
                            {idx + 1}
                          </span>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="text-slate-800 font-medium">
                            {String(q.questionText || "").split('___').map((part, pIdx, arr) => (
                              <React.Fragment key={pIdx}>
                                {part}
                                {pIdx < arr.length - 1 && (
                                  <span className="inline-block w-16 border-b-2 border-slate-400 mx-1"></span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          {q.suggestedWords && typeof q.suggestedWords === 'string' && (
                            <div className="flex flex-wrap gap-2">
                              {q.suggestedWords.split(',').map((word, wIdx) => (
                                <span key={wIdx} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm border border-slate-200">
                                  {word.trim()}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="relative flex-1 w-full">
                              <input
                                type="text"
                                value={userInputs[q.id] || ''}
                                onChange={(e) => handleInputChange(q.id, e.target.value)}
                                placeholder="Your answer..."
                                disabled={isSubmitted}
                                className={`w-full p-3 rounded-xl border-2 outline-none transition-all ${
                                  isSubmitted
                                    ? isCorrect
                                      ? 'bg-green-50 border-green-200 text-green-900'
                                      : 'bg-red-50 border-red-200 text-red-900'
                                    : 'bg-white border-slate-200 focus:border-blue-500'
                                }`}
                              />
                              {isSubmitted && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  {isCorrect ? (
                                    <CheckCircle className="text-green-500" size={20} />
                                  ) : (
                                    <X className="text-red-500" size={20} />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {isSubmitted && !isCorrect && (
                            <div className="p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">
                              <span className="font-bold">Correct answer:</span> {q.expectedAnswer}
                            </div>
                          )}
                          
                          {isSubmitted && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                              <div className="flex gap-2 items-start p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-800">
                                  <strong>Explanation:</strong> {q.explanation || "No explanation provided"}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {exerciseData.essay && (
          <div className="mb-8 p-6 sm:p-8 bg-teal-50 rounded-2xl border-2 border-teal-100">
            <h3 className="text-xl sm:text-2xl font-black text-teal-800 mb-6 flex items-center gap-3">
              <span className="bg-teal-200 text-teal-800 p-2 rounded-xl"><FileText size={24} /></span>
              Part 5: Writing
            </h3>
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="space-y-4 mb-4">
                <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                  <h5 className="font-bold text-teal-800 mb-2">Topic:</h5>
                  <p className="text-teal-900 font-medium">{exerciseData.essay.topic}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h5 className="font-bold text-slate-700 text-xs mb-2 uppercase tracking-wider">Guidance:</h5>
                  <p className="text-sm text-slate-600 italic whitespace-pre-wrap">{exerciseData.essay.guidance}</p>
                </div>
              </div>
              <textarea
                value={userInputs['essay'] || ''}
                onChange={(e) => handleInputChange('essay', e.target.value)}
                disabled={isEssayGrading || essayScore !== null}
                className={`w-full border-2 rounded-xl p-4 outline-none min-h-[200px] transition-colors ${
                  essayScore !== null 
                    ? 'bg-gray-50 border-gray-200 text-gray-700' 
                    : 'bg-white border-slate-200 focus:border-teal-400'
                }`}
                placeholder="Start writing your essay here..."
              />

              {!essayScore && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={async () => {
                      const text = (userInputs['essay'] || '').trim();
                      if (!text) {
                        alert("Please write your essay first!");
                        return;
                      }
                      setIsEssayGrading(true);
                      setEssayFeedback(null);
                      try {
                        const result = await evaluateEssay(text, exerciseData.essay!.topic, level);
                        setEssayScore(result.score);
                        setEssayFeedback(result.feedback);
                        if (onWritingComplete) onWritingComplete(result.score);
                      } catch (err) {
                        alert("Lỗi chấm điểm. Vui lòng thử lại sau.");
                      } finally {
                        setIsEssayGrading(false);
                      }
                    }}
                    disabled={isEssayGrading || !userInputs['essay']?.trim()}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2 transition-all"
                  >
                    {isEssayGrading ? (
                      <>
                         <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                         Grading...
                      </>
                    ) : (
                      "Submit Essay"
                    )}
                  </button>
                </div>
              )}

              {essayScore !== null && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-5 bg-white border-2 border-teal-200 rounded-xl shadow-sm">
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                    <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center border border-teal-200 shrink-0">
                      <span className="text-2xl font-black text-teal-700">{essayScore}<span className="text-sm text-teal-500">/10</span></span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">Essay Score</h4>
                      <p className="text-sm text-slate-500">Graded by AI Teacher</p>
                    </div>
                  </div>
                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                    {essayFeedback}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {(!questions || questions.length === 0) && (
          <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            There are no questions in this lesson.
          </div>
        )}
      </div>

      {!isSubmitted && questions.length > 0 && (
        <div className="flex justify-center mt-8 pb-10">
          <button
            onClick={handleSubmit}
            className="px-10 py-4 bg-brand-blue hover:bg-brand-blue-dark text-white font-black text-lg rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95 uppercase tracking-wider"
          >
            Submit & Grade
          </button>
        </div>
      )}

      {isSubmitted && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 mb-10 p-6 sm:p-10 bg-green-50 border-4 border-green-200 rounded-[2rem] shadow-lg relative overflow-hidden">
          <div className="absolute top-10 right-10 p-4 opacity-10"><Award size={150} className="text-green-500" /></div>
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="flex-1 text-center md:text-left">
              <h4 className="text-xl sm:text-2xl font-black text-green-800 mb-2 uppercase tracking-wide">Your Result</h4>
              
              <div className="flex items-start gap-3 p-4 bg-white rounded-xl border border-green-100 mt-4 shadow-sm inline-flex text-left">
                <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center shrink-0 border-2 border-pink-200 text-2xl">
                  👩‍🏫
                </div>
                <div>
                  <h4 className="font-black text-pink-700 text-sm mb-1">Feedback from Cô Yến:</h4>
                  <p className="text-slate-700 font-medium text-sm leading-relaxed">
                    {getMsYenFeedback(score)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-3xl shadow-md border-2 border-green-100 text-center min-w-[200px]">
              <p className="text-gray-500 font-bold mb-1 uppercase tracking-widest text-xs">Total Score</p>
              <div className="text-6xl font-black text-green-500 drop-shadow-sm">{score} <span className="text-3xl text-gray-300">/10</span></div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
