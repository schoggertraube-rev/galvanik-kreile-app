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
  const selection = anzahl > 0 ? Math.min(sel, anzahl - 1) : -1;
  useEffect(() => {
    if (!aktiv) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target;
      if (e.ctrlKey || e.metaKey || e.altKey || (t instanceof Element && t.closest('input,textarea,select,[contenteditable="true"]'))) return;
      if (e.key === 'j') { e.preventDefault(); setSel(anzahl > 0 ? Math.min(anzahl - 1, selection + 1) : -1); }
      else if (e.key === 'k') { e.preventDefault(); setSel(anzahl > 0 ? Math.max(0, selection - 1) : -1); }
      else if (e.key === 'Enter' && selection >= 0) { e.preventDefault(); onHaupt(selection); }
      else if ((e.key === 's' || e.key === 'S') && selection >= 0) { e.preventDefault(); onSpaeter(selection); }
      else if (e.key === 'Escape' && selection >= 0) setSel(-1);
    };
    addEventListener('keydown', h); return () => removeEventListener('keydown', h);
  }, [aktiv, anzahl, selection, onHaupt, onSpaeter]);
  return aktiv ? selection : -1;
}
