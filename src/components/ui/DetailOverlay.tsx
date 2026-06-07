// src/components/ui/DetailOverlay.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface DetailOverlayProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badgeContent?: React.ReactNode;
  children: React.ReactNode;
}

export function DetailOverlay({ open, onClose, title, subtitle, badgeContent, children }: DetailOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);

  // mount once on client
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ESC key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // swipe down to close (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startYRef.current !== null) {
      const delta = e.changedTouches[0].clientY - startYRef.current;
      if (delta > 50) {
        onClose();
      }
    }
    startYRef.current = null;
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-900/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={[
          "relative bg-bg-app w-full flex flex-col overflow-hidden shadow-2xl",
          // Mobile: bottom-sheet mit Swipe-Indikator, runde Ecken oben
          "rounded-t-2xl h-[95dvh]",
          // Desktop/Tablet: zentriertes Modal, alle Ecken rund, max-width
          "sm:rounded-2xl sm:max-w-[720px] sm:mx-4 sm:h-[92dvh]",
        ].join(" ")}
        ref={overlayRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe-Indikator (nur Mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-gray-100 bg-bg-app-soft shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            {badgeContent && <div className="mb-1">{badgeContent}</div>}
            {title && <h2 className="text-base font-black text-navy-900 truncate">{title}</h2>}
            {subtitle && <p className="text-xs text-text-muted font-medium mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-11 h-11 rounded-full bg-white border border-neutral-gray-200 flex items-center justify-center text-text-muted hover:text-navy-900 hover:border-navy-900 transition-colors"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content — einziger Scroll-Container, kein verschachteltes Scrollen */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
