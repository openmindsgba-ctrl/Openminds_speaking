import React, { useState } from 'react';
import { HomeworkData } from '../types';
import { CheckCircle, XCircle, RefreshCw, Pen, BookOpen, Target, Search, MessageSquare } from 'lucide-react';

interface HomeworkSectionProps {
  data: HomeworkData;
}

export const HomeworkSection: React.FC<HomeworkSectionProps> = ({ data }) => {
  const [showAnswers, setShowAnswers] = useState(false);
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});

  const handleInputChange = (key: string, value: string) => {
    setUserInputs(prev => ({ ...prev, [key]: value }));
  };

  const isCorrect = (key: string, correctAnswer: string) => {
    const userAns = userInputs[key]?.trim().toLowerCase() || "";
    const correct = correctAnswer.trim().toLowerCase();
    return userAns === correct;
  };

  if (!data) return null;

  return (
    <div className="mt-8 space-y-6 bg-slate-50 p-4 sm:p-6 rounded-2xl border-2 border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-xl font-black text-indigo-800 flex items-center gap-2">
          <BookOpen size={24} className="text-indigo-600" />
          Homework
        </h3>
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            showAnswers 
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
          }`}
        >
          {showAnswers ? 'Hide answers' : 'Check answers'}
        </button>
      </div>

      {/* Matching */}
      {data.matching && data.matching.items && data.matching.items.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Target size={18} className="text-pink-500" />
            1. Match the words with their meanings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              {data.matching.items.map((item, idx) => (
                <div key={`term-${idx}`} className="p-3 bg-pink-50 rounded-lg border border-pink-100 text-pink-900 font-bold text-sm">
                  {idx + 1}. {item.term}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {data.matching.items.map((item, idx) => (
                <div key={`def-${idx}`} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter #"
                    value={userInputs[`match-${idx}`] || ''}
                    onChange={(e) => handleInputChange(`match-${idx}`, e.target.value)}
                    className="w-16 text-center border-2 border-slate-200 rounded-lg focus:border-indigo-500 outline-none font-bold"
                  />
                  <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-sm">
                    {item.definition}
                  </div>
                  {showAnswers && (
                    <div className="flex items-center justify-center w-8">
                      {isCorrect(`match-${idx}`, String(idx + 1)) ? (
                        <CheckCircle size={20} className="text-green-500" />
                      ) : (
                        <div className="text-xs font-black text-rose-500 flex flex-col items-center">
                          <XCircle size={16} />
                          <span>{idx + 1}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fill in the Blanks */}
      {data.fillBlanks && data.fillBlanks.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Pen size={18} className="text-blue-500" />
            2. Fill in the missing words
          </h4>
          <div className="space-y-4">
            {data.fillBlanks.map((q, idx) => (
              <div key={`fill-${idx}`} className="space-y-2">
                <div className="text-sm font-medium text-slate-800 leading-relaxed flex flex-wrap items-center gap-2">
                  <span className="font-black text-blue-600 mr-1">{idx + 1}.</span>
                  {q.sentence.split('___').map((part, pIdx, arr) => (
                    <React.Fragment key={pIdx}>
                      <span>{part}</span>
                      {pIdx < arr.length - 1 && (
                        <div className="inline-flex items-center gap-2 mx-1 relative">
                          <input
                            type="text"
                            value={userInputs[`fill-${idx}`] || ''}
                            onChange={(e) => handleInputChange(`fill-${idx}`, e.target.value)}
                            className="w-32 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center font-bold text-blue-700 bg-blue-50/50"
                          />
                          {showAnswers && (
                            <span className="absolute -right-6 top-1/2 -translate-y-1/2">
                              {isCorrect(`fill-${idx}`, q.answer) ? (
                                <CheckCircle size={16} className="text-green-500" />
                              ) : (
                                <XCircle size={16} className="text-rose-500" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                {q.options && q.options.length > 0 && (
                  <div className="flex gap-2 flex-wrap ml-6">
                    {q.options.map((opt, optIdx) => (
                      <span key={optIdx} className="px-2 py-1 text-xs bg-slate-100 rounded text-slate-600 border border-slate-200">
                        {opt}
                      </span>
                    ))}
                  </div>
                )}
                {showAnswers && !isCorrect(`fill-${idx}`, q.answer) && (
                  <div className="ml-6 text-sm text-green-600 font-medium italic">
                    Answer: {q.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mistakes */}
      {data.mistakes && data.mistakes.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Search size={18} className="text-rose-500" />
            3. Find and correct mistakes
          </h4>
          <div className="space-y-4">
            {data.mistakes.map((q, idx) => (
              <div key={`mistake-${idx}`} className="bg-rose-50/30 p-3 rounded-lg border border-rose-100">
                <p className="text-sm font-medium text-slate-800 mb-2">
                  <span className="font-black text-rose-600 mr-2">{idx + 1}.</span>
                  {q.sentence}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 ml-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-16">Mistake:</span>
                    <input
                      type="text"
                      value={userInputs[`mistake-wrong-${idx}`] || ''}
                      onChange={(e) => handleInputChange(`mistake-wrong-${idx}`, e.target.value)}
                      className="flex-1 min-w-[100px] border-2 border-slate-200 rounded p-1 text-sm focus:border-rose-400 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-20">Correction:</span>
                    <input
                      type="text"
                      value={userInputs[`mistake-right-${idx}`] || ''}
                      onChange={(e) => handleInputChange(`mistake-right-${idx}`, e.target.value)}
                      className="flex-1 min-w-[100px] border-2 border-slate-200 rounded p-1 text-sm focus:border-green-400 outline-none"
                    />
                  </div>
                </div>
                {showAnswers && (
                  <div className="mt-2 ml-6 text-sm text-green-700 font-medium bg-green-50 p-2 rounded border border-green-100">
                    Answer: <span className="text-rose-600 line-through mr-2">{q.mistake}</span> {'->'} <span className="font-bold">{q.correction}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewrites */}
      {data.rewrites && data.rewrites.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <RefreshCw size={18} className="text-amber-500" />
            4. Rewrite the sentences
          </h4>
          <div className="space-y-4">
            {data.rewrites.map((q, idx) => (
              <div key={`rewrite-${idx}`} className="space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  <span className="font-black text-amber-600 mr-2">{idx + 1}.</span>
                  {q.originalSentence}
                </p>
                <div className="ml-6 relative">
                  <p className="text-xs text-slate-500 mb-1 italic">Hint: {q.hint}</p>
                  <textarea
                    value={userInputs[`rewrite-${idx}`] || ''}
                    onChange={(e) => handleInputChange(`rewrite-${idx}`, e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg p-2 text-sm focus:border-amber-400 outline-none min-h-[60px]"
                    placeholder="Rewrite the sentence here..."
                  />
                  {showAnswers && (
                    <div className="mt-2 text-sm text-green-700 font-medium bg-green-50 p-2 rounded border border-green-100">
                      Suggested Answer: <span className="font-bold">{q.answer}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Questions */}
      {data.questions && data.questions.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <MessageSquare size={18} className="text-purple-500" />
            5. Answer the questions
          </h4>
          <div className="space-y-4">
            {data.questions.map((q, idx) => (
              <div key={`question-${idx}`} className="space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  <span className="font-black text-purple-600 mr-2">{idx + 1}.</span>
                  {q.question}
                </p>
                <div className="ml-6 relative">
                  <textarea
                    value={userInputs[`question-${idx}`] || ''}
                    onChange={(e) => handleInputChange(`question-${idx}`, e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg p-2 text-sm focus:border-purple-400 outline-none min-h-[60px]"
                    placeholder="Your answer..."
                  />
                  {showAnswers && (
                    <div className="mt-2 text-sm text-green-700 font-medium bg-green-50 p-2 rounded border border-green-100">
                      Suggested Answer: <span className="font-bold">{q.suggestedAnswer}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Essay */}
      {data.essay && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <BookOpen size={18} className="text-teal-500" />
            6. Essay Writing
          </h4>
          <div className="space-y-3 ml-2">
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
              <h5 className="font-bold text-teal-800 text-sm mb-1">Topic:</h5>
              <p className="text-sm text-teal-900 font-medium">{data.essay.topic}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h5 className="font-bold text-slate-700 text-xs mb-1 uppercase tracking-wider">Guidance:</h5>
              <p className="text-sm text-slate-600 italic whitespace-pre-wrap">{data.essay.guidance}</p>
            </div>
            <textarea
              value={userInputs['essay'] || ''}
              onChange={(e) => handleInputChange('essay', e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm focus:border-teal-400 outline-none min-h-[150px]"
              placeholder="Start writing your essay here..."
            />
          </div>
        </div>
      )}
    </div>
  );
};
