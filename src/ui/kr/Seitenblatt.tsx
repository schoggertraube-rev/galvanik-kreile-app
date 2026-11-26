'use client';
import { useState, type ReactNode } from 'react';
import { V45_TEXT } from '@/ui/situationCatalog';
import { Button } from './Button';
import { MitZustand } from './Zustand';
import { Icon } from './Icon';
import { useKrGeraet } from './AppShell';
import { GlasDialog } from './design-final/GlasDialog';
import type { DatenZustand, ZustandTexte } from './typen';
export interface SeitenblattProps {
  /** aria-label, z. B. „Auftragskarte A-2026-0101“ – sichtbare Überschrift bleibt der Kartentitel */ titel: string;
  onSchliessen: () => void;
  dataSpecId?: string;
  /** Backstack Auftrag ↔ Kunde: vorherige Karte (z. B. „Zurück · A-2026-0101“) */ zurueck?: { text: string; onClick: () => void };
  zustand?: DatenZustand; texte?: ZustandTexte;
  /** Inhalt = <Karte …> exakt wie V1 (Auftragskarte V8 / Kundenkarte V2): Reihenfolge und Blöcke unverändert */ children: ReactNode;
}
/** V1.1 B3: Karte als Seitenblatt – Desktop/Tablet von rechts, Handy von unten; Hintergrund bleibt sichtbar, Klick daneben schließt.
 *  „Fertig melden“ bleibt Dialog mit 3 Pflichtprüfungen (V5), danach Freeze – das Blatt verkürzt nichts. */
export function Seitenblatt({ titel, onSchliessen, dataSpecId, zurueck, zustand = 'daten', texte, children }: SeitenblattProps) {
  const [offen, setOffen] = useState(true);
  const handy = useKrGeraet() === 'handy';
  const [opener] = useState(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return <GlasDialog offen={offen} titel={titel} ansicht={handy ? 'blatt' : 'objekt'} groesse="akte"
    oeffner={opener} nebenKopf={!handy} kopfVerborgen={zustand === 'daten'} dataSpecId={dataSpecId}
    schliessenText={V45_TEXT.common$close} schliessenSymbol={<Icon name="x" />}
    onSchliessen={() => setOffen(false)} onGeschlossen={onSchliessen}>
    {zustand === 'daten' ? children : <MitZustand zustand={zustand} texte={{ titel, ...texte }}>{null}</MitZustand>}
    {zurueck && <span className="kr-sr">{zurueck.text}</span>}
  </GlasDialog>;
}
/** Zurück-Zeile oben im Kartenkopf-Bereich (in <Karte kopf> vor dem Kartenkopf einsetzen) */
export function BlattZurueck({ text, onClick }: { text: string; onClick: () => void }) {
  return <div className="kr-blatt-zurueck"><Button art="leise" icon="back" text={text} onClick={onClick} /></div>;
}
