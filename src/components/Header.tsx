import React from 'react';
import { CheckCircle, Zap } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  apiKey: string;
  onOpenApiKeyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ apiKey, onOpenApiKeyModal }) => (
  <header className="bg-brand-blue border-b border-brand-blue-dark sticky top-0 z-50 shadow-lg overflow-hidden">
    <div className="max-w-7xl mx-auto px-3 sm:px-4 h-24 sm:h-32 flex items-center justify-between relative">
      
      {/* Centered Logo, Title, and Slogan Block (Shifted slightly left for balance) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-3 sm:gap-6 w-full pl-4 pr-12 sm:pl-16 sm:pr-48 z-10">
        <BrandLogo className="w-32 sm:w-56 h-auto shrink-0 shadow-md bg-white p-1 sm:p-2 rounded-xl" />
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-base sm:text-3xl md:text-4xl font-black tracking-tight text-brand-gold uppercase drop-shadow-md leading-tight text-center">
            Open Minds English Centre
          </h1>
          <p className="text-xs sm:text-2xl md:text-3xl font-bold italic text-white uppercase tracking-widest drop-shadow-md mt-1 sm:mt-2 text-center">
            Learn English to go further
          </p>
        </div>
      </div>
      
      {/* API Key button - Absolute positioned to the top right */}
      <div className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20">
        <button 
          onClick={onOpenApiKeyModal}
          className="flex flex-col items-end group"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition-all border border-white/20">
            <Zap size={14} className="text-brand-gold sm:w-4 sm:h-4" />
            <span className="hidden sm:inline text-xs sm:text-sm font-black text-white whitespace-nowrap">API Key Settings</span>
            <span className="sm:hidden text-[10px] font-black text-white whitespace-nowrap">API Key</span>
          </div>
          {!apiKey && (
            <span className="text-[9px] sm:text-[10px] font-bold text-red-600 mt-1 animate-pulse bg-white/90 px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
              Get API key
            </span>
          )}
        </button>
      </div>
      
    </div>
  </header>
);

