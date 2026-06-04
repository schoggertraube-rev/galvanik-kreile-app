"use client";
import { useEffect, useRef, useCallback } from "react";

const DRAFT_KEY = "kreile_phone_note_draft";
const SAVE_INTERVAL = 2000;

export function useAutosaveDraft(text: string, setText: (t: string) => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasLoaded = useRef(false);

  // Load draft on mount
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft && draft.trim()) {
        setText(draft);
      }
    } catch { /* ignore */ }
  }, [setText]);

  // Auto-save debounced
  useEffect(() => {
    if (!text) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, text);
      } catch { /* ignore */ }
    }, SAVE_INTERVAL);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, []);

  return { clearDraft };
}
