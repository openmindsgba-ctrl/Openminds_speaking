import React from 'react';
import { BrandLogo } from './BrandLogo';

export const Footer: React.FC = () => (
  <footer className="bg-brand-blue-dark text-white py-10 sm:py-16">
    <div className="max-w-6xl mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
        {/* Brand */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="inline-flex shrink-0">
            <BrandLogo className="w-16 h-16 sm:w-20 sm:h-20" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <h3 className="text-[16px] sm:text-[22px] font-black text-brand-gold uppercase tracking-tight whitespace-nowrap">Open Minds English Centre</h3>
            <p className="mt-1 text-slate-200 italic text-[11px] sm:text-[14px] font-black uppercase tracking-[0.15em]">
              Learn English to go further.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-6">
          <h4 className="text-brand-gold font-black uppercase tracking-[0.2em] relative inline-block">
            CONTACT
            <div className="absolute -bottom-2 left-0 w-full h-1 bg-white/10" />
          </h4>
          <ul className="space-y-4">
            <li className="flex items-start gap-3 group">
              <span className="text-brand-blue mt-1">📍</span>
              <div className="text-sm font-black group-hover:text-brand-gold transition-colors cursor-pointer space-y-1">
                <div>Headquarters: Area 6 Vo Lao, Dong Thanh Commune, Phu Tho Province.</div>
                <div>Campus 2: Area 4 Ninh Dan, Hoang Cuong Commune;</div>
                <div>Campus 3: No 35 Han Thuyen, Thanh Ba Commune, Phu Tho Province;</div>
                <div>Campus 4: Area 2 Dong Thanh Commune, Phu Tho Province.</div>
              </div>
            </li>
            <li className="flex items-start gap-3 group">
              <span className="text-brand-blue mt-1">📞</span>
              <span className="text-sm font-black group-hover:text-brand-gold transition-colors cursor-pointer">Hotline: 0988520508</span>
            </li>
            <li className="flex items-start gap-3 group">
              <span className="text-brand-blue mt-1">🌐</span>
              <div className="flex flex-col gap-1">
                <a href="https://www.facebook.com/doyenopenminds/" target="_blank" rel="noopener noreferrer" className="text-sm font-black group-hover:text-brand-gold transition-colors cursor-pointer underline decoration-1 underline-offset-2">
                  Facebook
                </a>
                <a href="https://www.facebook.com/TrungTamAnhNguOpenMinds/" target="_blank" rel="noopener noreferrer" className="text-sm font-black group-hover:text-brand-gold transition-colors cursor-pointer underline decoration-1 underline-offset-2">
                  Fanpage
                </a>
              </div>
            </li>
          </ul>
        </div>

        {/* Slogan */}
        <div className="space-y-6">
          <h4 className="text-brand-gold font-black uppercase tracking-[0.2em] relative inline-block">
            ABOUT OPEN MINDS ENGLISH CENTRE
            <div className="absolute -bottom-2 left-0 w-full h-1 bg-white/10" />
          </h4>
          <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Open Minds English Centre was founded with the mission to accompany students on their journey to master English, broaden their knowledge, and nurture their dreams and ambitions for the future.
            </p>
          </div>
        </div>
      </div>
    </div>
  </footer>
);

