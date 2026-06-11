"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface ResponsiveDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  centered?: boolean;
}

export function ResponsiveDetailDrawer({ isOpen, onClose, title, children, centered = false }: ResponsiveDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[2500] flex ${centered ? "items-center justify-center p-4 md:p-8" : "items-end md:items-stretch justify-end"}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer / Modal */}
      <div
        className={`relative bg-white w-full flex flex-col shadow-2xl
          ${centered
            ? "max-w-4xl max-h-full rounded-3xl animate-in zoom-in-95 duration-200 overflow-hidden"
            : "md:w-[600px] lg:w-[800px] h-[90vh] rounded-t-3xl mt-auto md:mt-0 md:h-full md:rounded-none animate-in slide-in-from-bottom-full md:slide-in-from-right-full duration-300"
          }
        `}
      >
        {/* Pull Handle for mobile */}
        <div className="w-full flex justify-center pt-3 pb-1 md:hidden absolute top-0 left-0">
          <div className="w-12 h-1.5 bg-neutral-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between p-4 md:p-6 pt-8 md:pt-6 border-b border-neutral-gray-100 bg-bg-app-soft shrink-0 ${centered ? "rounded-t-3xl" : "rounded-t-3xl md:rounded-none"}`}>
          <h2 className="text-lg md:text-xl font-bold text-navy-900 truncate pr-4">{title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border border-neutral-gray-200 flex items-center justify-center text-text-muted hover:text-navy-900 hover:border-navy-900 transition-colors shrink-0 shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(1.5rem+var(--safe-area-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
