'use client';
import { useEffect, useState } from 'react';
export interface ListenTastaturOptionen {
  /** Anzahl sichtbarer Handlungsbedarf-Einträge (Fokus zuerst) */ anzahl: number;
  /** nur Desktop und nur ohne offenen Dialog/Palette */ aktiv: boolean;
  /** Enter = Hauptaktion – exakt dieselbe Funktion wie der Klick (gleiche Rückfrage/Rückgängig) */ onHaupt: (index: number) => void;
  /** s = Später → öffnet Zeitwahl (V8 S1) */ onSpaeter: (index: number) => void;
}
/** V1.1 B4: j/k wählen · Enter · s · Esc. Nie in Eingabefeldern (input/textarea/select/contenteditable). Gibt den gewählten Index zurück (−1 = keiner). */
export function useListenTastatur({ anzahl, aktiv, onHaupt, onSpaeter }: ListenTastaturOptionen): number {
  const [sel, setSel] = useState(-1);
  useEffect(() => { if (sel >= anzahl) setSel(anzahl - 1); }, [anzahl, sel]);
  useEffect(() => {
    if (!aktiv) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target;
      if (e.ctrlKey || e.metaKey || e.altKey || (t instanceof Element && t.closest('input,textarea,select,[contenteditable="true"]'))) return;
      if (e.key === 'j') { e.preventDefault(); setSel(s => Math.min(anzahl - 1, s + 1)); }
      else if (e.key === 'k') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); onHaupt(sel); }
      else if ((e.key === 's' || e.key === 'S') && sel >= 0) { e.preventDefault(); onSpaeter(sel); }
      else if (e.key === 'Escape' && sel >= 0) setSel(-1);
    };
    addEventListener('keydown', h); return () => removeEventListener('keydown', h);
  }, [aktiv, anzahl, sel, onHaupt, onSpaeter]);
  return aktiv ? sel : -1;
}
