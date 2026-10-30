'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { MitZustand } from './Zustand';
import type { DatenZustand, ZustandTexte } from './typen';
export interface SeitenblattProps {
  /** aria-label, z. B. „Auftragskarte A-2026-0101“ – sichtbare Überschrift bleibt der Kartentitel */ titel: string;
  onSchliessen: () => void;
  /** Backstack Auftrag ↔ Kunde: vorherige Karte (z. B. „Zurück · A-2026-0101“) */ zurueck?: { text: string; onClick: () => void };
  zustand?: DatenZustand; texte?: ZustandTexte;
  /** Inhalt = <Karte …> exakt wie V1 (Auftragskarte V8 / Kundenkarte V2): Reihenfolge und Blöcke unverändert */ children: ReactNode;
}
/** V1.1 B3: Karte als Seitenblatt – Desktop/Tablet von rechts, Handy von unten; Hintergrund bleibt sichtbar, Klick daneben schließt.
 *  „Fertig melden“ bleibt Dialog mit 3 Pflichtprüfungen (V5), danach Freeze – das Blatt verkürzt nichts. */
export function Seitenblatt({ titel, onSchliessen: sofort, zurueck, zustand = 'daten', texte, children }: SeitenblattProps) {
  const [zu, setZu] = useState(false);
  const onSchliessen = () => { if (zu) return; if (matchMedia('(prefers-reduced-motion:reduce)').matches) return sofort(); setZu(true); setTimeout(sofort, 200); };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onSchliessen(); }; addEventListener('keydown', h); return () => removeEventListener('keydown', h); });
  return (
    <div className={zu ? 'kr-ebene kr-ebene--blatt kr-ebene--zu' : 'kr-ebene kr-ebene--blatt'} onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <section className="kr-dialog kr-dialog--karte" role="dialog" aria-modal="true" aria-label={titel}>
        <div className="kr-streifen" />
        {zustand === 'daten' ? children : <div className="kr-karte"><div className="kr-karte-scroll" style={{ padding: 16 }}><MitZustand zustand={zustand} texte={{ titel, ...texte }}>{null}</MitZustand></div></div>}
      </section>
      {zurueck && <span className="kr-sr">{zurueck.text}</span>}
    </div>
  );
}
/** Zurück-Zeile oben im Kartenkopf-Bereich (in <Karte kopf> vor dem Kartenkopf einsetzen) */
export function BlattZurueck({ text, onClick }: { text: string; onClick: () => void }) {
  return <div className="kr-blatt-zurueck"><Button art="leise" icon="back" text={text} onClick={onClick} /></div>;
}
