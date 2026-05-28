"use client";

import { useEffect } from "react";
import { trackUiEvent } from "@/lib/tracking/tracking";

interface FocusOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  hasUnsavedChanges?: boolean;
  children: React.ReactNode;
}

export function FocusOverlay({ isOpen, onClose, hasUnsavedChanges = false, children }: FocusOverlayProps) {
  useEffect(() => {
    if (isOpen) {
      trackUiEvent("overlay_open");
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (hasUnsavedChanges) {
          if (window.confirm("Du hast ungespeicherte Änderungen. Möchtest du wirklich schließen?")) {
            trackUiEvent("overlay_close_esc");
            onClose();
          }
        } else {
          trackUiEvent("overlay_close_esc");
          onClose();
        }
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasUnsavedChanges, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (hasUnsavedChanges) {
        if (window.confirm("Du hast ungespeicherte Änderungen. Möchtest du wirklich schließen?")) {
          trackUiEvent("overlay_close_backdrop");
          onClose();
        }
      } else {
        trackUiEvent("overlay_close_backdrop");
        onClose();
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-navy-900/60 backdrop-blur-lg flex items-center justify-center p-4 sm:p-6 md:p-12 overflow-y-auto animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[50vh] max-h-full animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
