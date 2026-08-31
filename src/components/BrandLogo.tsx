import React from 'react';

export const BrandLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <img 
    src="https://i.postimg.cc/ht3M16P5/logo-ten.jpg" 
    alt="Open Minds English Centre" 
    className={`${className} object-contain`} 
  />
);
