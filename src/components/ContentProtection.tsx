import React, { useEffect, useState } from 'react';
import { AlertTriangle, EyeOff } from 'lucide-react';

export const ContentProtection: React.FC = () => {
  const [isBlurred, setIsBlurred] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // 1. Prevent Right Click
    const handleContextMenu = (e: MouseEvent) => {
      // Allow context menu on inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      e.preventDefault();
    };

    // 2. Prevent Copy/Cut
    const handleCopyCut = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      e.preventDefault();
    };

    // 3. Prevent Dragging Images
    const handleDragStart = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement || e.target instanceof HTMLAudioElement || e.target instanceof HTMLVideoElement) {
        e.preventDefault();
      }
    };

    // 4. Prevent specific keyboard shortcuts (Ctrl+C, Ctrl+S, Ctrl+P, Mac equivalents)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Still prevent Print and Save even in inputs
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
          e.preventDefault();
        }
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'c' || e.key === 's' || e.key === 'p' || e.key === 'x' || e.key === 'a' || e.key === 'u' || e.key === 'i')
      ) {
        e.preventDefault();
      }
    };

    // 5. Blur content on tab switch / minimize
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
        setViolationCount(prev => prev + 1);
        setShowWarning(true);
      } else {
        setIsBlurred(false);
      }
    };

    const handleWindowBlur = () => {
      setIsBlurred(true);
      setViolationCount(prev => prev + 1);
      setShowWarning(true);
    };

    const handleWindowFocus = () => {
      setIsBlurred(false);
    };

    // Add global CSS to prevent selection and printing
    const style = document.createElement('style');
    style.innerHTML = `
      body {
        -webkit-user-select: none !important; /* Safari */
        -ms-user-select: none !important; /* IE 10 and IE 11 */
        user-select: none !important; /* Standard syntax */
      }
      input, textarea {
        -webkit-user-select: auto !important;
        -ms-user-select: auto !important;
        user-select: auto !important;
      }
      @media print {
        body {
          display: none !important;
        }
      }
      img, audio, video {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyCut);
    document.addEventListener('cut', handleCopyCut);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.head.removeChild(style);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyCut);
      document.removeEventListener('cut', handleCopyCut);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (showWarning && !isBlurred) {
      const timer = setTimeout(() => {
        setShowWarning(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showWarning, isBlurred]);

  if (!isBlurred && !showWarning) return null;

  return (
    <>
      {isBlurred && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <EyeOff size={80} className="text-blue-400 mb-6 animate-pulse" />
          <h2 className="text-3xl font-black text-white mb-4">Nội dung đang được bảo vệ</h2>
          <p className="text-blue-200 text-lg max-w-md">
            Hệ thống phát hiện bạn đã chuyển tab hoặc thu nhỏ màn hình. Vui lòng quay lại ứng dụng để tiếp tục học.
          </p>
        </div>
      )}
      
      {!isBlurred && showWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-lg shadow-xl flex items-center gap-3 animate-in slide-in-from-top fade-in duration-300">
          <AlertTriangle className="text-yellow-600 shrink-0" size={24} />
          <div>
            <p className="font-bold text-sm">Cảnh báo vi phạm ({violationCount})</p>
            <p className="text-xs mt-0.5">Bạn đã rời khỏi trang web lúc đang học. Vui lòng tập trung!</p>
          </div>
        </div>
      )}
    </>
  );
};
