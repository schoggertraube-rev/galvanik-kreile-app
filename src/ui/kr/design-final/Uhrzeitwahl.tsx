'use client';

// Neu neben src/ui/kr/Picker.tsx. Die Darstellungslogik schreibt keinen Termin.
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { GlasDialog, type GlasDialogProps } from './GlasDialog';
import styles from './Uhrzeitwahl.module.css';

export interface UhrOption {
  wert: number;
  anzeige: string;
  vorlesen: string;
}

export interface UhrSpalte {
  name: string;
  kleinerText: string;
  groesserText: string;
  optionen: readonly UhrOption[];
  wert: number;
  onWahl: (wert: number) => void;
}

interface UhrRadProps extends UhrSpalte {
  fokus?: RefObject<HTMLDivElement | null>;
  minusSymbol: ReactNode;
  plusSymbol: ReactNode;
  onUebernehmen?: () => void;
  onWertAntippen?: (wert: number) => void;
  offen: boolean;
}

function UhrRad({ name, kleinerText, groesserText, optionen, wert, onWahl, fokus, minusSymbol, plusSymbol, onUebernehmen, onWertAntippen, offen }: UhrRadProps) {
  const fallback = useRef<HTMLDivElement>(null);
  const rad = fokus ?? fallback;
  const auswahl = optionen.findIndex((option) => option.wert === wert);
  const auswahlRef = useRef(auswahl);
  const zeigeBeiOeffnung = useRef(false);
  const max = optionen.length - 1;

  useLayoutEffect(() => {
    if (!offen) { zeigeBeiOeffnung.current = false; return; }
    if (zeigeBeiOeffnung.current && auswahlRef.current === auswahl) return;
    auswahlRef.current = auswahl;
    const frame = requestAnimationFrame(() => {
      const element = rad.current;
      const zeile = element?.querySelector<HTMLElement>('[data-uhr-zeile]');
      if (element && zeile && auswahl >= 0) {
        element.scrollTo?.({top:auswahl * zeile.offsetHeight,behavior:'instant'});
        zeigeBeiOeffnung.current = true;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [auswahl, offen, rad]);

  function waehlen(index: number, zentrieren = true) {
    const option = optionen[index];
    const element = rad.current;
    if (option && zentrieren && element) {
      const zeile = element.querySelector<HTMLElement>('[data-uhr-zeile]');
      if (zeile) element.scrollTo?.({top:index * zeile.offsetHeight,behavior:'instant'});
    }
    if (option && index !== auswahlRef.current) {
      auswahlRef.current = index;
      onWahl(option.wert);
    }
  }

  return <div className={styles.spalte}>
    <span className={styles.einheit}>{name}</span>
    <button type="button" className={styles.schritt} aria-label={kleinerText} disabled={max < 0} onClick={() => waehlen(auswahl < 0 ? max : (auswahl + max) % (max + 1))}>{minusSymbol}</button>
    <div
      className={styles.rad}
      ref={rad}
      role="spinbutton"
      tabIndex={0}
      aria-label={name}
      aria-valuemin={optionen[0]?.wert}
      aria-valuemax={optionen[max]?.wert}
      aria-valuenow={wert}
      aria-valuetext={optionen[auswahl]?.vorlesen}
      onScroll={(event) => {
        const zeile = event.currentTarget.querySelector<HTMLElement>('[data-uhr-zeile]');
        if (zeigeBeiOeffnung.current && zeile?.offsetHeight) waehlen(Math.min(max, Math.max(0, Math.round(event.currentTarget.scrollTop / zeile.offsetHeight))), false);
      }}
      onKeyDown={(event) => {
        const schritt: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5, Home: -max, End: max };
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault();
          onUebernehmen?.();
        } else if (Object.hasOwn(schritt, event.key)) {
          event.preventDefault();
          waehlen(Math.max(0, Math.min(max, auswahl + schritt[event.key])));
        }
      }}
    >
      <div className={styles.spur} aria-hidden="true">
        {optionen.map((option, index) => <span
          key={option.wert}
          className={styles.wert}
          data-uhr-zeile
          data-aktiv={index === auswahl ? '' : undefined}
          onClick={() => {
            if (onWertAntippen) onWertAntippen(option.wert);
            else waehlen(index);
          }}
        >{option.anzeige}</span>)}
      </div>
    </div>
    <button type="button" className={styles.schritt} aria-label={groesserText} disabled={max < 0} onClick={() => waehlen((auswahl + 1) % (max + 1))}>{plusSymbol}</button>
  </div>;
}

export interface UhrzeitwahlProps extends Pick<GlasDialogProps, 'offen' | 'titel' | 'schliessenText' | 'onSchliessen' | 'onGeschlossen' | 'oeffner'> {
  stunden: UhrSpalte;
  minuten: UhrSpalte;
  minusSymbol: ReactNode;
  plusSymbol: ReactNode;
  uebernehmenText: string;
  uebernehmenVorlesen?: string;
  uebernehmenGesperrt?: boolean;
  fehler?: string;
  onUebernehmen: () => void;
  onMinuteAntippen: (wert: number) => void;
}

export function Uhrzeitwahl({ stunden, minuten, minusSymbol, plusSymbol, uebernehmenText, uebernehmenVorlesen, uebernehmenGesperrt, fehler, onUebernehmen, onMinuteAntippen, ...dialog }: UhrzeitwahlProps) {
  const fokus = useRef<HTMLDivElement>(null);
  function bestaetigen() {
    if (!uebernehmenGesperrt) onUebernehmen();
  }
  const steuerung = { minusSymbol, plusSymbol, offen: dialog.offen, onUebernehmen: bestaetigen };
  return <GlasDialog {...dialog} fokus={fokus} ansicht="zeitwahl" schliessenStil="text">
    <div className={styles.raeder}>
      <UhrRad {...stunden} {...steuerung} fokus={fokus} />
      <UhrRad {...minuten} {...steuerung} onWertAntippen={onMinuteAntippen} />
    </div>
    <button type="button" className={styles.uebernehmen} aria-label={uebernehmenVorlesen} disabled={uebernehmenGesperrt} onClick={bestaetigen}>{uebernehmenText}</button>
    {fehler && <p className={styles.fehler} role="status">{fehler}</p>}
  </GlasDialog>;
}
