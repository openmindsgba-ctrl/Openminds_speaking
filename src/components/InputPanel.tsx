import React from 'react';
import { 
  Type, Image as ImageIcon, FileText, Upload, RefreshCw, X, 
  GraduationCap, Sparkles, AlertCircle 
} from 'lucide-react';
import { EnglishLevel, ContentMode } from '../types';

interface InputPanelProps {
  topic: string;
  setTopic: (topic: string) => void;
  grammarTopic: string;
  setGrammarTopic: (topic: string) => void;
  level: EnglishLevel;
  setLevel: (level: EnglishLevel) => void;
  contentMode: ContentMode;
  setContentMode: (mode: ContentMode) => void;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
  isGenerating: boolean;
  isProcessingFile: boolean;
  isDragging: boolean;
  error: string | null;
  onGenerate: () => void;
  onRetry: () => void;
  onOpenApiKeyModal: () => void;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  docFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  processFile: (file: File) => Promise<void>;
}

const LEVELS: EnglishLevel[] = ["Starters", "Movers", "Flyers", "A1", "A2", "B1", "B2"];

export const InputPanel: React.FC<InputPanelProps> = (props) => {
  const {
    topic, setTopic, grammarTopic, setGrammarTopic, level, setLevel, contentMode,
    imagePreview, setImagePreview,
    isGenerating, isProcessingFile, isDragging, error,
    onGenerate, onRetry, onOpenApiKeyModal,
    imageInputRef, docFileInputRef, handleImageUpload, 
    handleDragOver, handleDragLeave, handleDrop, handlePaste, processFile
  } = props;

  const isQuotaOrKeyError = error?.includes('Quota') || error?.includes('API Key');

  return (
    <div className="lg:col-span-4 space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-[2rem] shadow-xl border-4 border-blue-100 space-y-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full opacity-40 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-50 rounded-full opacity-40 blur-2xl" />
        
        <div className="relative z-10 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-black text-brand-blue mb-3 uppercase tracking-wider">
              {contentMode === "generate" && <><Type size={18} className="text-brand-blue" /> Topic and Grammar</>}
              {contentMode === "image" && <><ImageIcon size={18} className="text-brand-blue" /> Upload Image</>}
              {contentMode === "useInput" && <><FileText size={18} className="text-brand-blue" /> Reading Text</>}
            </label>

            {contentMode === "image" ? (
              <ImageUploadArea 
                imagePreview={imagePreview} isDragging={isDragging}
                imageInputRef={imageInputRef} handleImageUpload={handleImageUpload}
                handleDragOver={handleDragOver} handleDragLeave={handleDragLeave} handleDrop={handleDrop}
              />
            ) : (
              <TextInputArea
                topic={topic} setTopic={setTopic} 
                grammarTopic={grammarTopic} setGrammarTopic={setGrammarTopic}
                contentMode={contentMode}
                isDragging={isDragging} isProcessingFile={isProcessingFile}
                handleDragOver={handleDragOver} handleDragLeave={handleDragLeave}
                handleDrop={handleDrop} handlePaste={handlePaste}
              />
            )}

            {imagePreview && contentMode !== "image" && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-blue-100/50 rounded-xl border border-red-200">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-red-200">
                  <img src={imagePreview} alt="Small preview" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-black text-blue-800 uppercase truncate">Image is ready</span>
                <button onClick={() => setImagePreview(null)} className="ml-auto p-1.5 text-blue-600 hover:text-blue-500 hover:bg-white rounded-lg transition-all">
                  <X size={14} />
                </button>
              </div>
            )}
            {contentMode === "useInput" && (
              <div className="mt-2 flex justify-end">
                <button onClick={() => docFileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-[10px] font-black hover:bg-red-200 transition-colors uppercase tracking-wider">
                  <FileText size={14} /> Upload File (PDF, DOCX, TXT, Image)
                </button>
                <input type="file" ref={docFileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} accept=".pdf,.docx,.txt,image/*" className="hidden" />
              </div>
            )}
          </div>

          {/* Level Selector */}
          <div>
            <label className="flex items-center gap-2 text-sm font-black text-brand-blue mb-3 uppercase tracking-wider">
              <GraduationCap size={18} className="text-blue-400" /> English Level
            </label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {LEVELS.map((lvl) => (
                <button key={lvl} onClick={() => setLevel(lvl)}
                  className={`px-1 py-2 rounded-xl text-[10px] font-black border-2 transition-all
                    ${level === lvl ? 'bg-brand-blue border-brand-blue-dark text-white shadow-[0_4px_0_#5c0a0a] -translate-y-1' : 'bg-white border-slate-200 text-slate-900 hover:border-blue-300 hover:bg-blue-50'}`}
                >{lvl}</button>
              ))}
            </div>
          </div>



          {/* Generate Button */}
          <button onClick={onGenerate} disabled={isGenerating}
            className={`w-full py-3.5 sm:py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-2 text-base sm:text-lg
              ${isGenerating ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-brand-blue hover:from-blue-700 hover:to-blue-900 active:scale-[0.98] shadow-blue-100'}`}
          >
            {isGenerating ? <><RefreshCw className="animate-spin" size={24} /> Preparing...</> : <><Sparkles size={24} className="animate-pulse" /> Start Learning Now!</>}
          </button>

          {/* Error with Retry */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-blue-100 rounded-2xl space-y-3">
              <div className="flex items-start gap-3 text-blue-700 text-sm font-medium">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="whitespace-pre-line">{error}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isQuotaOrKeyError && (
                  <button onClick={onOpenApiKeyModal} className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 hover:bg-red-200 text-blue-700 rounded-xl text-xs font-black transition-colors">
                    🔑 Change API Key
                  </button>
                )}
                <button onClick={onRetry} className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 hover:bg-red-200 text-blue-700 rounded-xl text-xs font-black transition-colors">
                  🔄 Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// Sub-components
const ImageUploadArea: React.FC<any> = ({ imagePreview, isDragging, imageInputRef, handleImageUpload, handleDragOver, handleDragLeave, handleDrop }) => (
  <div onClick={() => imageInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
    className={`relative w-full aspect-video rounded-2xl border-4 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden
      ${isDragging ? 'border-brand-blue bg-blue-50/50' : 'border-blue-100 bg-blue-50/30 hover:border-blue-300 hover:bg-blue-50'}`}
  >
    {imagePreview ? (
      <>
        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          <div className="bg-white p-3 rounded-full text-brand-blue shadow-xl"><RefreshCw size={24} /></div>
        </div>
      </>
    ) : (
      <>
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-blue-400 shadow-sm border border-blue-100"><Upload size={32} /></div>
        <div className="text-center">
          <p className="font-black text-blue-800 uppercase text-sm tracking-wide">Click to select image</p>
          <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">Or drag and drop image here</p>
        </div>
      </>
    )}
    <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
  </div>
);

const TextInputArea: React.FC<any> = ({ topic, setTopic, grammarTopic, setGrammarTopic, contentMode, isDragging, isProcessingFile, handleDragOver, handleDragLeave, handleDrop, handlePaste }) => (
  <div className={`relative transition-all duration-200 ${isDragging ? 'scale-[1.02]' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
    <textarea value={topic} onChange={(e) => setTopic(e.target.value)} onPaste={handlePaste}
      placeholder={contentMode === "generate" ? "Example: Park, Beach, Kids playing..." : "Paste your English text here, or drag and drop a PDF, DOCX, TXT, Image file here..."}
      className={`w-full h-36 sm:h-40 p-4 bg-blue-50/30 border-2 rounded-2xl focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all resize-none text-slate-900 placeholder:text-slate-400 font-semibold text-sm sm:text-base
        ${isDragging ? 'border-brand-blue bg-blue-50' : 'border-slate-100'}`}
    />
    {contentMode === "generate" && (
      <input type="text" value={grammarTopic} onChange={(e) => setGrammarTopic(e.target.value)}
        placeholder="Grammar topic (E.g.: Simple Present, Past Continuous...)"
        className={`w-full mt-3 p-3 bg-blue-50/30 border-2 rounded-2xl focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all text-slate-900 placeholder:text-slate-400 font-semibold text-sm sm:text-base border-slate-100`}
      />
    )}
    {isProcessingFile && (
      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center gap-2 text-blue-800 font-bold animate-pulse">
        <RefreshCw className="animate-spin" size={16} /> Processing file...
      </div>
    )}
    {isDragging && (
      <div className="absolute inset-0 border-4 border-dashed border-blue-400 bg-blue-50/30 rounded-2xl flex flex-col items-center justify-center gap-2 pointer-events-none">
        <Upload size={32} className="text-blue-600 animate-bounce" />
        <span className="font-black text-blue-700 uppercase">Drop file here</span>
      </div>
    )}
  </div>
);

