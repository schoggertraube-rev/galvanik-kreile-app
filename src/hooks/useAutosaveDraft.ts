"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_KEY = "kreile_phone_note_session_draft_v2";
const SAVE_INTERVAL = 2_000;

export function useAutosaveDraft(text: string, setText: (text: string) => void) {
  const timerRef = useRef<number | null>(null);
  const hasLoaded = useRef(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    const timer = window.setTimeout(() => {
      try {
        const draft = window.sessionStorage.getItem(DRAFT_KEY);
        if (draft?.trim()) setText(draft);
      } catch (error) {
        console.error("Telefonnotiz-Sitzungsentwurf konnte nicht geladen werden", error);
        setDraftError("Sitzungsentwurf ist in diesem Browser nicht verfügbar.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setText]);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        if (text) window.sessionStorage.setItem(DRAFT_KEY, text);
        else window.sessionStorage.removeItem(DRAFT_KEY);
        setDraftError(null);
      } catch (error) {
        console.error("Telefonnotiz-Sitzungsentwurf konnte nicht gespeichert werden", error);
        setDraftError("Sitzungsentwurf konnte nicht gespeichert werden.");
      }
    }, SAVE_INTERVAL);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [text]);

  const clearDraft = useCallback(() => {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
      setDraftError(null);
    } catch (error) {
      console.error("Telefonnotiz-Sitzungsentwurf konnte nicht entfernt werden", error);
      setDraftError("Sitzungsentwurf konnte nicht entfernt werden.");
    }
  }, []);

  return { clearDraft, draftError };
}
