'use client';

// Neu neben src/ui/kr/Picker.tsx. Übersetzte Kalendertage kommen vom Aufrufer.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { GlasDialog, type GlasDialogProps } from './GlasDialog';
import styles from './Datumswahl.module.css';

export interface Kalendertag {
  id: string;
  text: string;
  vorlesen: string;
  heute?: boolean;
  gewaehlt?: boolean;
  deaktiviert?: boolean;
}

interface Monatstaste {
  text: string;
  symbol: ReactNode;
  deaktiviert?: boolean;
  onWahl: () => void;
}

export type Kalenderrichtung = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';
const richtungen: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

export interface DatumswahlProps extends Pick<GlasDialogProps, 'offen' | 'titel' | 'schliessenText' | 'onSchliessen' | 'onGeschlossen' | 'oeffner'> {
  monat: string;
  zurueck: Monatstaste;
  vor: Monatstaste;
  wochentage: readonly { kurz: string; lang: string }[];
  tage: readonly (Kalendertag | null)[];
  fokusTag?: string;
  onFokusSchritt: (tag: string, richtung: Kalenderrichtung) => void;
  onTag: (id: string) => void;
  fehler?: string;
}

export function Datumswahl({ monat, zurueck, vor, wochentage, tage, fokusTag, onFokusSchritt, onTag, fehler, ...dialog }: DatumswahlProps) {
  const fokus = useRef<HTMLButtonElement>(null);
  const kandidat = tage.find((tag) => tag && tag.id === fokusTag && !tag.deaktiviert)
    ?? tage.find((tag) => tag?.gewaehlt && !tag.deaktiviert)
    ?? tage.find((tag) => tag && !tag.deaktiviert);

  useLayoutEffect(() => {
    if (dialog.offen && fokusTag === kandidat?.id) fokus.current?.focus({ preventScroll: true });
  }, [dialog.offen, fokusTag, kandidat?.id]);

  return <GlasDialog {...dialog} fokus={fokus} ansicht="zeitwahl" schliessenStil="text">
    <div className={styles.monat}>
      <button type="button" className={styles.monatswechsel} aria-label={zurueck.text} disabled={zurueck.deaktiviert} onClick={zurueck.onWahl}>{zurueck.symbol}</button>
      <strong aria-live="polite">{monat}</strong>
      <button type="button" className={styles.monatswechsel} aria-label={vor.text} disabled={vor.deaktiviert} onClick={vor.onWahl}>{vor.symbol}</button>
    </div>
    <div className={styles.kalender} role="group" aria-label={monat}>
      {wochentage.map((tag) => <abbr className={styles.wochentag} key={tag.kurz} title={tag.lang}>{tag.kurz}</abbr>)}
      {tage.map((tag, index) => tag ? <button
        key={tag.id}
        type="button"
        className={styles.tag}
        aria-label={tag.vorlesen}
        aria-current={tag.heute ? 'date' : undefined}
        aria-pressed={tag.gewaehlt || false}
        disabled={tag.deaktiviert}
        ref={tag.id === kandidat?.id ? fokus : undefined}
        tabIndex={tag.id === kandidat?.id ? 0 : -1}
        onClick={() => onTag(tag.id)}
        onKeyDown={(event) => {
          if (!richtungen.includes(event.key)) return;
          event.preventDefault();
          onFokusSchritt(tag.id, event.key as Kalenderrichtung);
        }}
      >{tag.text}</button> : <span key={index} aria-hidden="true" />)}
    </div>
    {fehler && <p className={styles.fehler} role="status">{fehler}</p>}
  </GlasDialog>;
}
