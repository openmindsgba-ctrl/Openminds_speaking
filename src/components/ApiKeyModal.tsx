import React, { useState, useEffect } from 'react';
import { Settings, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ApiKeyModalProps {
  show: boolean;
  currentApiKey: string;
  onSave: (key: string) => void;
  onClose: () => void;
  hasEnvKey?: boolean;
}

const MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', isFast: true, isDefault: true },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', isFast: false, isDefault: false },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', isFast: false, isDefault: false },
];

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ show, currentApiKey, onSave, onClose, hasEnvKey }) => {
  const [localKey, setLocalKey] = useState(currentApiKey);
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');

  useEffect(() => {
    if (show) {
      setLocalKey(currentApiKey);
      const savedModel = localStorage.getItem('GEMINI_MODEL');
      if (savedModel) {
        setSelectedModel(savedModel);
      }
    }
  }, [show, currentApiKey]);

  const handleSave = () => {
    const trimmedKey = localKey.trim();
    if (!trimmedKey) return;
    
    // Save model to local storage
    localStorage.setItem('GEMINI_MODEL', selectedModel);
    
    onSave(trimmedKey);
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-[1.5rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#1e3a8a] text-white p-5 sm:p-6 pb-6 pt-7">
              <div className="flex items-start gap-4">
                <div className="bg-white/20 p-3 rounded-2xl shrink-0 backdrop-blur-md shadow-inner">
                  <Settings size={28} className="text-white opacity-90" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-[22px] font-black tracking-tight leading-tight mb-1 font-serif">API Key Settings</h2>
                  <p className="text-blue-100 text-sm font-bold opacity-90">Configure Gemini Model & API Key</p>
                </div>
              </div>
            </div>
            
            {/* Body */}
            <div className="p-6 sm:p-7 bg-white">
              <div className="space-y-6">
                
                {/* API Key Section */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex flex-wrap items-center gap-2">
                    <span>🔑 API Key</span>
                    <span className="text-red-500 text-xs font-black">*Required</span>
                  </label>
                  <input 
                    type="password"
                    placeholder="Paste your API Key here (AIza...)"
                    value={localKey}
                    onChange={(e) => setLocalKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono font-bold text-black text-lg shadow-sm"
                  />
                  <a 
                    href="https://aistudio.google.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-600 font-bold text-sm decoration-2 hover:underline underline-offset-4 transition-all pt-1"
                  >
                    🔗 Get a free API Key at Google AI Studio <ExternalLink size={14} className="opacity-70" />
                  </a>
                </div>

                {/* Model Selection Section */}
                <div className="space-y-3 pt-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                    🤖 Select AI Model
                  </label>
                  
                  <div className="space-y-2.5">
                    {MODELS.map((model) => {
                      const isSelected = selectedModel === model.id;
                      return (
                        <div 
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                          className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50/30 shadow-sm' 
                              : 'border-slate-100 bg-white hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-blue-500' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                            </div>
                            <div className="font-bold text-slate-800 text-[15px] flex flex-wrap items-center gap-1.5">
                              {model.name}
                              {model.isFast && <span className="text-orange-500">⚡</span>}
                              <span className="text-slate-400 font-normal text-xs ml-1">({model.id})</span>
                            </div>
                          </div>
                          {model.isDefault && (
                            <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-1 rounded-md uppercase tracking-wider">
                              Default
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <button
                    onClick={handleSave}
                    disabled={!localKey.trim()}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/20 transition-all active:scale-[0.98] mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Start Learning Now!
                  </button>
                  
                  {(currentApiKey || hasEnvKey) && (
                    <button 
                      onClick={onClose}
                      className="w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors rounded-xl hover:bg-slate-50"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
