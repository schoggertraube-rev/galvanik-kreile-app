'use client';

// Erweitert src/ui/kr/Formularfeld.tsx. Weitere Feldvarianten bleiben dort bestehen.
import { useId, useLayoutEffect, useRef, type KeyboardEventHandler, type ReactNode } from 'react';
import styles from './Textfeld.module.css';

interface TextfeldProps {
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  id?: string;
  platzhalter?: string;
  mehrzeilig?: boolean;
  pflicht?: boolean;
  deaktiviert?: boolean;
  laedt?: boolean;
  readonly?: boolean;
  fehler?: string;
  fehlerId?: string;
  fehlerSpecId?: string;
  formId?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  labelVerborgen?: boolean;
  typ?: 'text' | 'number' | 'date' | 'search';
  grenzen?: { min?: string | number; max?: string | number; schritt?: string | number };
  enterKeyHint?: 'next' | 'done' | 'search';
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
}

export function Textfeld({ label, wert, onWert, id, platzhalter, mehrzeilig, pflicht, deaktiviert, laedt,
  readonly, fehler, fehlerId, fehlerSpecId, formId, autoComplete, autoFocus, labelVerborgen,
  typ = 'text', grenzen, enterKeyHint, inputMode }: TextfeldProps) {
  const generated = useId();
  const feldId = id ?? generated;
  const fehlerIdIntern = useId();
  const beschreibungId = fehlerId ?? fehlerIdIntern;
  const optionen = {
    id: feldId,
    form: formId,
    value: wert,
    placeholder: platzhalter,
    disabled: deaktiviert || laedt,
    readOnly: readonly,
    required: pflicht,
    'aria-invalid': fehler ? true as const : undefined,
    'aria-describedby': fehler ? beschreibungId : undefined,
    autoComplete,
    autoFocus,
    enterKeyHint,
    inputMode,
  };
  const eins = useRef<HTMLInputElement>(null);
  const mehr = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const feld = mehr.current ?? eins.current;
    const sichtfenster = window.visualViewport;
    if (!feld || !sichtfenster) return;
    let frame = 0;
    const aktualisieren = () => {
      if (document.activeElement !== feld) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = feld.getBoundingClientRect();
        if (box.top < sichtfenster.offsetTop || box.bottom > sichtfenster.offsetTop + sichtfenster.height) {
          feld.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    };
    feld.addEventListener('focus', aktualisieren);
    sichtfenster.addEventListener('resize', aktualisieren);
    return () => {
      cancelAnimationFrame(frame);
      feld.removeEventListener('focus', aktualisieren);
      sichtfenster.removeEventListener('resize', aktualisieren);
    };
  }, [mehrzeilig]);

  return <div className={styles.feld} aria-busy={laedt || undefined}>
    <label className={labelVerborgen ? 'kr-sr' : styles.label} htmlFor={feldId}>{label}</label>
    {mehrzeilig
      ? <textarea {...optionen} ref={mehr} className={styles.eingabe} onChange={(event) => onWert(event.currentTarget.value)} />
      : <input {...optionen} ref={eins} type={typ} min={grenzen?.min} max={grenzen?.max} step={grenzen?.schritt}
          className={styles.eingabe} onChange={(event) => onWert(event.currentTarget.value)} />}
    {fehler && <p id={beschreibungId} data-spec-id={fehlerSpecId} className={styles.fehler} role="status">{fehler}</p>}
  </div>;
}

interface FormularTastaturProps {
  children: ReactNode;
  weiterMitEnter: KeyboardEventHandler<HTMLDivElement>;
}

// Genau eine React-Pipeline pro Ebene: src/ui/kr/tastatur.ts als Prop übergeben.
export function FormularTastatur({ children, weiterMitEnter }: FormularTastaturProps) {
  return <div onKeyDown={weiterMitEnter}>{children}</div>;
}
