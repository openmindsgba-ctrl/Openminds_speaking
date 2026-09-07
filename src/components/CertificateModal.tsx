import React, { useRef } from 'react';
import { X, Download, RefreshCw, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { EvaluationResult, EnglishLevel } from '../types';

interface CertificateModalProps {
  show: boolean;
  onClose: () => void;
  evaluation: EvaluationResult | null;
  comprehensionScore: number | null;
  reading2Score: number | null;
  exerciseScore: number | null;
  writingScore: number | null;
  studentName: string;
  teacherName: string;
  generatedTopicName: string | null;
  topic: string;
  level: EnglishLevel;
  isDownloading: boolean;
  setIsDownloading: (d: boolean) => void;
  setError: (err: string | null) => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  show, onClose, evaluation, comprehensionScore, reading2Score, exerciseScore, writingScore,
  studentName, teacherName, generatedTopicName, topic, level, isDownloading, setIsDownloading, setError
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);

  const scores = [
    evaluation?.score,
    reading2Score,
    comprehensionScore,
    exerciseScore,
    writingScore
  ].filter((s): s is number => s != null);

  const overallAverage = scores.length > 0 
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 
    : 0;

  const downloadCertificate = async () => {
    if (!certificateRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(certificateRef.current, {
        useCORS: true, allowTaint: true, scale: 2,
        backgroundColor: '#ffffff', logging: true, imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const container = clonedDoc.querySelector('[data-certificate-container]') as HTMLElement;
          if (container) { container.style.backgroundImage = 'none'; container.style.boxShadow = 'none'; container.style.transform = 'none'; }
          const blurredElements = clonedDoc.querySelectorAll('.backdrop-blur-sm, .backdrop-blur-md, .backdrop-blur-lg');
          blurredElements.forEach((el: any) => { el.style.backdropFilter = 'none'; });
        },
        ignoreElements: (element) => element.hasAttribute('data-html2canvas-ignore'),
      });
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.style.display = 'none'; link.href = dataUrl;
      link.download = `Certificate_${studentName.replace(/\s+/g, '_') || 'Student'}.png`;
      document.body.appendChild(link); link.click();
      setTimeout(() => { if (link.parentNode) document.body.removeChild(link); }, 500);
    } catch (err) {
      console.error("Failed to download certificate", err);
      setError("Unable to download certificate. Please try again or take a screenshot.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors z-10">
              <X size={20} />
            </button>

            <div className="p-4 sm:p-8 overflow-auto max-h-[80vh]">
              <div 
                ref={certificateRef} data-certificate-container
                className="relative w-full bg-white p-6 sm:p-12 flex flex-col items-center justify-between text-center font-serif min-h-[700px]"
                style={{ border: '16px double #1D4ED8', backgroundImage: 'radial-gradient(circle at 2px 2px, #FEF2F2 1px, transparent 0)', backgroundSize: '32px 32px', backgroundColor: '#ffffff' }}
              >
                {/* Corners */}
                <div className="absolute top-4 left-4 w-16 sm:w-20 h-16 sm:h-20 rounded-tl-lg" style={{ borderTop: '8px solid #EF4444', borderLeft: '8px solid #EF4444' }} />
                <div className="absolute top-4 right-4 w-16 sm:w-20 h-16 sm:h-20 rounded-tr-lg" style={{ borderTop: '8px solid #EF4444', borderRight: '8px solid #EF4444' }} />
                <div className="absolute bottom-4 left-4 w-16 sm:w-20 h-16 sm:h-20 rounded-bl-lg" style={{ borderBottom: '8px solid #EF4444', borderLeft: '8px solid #EF4444' }} />
                <div className="absolute bottom-4 right-4 w-16 sm:w-20 h-16 sm:h-20 rounded-br-lg" style={{ borderBottom: '8px solid #EF4444', borderRight: '8px solid #EF4444' }} />

                <div className="space-y-4 mb-4">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #1E3A8A, #1D4ED8)', border: '4px solid #ffffff', color: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                      <Trophy size={40} style={{ color: '#ffffff' }} />
                    </div>
                  </div>
                  <h1 className="text-xl sm:text-3xl font-black uppercase tracking-widest" style={{ color: '#1E3A8A', textShadow: '2px 2px 0 rgba(127,29,29,0.1)' }}>Certificate of Excellence</h1>
                  <p className="text-sm sm:text-lg italic font-medium" style={{ color: '#1D4ED8' }}>This award is proudly presented to</p>
                </div>

                <div className="space-y-4 mb-6">
                  <h2 className="text-2xl sm:text-5xl font-black pb-2 min-w-[200px] sm:min-w-[400px] font-serif italic" style={{ color: '#1E3A8A', borderBottom: '4px solid #FECACA' }}>
                    {studentName || "Little Star"}
                  </h2>
                  <div className="space-y-1">
                    <p className="text-sm sm:text-lg font-medium" style={{ color: '#4B5563' }}>For outstanding performance in English</p>
                    <p className="text-xs sm:text-base font-bold italic" style={{ color: '#6B7280' }}>Topic: {generatedTopicName || topic || "General English"}</p>
                  </div>
                  <div className="inline-block px-4 sm:px-6 py-1 rounded-full text-base sm:text-xl font-black uppercase tracking-widest" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '2px solid #FECACA' }}>
                    Level: {level}
                  </div>
                </div>

                {/* Main Overall Score */}
                <div className="w-full flex justify-center mb-8">
                  <div className="px-8 sm:px-12 py-4 sm:py-6 rounded-[2rem]" style={{ background: 'linear-gradient(to bottom right, #1E3A8A, #1e40af)', border: '4px solid #ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
                    <p className="text-[10px] sm:text-sm uppercase font-black tracking-[0.2em] mb-2" style={{ color: '#bfdbfe' }}>Overall Average Score</p>
                    <p className="text-4xl sm:text-6xl font-black text-white">{overallAverage}<span className="text-xl sm:text-2xl text-blue-300">/10</span></p>
                  </div>
                </div>

                {/* Sub Scores Grid */}
                <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 justify-center items-stretch mb-8 px-4">
                  {evaluation?.score != null && (
                    <div className="p-3 bg-red-50 rounded-xl border-2 border-red-100 flex flex-col justify-center items-center">
                      <p className="text-[9px] sm:text-[10px] uppercase font-bold text-red-600 tracking-wider mb-1 text-center">Speaking</p>
                      <p className="text-xl sm:text-2xl font-black text-red-700">{evaluation.score}</p>
                    </div>
                  )}
                  {reading2Score != null && (
                    <div className="p-3 bg-blue-50 rounded-xl border-2 border-blue-100 flex flex-col justify-center items-center">
                      <p className="text-[9px] sm:text-[10px] uppercase font-bold text-blue-600 tracking-wider mb-1 text-center">Fill Blanks</p>
                      <p className="text-xl sm:text-2xl font-black text-blue-700">{reading2Score}</p>
                    </div>
                  )}
                  {comprehensionScore != null && (
                    <div className="p-3 bg-green-50 rounded-xl border-2 border-green-100 flex flex-col justify-center items-center">
                      <p className="text-[9px] sm:text-[10px] uppercase font-bold text-green-600 tracking-wider mb-1 text-center">Comprehension</p>
                      <p className="text-xl sm:text-2xl font-black text-green-700">{comprehensionScore}</p>
                    </div>
                  )}
                  {exerciseScore != null && (
                    <div className="p-3 bg-purple-50 rounded-xl border-2 border-purple-100 flex flex-col justify-center items-center">
                      <p className="text-[9px] sm:text-[10px] uppercase font-bold text-purple-600 tracking-wider mb-1 text-center">Exercises</p>
                      <p className="text-xl sm:text-2xl font-black text-purple-700">{exerciseScore}</p>
                    </div>
                  )}
                  {writingScore != null && (
                    <div className="p-3 bg-teal-50 rounded-xl border-2 border-teal-100 flex flex-col justify-center items-center">
                      <p className="text-[9px] sm:text-[10px] uppercase font-bold text-teal-600 tracking-wider mb-1 text-center">Writing</p>
                      <p className="text-xl sm:text-2xl font-black text-teal-700">{writingScore}</p>
                    </div>
                  )}
                </div>

                <div className="w-full flex justify-between items-end pt-4 sm:pt-6 px-4 sm:px-8 mt-auto">
                  <div className="text-left space-y-2">
                    <p className="text-xs sm:text-sm font-black" style={{ color: '#1E3A8A' }}>{new Date().toLocaleDateString('en-US')}</p>
                    <div className="w-24 sm:w-40" style={{ borderBottom: '2px solid #FECACA' }} />
                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest" style={{ color: '#1D4ED8' }}>Date of Issue</p>
                  </div>
                  <div className="text-right space-y-2">
                    <p className="text-base sm:text-xl font-black font-serif italic" style={{ color: '#1E3A8A' }}>{teacherName}</p>
                    <div className="w-24 sm:w-40" style={{ borderBottom: '2px solid #FECACA' }} />
                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest" style={{ color: '#1D4ED8' }}>Head Teacher</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 flex gap-4">
              <button onClick={onClose} className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-colors">Close</button>
              <button onClick={downloadCertificate} disabled={isDownloading}
                className="flex-[2] py-3 bg-brand-blue text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-800 transition-colors shadow-lg disabled:opacity-50"
              >
                {isDownloading ? <RefreshCw size={20} className="animate-spin" /> : <Download size={20} />}
                Download Certificate (PNG)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
