// Erweitert src/ui/kr/Zeitstrahl.tsx und src/ui/kr/Terminuebersicht.tsx.
import type { CSSProperties, ReactNode } from 'react';
import styles from './Tagesband.module.css';

export interface TagesbandTermin {
  id: string;
  /** Position zwischen 0 und 1 auf der vom Adapter gelieferten Zeitskala. */
  position: number;
  uhrzeit: string;
  titel: string;
  pigment?: 'planung' | 'zusage';
  onOpen: () => void;
}

export interface TagesbandProps {
  titel: string;
  kontext?: string;
  zeitraumName: string;
  aktuellerZeitraum: string;
  zeitraeume: ReadonlyArray<{ id: string; label: string }>;
  onZeitraum: (id: string) => void;
  bearbeitung?: ReactNode;
  termine: readonly TagesbandTermin[];
  skala: ReadonlyArray<{ position: number; label: string }>;
  jetzt?: { position: number; label: string };
  /** Der Adapter kennt den Dichtezustand. Gedrängte Termine werden in der sichtbaren Liste bedient. */
  markenBedienbar?: boolean;
  leermeldung?: ReactNode;
  belegung?: ReactNode;
}

function position(value: number): CSSProperties {
  return { '--position': `${Math.min(1, Math.max(0, value)) * 100}%` } as CSSProperties;
}

export function Tagesband({ titel, kontext, zeitraumName, aktuellerZeitraum, zeitraeume, onZeitraum,
  bearbeitung, termine, skala, jetzt, markenBedienbar, leermeldung, belegung }: TagesbandProps) {
  return <section className={styles.band}>
    <header className={styles.header}>
      <div><h2>{titel}</h2>{kontext && <p>{kontext}</p>}</div>
      <div className={styles.tools}>
        <div role="group" aria-label={zeitraumName} className={styles.period}>
          {zeitraeume.map(item => <button type="button" key={item.id}
            aria-pressed={item.id === aktuellerZeitraum} onClick={() => onZeitraum(item.id)}>{item.label}</button>)}
        </div>
        {bearbeitung}
      </div>
    </header>
    <div className={styles.track} data-markers={markenBedienbar || undefined}>
      <div className={styles.ruler}>
        {jetzt && <div className={styles.elapsed} style={position(jetzt.position)} />}
        {skala.map(item => <span key={item.position} className={styles.tick}
          style={position(item.position)} aria-hidden="true">{item.label}</span>)}
        {termine.map(item => <span key={item.id} className={styles.marker} data-pigment={item.pigment || 'planung'} style={position(item.position)}>
          {markenBedienbar && <button type="button" onClick={item.onOpen} className={styles.markerButton}>{item.uhrzeit} {item.titel}</button>}
        </span>)}
        {jetzt && <span className={styles.now} style={position(jetzt.position)}>{jetzt.label}</span>}
      </div>
    </div>
    <div className={styles.agenda} data-compact-only={markenBedienbar || undefined}>
      {termine.map(item => <button key={item.id} type="button" onClick={item.onOpen} data-pigment={item.pigment || 'planung'}>
        <strong>{item.uhrzeit}</strong> {item.titel}
      </button>)}
    </div>
    {!termine.length && leermeldung}
    {belegung}
  </section>;
}
