"use client";

import { X } from "lucide-react";
import { AppOverlayPortal } from "./AppOverlayPortal";
import { useHydrated } from "@/hooks/useHydrated";

interface ResponsiveDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  centered?: boolean;
  zIndex?: number;
}

export function ResponsiveDetailDrawer({ isOpen, onClose, title, children, centered = false, zIndex = 1010 }: ResponsiveDetailDrawerProps) {
  const mounted = useHydrated();

  if (!isOpen || !mounted) return null;

  return (
    <AppOverlayPortal>
      <div className="fixed inset-0" style={{ zIndex }}>
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/35 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onClose}
        />

        {/* Drawer / Modal Container */}
        <div className="relative h-full w-full flex items-center justify-center p-0 sm:p-3">
          <div
            className={`
              flex flex-col bg-white shadow-2xl
              fixed inset-0 h-[100dvh] w-screen overflow-y-auto
              sm:inset-auto sm:relative
              sm:w-full sm:md:w-[92vw] sm:lg:max-w-6xl
              sm:h-auto sm:max-h-[92dvh]
              sm:rounded-2xl
              animate-in zoom-in-95 duration-200
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
        </div>
      </div>
    </AppOverlayPortal>
  );
}
