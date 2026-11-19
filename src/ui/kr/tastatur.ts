'use client';
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/** U-240: Lesereihenfolge; die letzte Pflichtangabe nutzt dieselbe gegatete Hauptaktion wie der Klick. */
export function weiterMitEnter(event: ReactKeyboardEvent<HTMLDivElement>) {
  // Owner vorfinal: its two original input selectors share this existing entry.
  // No document listener or second keyboard pipeline is installed.
  if (document.documentElement.dataset.ui === 'v45' && event.key === 'Enter'
      && !event.defaultPrevented && event.target instanceof HTMLInputElement) {
    const target = event.target;
    let handled = false;
    if (target.matches('#ovBody input:not([type=range])')) {
      event.preventDefault(); handled = true;
      const fields = [...document.querySelectorAll<HTMLElement>('#ovBody input, #ovBody textarea, #ovBody .act:not(:disabled)')].filter(node => node.offsetParent);
      const index = fields.indexOf(target);
      (fields[index + 1] || fields[fields.length - 1])?.focus();
    }
    if (target.matches('.fgrid input')) {
      event.preventDefault(); handled = true;
      const fields = [...document.querySelectorAll<HTMLInputElement>('.fgrid input:not([disabled])')], index = fields.indexOf(target);
      if (index < fields.length - 1) fields[index + 1].focus();
      else {
        const primary = document.querySelector<HTMLButtonElement>('#kfGo') || document.querySelector<HTMLButtonElement>('#waGo');
        if (primary && !primary.disabled) primary.click();
      }
    }
    if (handled) return;
  }
  if (event.key !== 'Enter' || event.defaultPrevented || event.nativeEvent.isComposing
      || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
      || target.matches('[type=checkbox],[type=radio],[type=file],[type=submit],[type=button]')) return;
  const layer = target.closest<HTMLElement>('[role=dialog],dialog[open],[data-ebene]');
  const boundary = layer ?? target.form;
  if (!boundary) return;
  const layers = [...event.currentTarget.querySelectorAll('[role=dialog],dialog[open],[data-ebene]')];
  if (layer && layers.length && layers.at(-1) !== layer) return;
  const fields = [...boundary.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')]
    .filter(field => !field.disabled && !field.matches('[readonly],[type=hidden],[type=checkbox],[type=radio],[type=file],[type=submit],[type=button]')
      && field.getClientRects().length > 0 && getComputedStyle(field).visibility !== 'hidden');
  const index = fields.indexOf(target);
  if (index < 0) return;
  const lastRequired = fields.findLast(field => field.required || field.dataset.enterSubmit === 'true');
  const primary = boundary.querySelector<HTMLButtonElement>('.kr-dialog-fuss button.kr-btn--erledigen,.kr-dialog-fuss button.kr-btn--primaer');
  if (target === lastRequired || index === fields.length - 1) {
    if (primary && !primary.disabled) { event.preventDefault(); primary.click(); }
    return;
  }
  event.preventDefault();
  fields[index + 1].focus();
}
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
