// Ersetzt die Darstellung in src/ui/kr/Button.tsx; bestehende Aufrufer und Aktionen bleiben Adapter-Props.
'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Glasknopf.module.css';

type Form = 'text' | 'kreis' | 'quadrat' | 'dock';
type Ton = 'haupt' | 'sekundaer' | 'erfassung' | 'kritisch' | 'leise';
type Zustand = 'normal' | 'gedrueckt' | 'deaktiviert' | 'laedt' | 'fehler';

type Beschriftung =
  | { form?: 'text' | 'dock'; text: string; bezeichnung?: string }
  | { form: 'kreis' | 'quadrat'; text?: never; bezeichnung: string };

export type GlasknopfProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & Beschriftung & {
  ton?: Ton;
  zustand?: Zustand;
  volleBreite?: boolean;
  icon?: ReactNode;
  endIcon?: ReactNode;
  ladeIcon?: ReactNode;
  fehlerIcon?: ReactNode;
  fehlerId?: string;
};

export function Glasknopf({ form = 'text', text, bezeichnung, ton = 'sekundaer', zustand = 'normal', volleBreite,
  icon, endIcon, ladeIcon, fehlerIcon, fehlerId, className, type = 'button', disabled, onClick,
  'aria-describedby': beschriebenDurch, ...native }: GlasknopfProps) {
  const laedt = zustand === 'laedt';
  const fehler = zustand === 'fehler';
  const endSymbol = (laedt && ladeIcon) || (fehler && fehlerIcon) || endIcon;
  const zeigeEndSymbol = form === 'text' && endSymbol != null;
  const vorn = form === 'text' ? icon : (laedt && ladeIcon) || (fehler && fehlerIcon) || icon;
  const beschreibung = [beschriebenDurch, fehler && fehlerId].filter(Boolean).join(' ');

  return (
    <button
      {...native}
      type={type}
      className={className ? `${styles.knopf} ${className}` : styles.knopf}
      data-form={form satisfies Form}
      data-ton={ton}
      data-glasknopf-zustand={zustand}
      data-volle-breite={volleBreite || undefined}
      aria-label={bezeichnung}
      aria-describedby={beschreibung || undefined}
      aria-busy={laedt || native['aria-busy']}
      aria-disabled={laedt || native['aria-disabled']}
      disabled={disabled || zustand === 'deaktiviert'}
      onClick={(event) => {
        if (laedt || native['aria-disabled'] === true || native['aria-disabled'] === 'true') {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {vorn != null && <span className={styles.symbol} aria-hidden="true">{vorn}</span>}
      {text && <span className={styles.text}>{text}</span>}
      {zeigeEndSymbol && <span className={styles.kugel} aria-hidden="true">{endSymbol}</span>}
    </button>
  );
}
