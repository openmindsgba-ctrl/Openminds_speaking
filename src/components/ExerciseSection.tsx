import React, { useState } from 'react';
import { ExerciseData, WrittenQuestion, QuestionType } from '../types';
import { CheckCircle, X, Award, FileText, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface ExerciseSectionProps {
  exerciseData: ExerciseData;
  onComplete: (score: number) => void;
  savedScore?: number | null;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  fill_blank: "Part 1: Fill in the blank",
  rearrange: "Part 2: Rearrange words into a complete sentence",
  find_mistake: "Part 3: Find and correct the mistakes",
  complete_sentence: "Part 4: Complete the sentence using the given words"
};

export const ExerciseSection: React.FC<ExerciseSectionProps> = ({ exerciseData, onComplete, savedScore }) => {
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const questions = exerciseData.questions || [];

  const handleInputChange = (id: string, value: string) => {
    setUserInputs(prev => ({ ...prev, [id]: value }));
  };

  const calculateScore = () => {
    let correctCount = 0;
    questions.forEach(q => {
      const userAns = (userInputs[q.id] || "").trim().toLowerCase();
      const expected = (q.expectedAnswer || "").trim().toLowerCase();
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
                  const userAns = (userInputs[q.id] || "").trim();
                  const expected = (q.expectedAnswer || "").trim();
                  const isCorrect = userAns.toLowerCase() === expected.toLowerCase();

                  return (
                    <div key={q.id || idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex gap-3 mb-3">
                        <span className="font-bold text-slate-400 shrink-0">Question {idx + 1}.</span>
                        <p className="font-medium text-slate-800 text-lg leading-relaxed">{q.questionText || ""}</p>
                      </div>
                      <div className="ml-10 relative">
                        <input
                          type="text"
                          value={userInputs[q.id] || ""}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          disabled={isSubmitted}
                          placeholder="Enter your answer..."
                          className={`w-full p-3 rounded-xl border-2 transition-colors ${
                            isSubmitted 
                              ? isCorrect 
                                ? 'border-green-500 bg-green-50 text-green-800' 
                                : 'border-red-400 bg-red-50 text-red-800'
                              : 'border-slate-300 focus:border-brand-blue bg-white'
                          }`}
                        />
                        {isSubmitted && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {isCorrect ? <CheckCircle className="text-green-500" /> : <X className="text-red-500" />}
                          </div>
                        )}
                      </div>

                      {isSubmitted && !isCorrect && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="ml-10 mt-3 p-4 bg-white border border-red-200 rounded-xl shadow-sm">
                          <p className="text-sm font-bold text-green-700 mb-1">✅ Correct Answer:</p>
                          <p className="text-base font-bold text-slate-800 mb-3">{q.expectedAnswer || "No answer provided"}</p>
                          
                          <div className="flex gap-2 items-start mt-3 pt-3 border-t border-slate-100">
                            <Info size={16} className="text-brand-blue shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-600 italic">
                              <strong>Explanation:</strong> {q.explanation || "No explanation provided"}
                            </p>
                          </div>
                        </motion.div>
                      )}
                      
                      {isSubmitted && isCorrect && (
                         <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="ml-10 mt-3">
                            <div className="flex gap-2 items-start p-3 bg-green-50 rounded-lg border border-green-100">
                              <Info size={16} className="text-green-600 shrink-0 mt-0.5" />
                              <p className="text-sm text-green-800 italic">
                                <strong>Explanation:</strong> {q.explanation || "No explanation provided"}
                              </p>
                            </div>
                         </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

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
