"use client";

import React, { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  fullOpenHref?: string;
}

export function PreviewDrawer({
  open,
  onClose,
  title,
  children,
  fullOpenHref,
}: PreviewDrawerProps) {
  const router = useRouter();

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Lock body scroll
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

  // Swipe gesture handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isRightSwipe) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-navy-900/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-50 h-full bg-white shadow-2xl flex flex-col"
            style={{ width: "100%", maxWidth: "400px", minWidth: "360px" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-gray-200 shrink-0">
              <h2 className="font-serif font-bold text-lg text-navy-900 truncate">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-full bg-neutral-gray-100 hover:bg-neutral-gray-200 text-navy-600 transition-colors"
                style={{ width: "44px", height: "44px", flexShrink: 0 }}
                aria-label="Schließen"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 text-sm text-text-muted">
              {children}
            </div>

            {/* Footer with Full Open CTA */}
            {fullOpenHref && (
              <div className="p-4 border-t border-neutral-gray-200 shrink-0 bg-neutral-gray-50">
                <button
                  onClick={() => {
                    onClose();
                    router.push(fullOpenHref);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
                  style={{ minHeight: "44px" }}
                >
                  Vollständig öffnen
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
