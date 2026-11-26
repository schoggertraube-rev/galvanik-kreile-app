'use client';

/** Erweitert src/ui/kr/Auftragszeile.tsx und src/ui/kr/Zeile.tsx. */
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import styles from './Arbeitsliste.module.css';

export type Arbeitslayout = 'werkstatt' | 'register' | 'nachrichten' | 'zahlungen';
export type Arbeitston = 'neutral' | 'offen' | 'fertig' | 'frist' | 'sperre';

export interface FallzeileModel {
  id: string;
  titel: string;
  meta?: ReactNode;
  detail?: ReactNode;
  zeit?: string;
  status?: { text: string; ton: Arbeitston };
  marken?: ReadonlyArray<{ id: string; label: string; ton: Arbeitston }>;
  bild?: { src: string; alt: string };
  ersatzsymbol?: ReactNode;
  hinweis?: { text: string; ton: Arbeitston };
  aktiv?: boolean;
  onOeffnen?: () => void;
  menue?: { label: string; symbol: ReactNode; onOeffnen: () => void };
  hauptaktion?: ReactNode;
  nebenaktion?: ReactNode;
  statusaktionen?: ReactNode;
  fuss?: ReactNode;
  /** Wischen öffnet denselben sichtbaren Aktionsweg wie der zugeordnete Knopf. */
  onWischLinks?: () => void;
  onWischRechts?: () => void;
}

function useZeilengesten({ menue, onWischLinks, onWischRechts }: FallzeileModel) {
  const start = useRef<{ id: number; x: number; y: number; toleranz: number; weg: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const verhindertKlick = useRef(false);

  function stop() {
    if (start.current?.timer !== undefined) clearTimeout(start.current.timer);
    start.current = null;
  }

  useEffect(() => () => {
    if (start.current?.timer !== undefined) clearTimeout(start.current.timer);
  }, []);

  return {
    beiDruck(event: PointerEvent<HTMLButtonElement>) {
      verhindertKlick.current = false;
      if (!event.isPrimary || event.pointerType === 'mouse' || (!menue && !onWischLinks && !onWischRechts)) return;
      stop();
      const stil = getComputedStyle(event.currentTarget);
      const dauer = parseFloat(stil.getPropertyValue('--kr-arbeit-haltedauer'));
      const toleranz = parseFloat(stil.getPropertyValue('--kr-arbeit-gestentoleranz'));
      const weg = parseFloat(stil.getPropertyValue('--kr-arbeit-wischweg'));
      if (![dauer, toleranz, weg].every(Number.isFinite)) return;
      const pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, toleranz, weg };
      start.current = { ...pointer, timer: menue && setTimeout(() => {
        verhindertKlick.current = true;
        stop();
        menue.onOeffnen();
      }, dauer) };
    },
    beiBewegung(event: PointerEvent<HTMLButtonElement>) {
      const anfang = start.current;
      if (!anfang || anfang.id !== event.pointerId) return;
      if (Math.max(Math.abs(event.clientX - anfang.x), Math.abs(event.clientY - anfang.y)) > anfang.toleranz && anfang.timer !== undefined) {
        clearTimeout(anfang.timer);
        anfang.timer = undefined;
      }
    },
    beiLoslassen(event: PointerEvent<HTMLButtonElement>) {
      const anfang = start.current;
      if (!anfang || anfang.id !== event.pointerId) return;
      const horizontal = event.clientX - anfang.x;
      const vertikal = event.clientY - anfang.y;
      stop();
      if (Math.abs(horizontal) < anfang.weg || Math.abs(horizontal) <= Math.abs(vertikal)) return;
      const callback = horizontal < 0 ? onWischLinks : onWischRechts;
      if (callback) {
        verhindertKlick.current = true;
        callback();
      }
    },
    stop,
    klickErlaubt(tastatur: boolean) {
      const erlaubt = tastatur || !verhindertKlick.current;
      verhindertKlick.current = false;
      return erlaubt;
    },
  };
}

export function Fallzeile({ modell }: { modell: FallzeileModel }) {
  const { titel, bild, ersatzsymbol, meta, detail, zeit, status, marken, hinweis, aktiv, onOeffnen, menue } = modell;
  const zeilengesten = useZeilengesten(modell);
  const zeilenInhalt = <>
    {(bild || ersatzsymbol) && <span className={styles.bild}>{bild
      ? <Image src={bild.src} alt={bild.alt} width={65} height={65} unoptimized />
      : ersatzsymbol}</span>}
    <span className={styles.titel}>{titel}</span>
    {(marken?.length || meta || status || zeit) ? <span className={styles.metaZeile}>
      {(marken?.length || meta || status) ? <span className={styles.meta}>
        {!!marken?.length && <span className={styles.punkte}>{marken.map(marke => (
          <span key={marke.id} className={styles.punkt} data-ton={marke.ton} role="img" aria-label={marke.label} />
        ))}</span>}
        {meta && <span>{meta}</span>}
        {status && <span className={styles.status} data-ton={status.ton}>{status.text}</span>}
      </span> : null}
      {zeit && <span className={styles.zeit}>{zeit}</span>}
    </span> : null}
    {detail && <span className={styles.detail}>{detail}</span>}
  </>;

  return <li className={styles.zeile} data-aktiv={aktiv || undefined} data-ton={status?.ton}>
    <div className={styles.kopf}>
      {onOeffnen ? <button type="button" className={styles.oeffnen} aria-current={aktiv ? 'true' : undefined}
        data-gesten={modell.onWischLinks || modell.onWischRechts || menue ? 'an' : undefined}
        onPointerDown={zeilengesten.beiDruck} onPointerMove={zeilengesten.beiBewegung}
        onPointerUp={zeilengesten.beiLoslassen} onPointerCancel={zeilengesten.stop}
        onContextMenu={event => { if (menue && event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType === 'touch') event.preventDefault(); }}
        onClick={event => { if (zeilengesten.klickErlaubt(event.detail === 0)) onOeffnen(); }}>
        {zeilenInhalt}
      </button> : <div className={styles.oeffnen}>{zeilenInhalt}</div>}
      {menue && <button type="button" className={styles.menue} aria-label={menue.label} aria-haspopup="menu" onClick={menue.onOeffnen}>
        <span aria-hidden="true">{menue.symbol}</span>
      </button>}
    </div>
    {hinweis && <p className={styles.hinweis} data-ton={hinweis.ton}>{hinweis.text}</p>}
    {(modell.statusaktionen || modell.hauptaktion || modell.nebenaktion || modell.fuss) && <div className={styles.aktionen}>
      {modell.statusaktionen && <div className={styles.statusaktionen}>{modell.statusaktionen}</div>}
      {modell.hauptaktion && <div className={styles.hauptaktion}>{modell.hauptaktion}</div>}
      {modell.nebenaktion && <div className={styles.nebenaktion}>{modell.nebenaktion}</div>}
      {modell.fuss && <div className={styles.fuss}>{modell.fuss}</div>}
    </div>}
  </li>;
}

export function Arbeitsliste({ layout, eintraege, label, leer, busy = false }: {
  layout: Arbeitslayout;
  eintraege: readonly FallzeileModel[];
  label: string;
  leer?: ReactNode;
  busy?: boolean;
}) {
  return <section className={styles.rahmen} data-layout={layout} aria-label={label} aria-busy={busy || undefined}>
    {eintraege.length ? <ul className={styles.liste}>{eintraege.map(eintrag => <Fallzeile key={eintrag.id} modell={eintrag} />)}</ul> : leer}
  </section>;
}
