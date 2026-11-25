'use client';

// Neu neben src/ui/kr/Formularfeld.tsx; der Aufrufer validiert, übernimmt und bucht.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { GlasDialog, type GlasDialogProps } from './GlasDialog';
import styles from './Zahlenwahl.module.css';

type Ziffer = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Taste = Ziffer | 'komma' | 'loeschen';
const tasten: readonly Taste[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'komma', '0', 'loeschen'];

export interface ZahlAktion {
  text: string;
  symbol?: ReactNode;
  deaktiviert?: boolean;
  onAktion: () => void;
}

export interface ZahlenwahlProps extends Pick<GlasDialogProps, 'offen' | 'titel' | 'schliessenText' | 'onSchliessen' | 'onGeschlossen' | 'oeffner' | 'schliessenSymbol'> {
  wert: string;
  einheit?: string;
  hinweis?: string;
  ungueltig?: boolean;
  ziffernGruppe: string;
  komma: { erlaubt: boolean; text: string; zeichen: string };
  loeschen: { text: string; symbol: ReactNode };
  minus: ZahlAktion;
  plus: ZahlAktion;
  tastatur: ZahlAktion;
  leeren: ZahlAktion;
  uebernehmen: ZahlAktion;
  nativeEingabe?: { text: string; wert: string; onWert: (wert: string) => void };
  onTaste: (taste: Taste) => void;
}

function Werkzeug({ aktion, klasse }: { aktion: ZahlAktion; klasse?: string }) {
  return <button type="button" className={klasse} aria-label={aktion.text} disabled={aktion.deaktiviert} onClick={aktion.onAktion}>{aktion.symbol ?? aktion.text}</button>;
}

export function Zahlenwahl({
  wert, einheit, hinweis, ungueltig, ziffernGruppe, komma, loeschen, minus, plus,
  tastatur, leeren, uebernehmen, nativeEingabe, onTaste, ...dialog
}: ZahlenwahlProps) {
  const edit = useRef<HTMLInputElement>(null);
  const tastaturAktiv = Boolean(nativeEingabe);
  useLayoutEffect(() => {
    if (tastaturAktiv) edit.current?.focus({ preventScroll: true });
  }, [tastaturAktiv]);

  return <GlasDialog {...dialog} ansicht="zahlwahl">
    <div className={styles.zahlfeld} data-r53-tastatur={tastaturAktiv ? '' : undefined}>
      <div className={styles.wertgruppe}>
        <div className={styles.wertfeld} data-r53-ungueltig={ungueltig ? '' : undefined}>
          <Werkzeug aktion={minus} klasse={styles.schritt} />
          <div className={styles.abgelesen}>
            {nativeEingabe ? <input ref={edit} className={styles.nativ} type="text" autoComplete="off" spellCheck={false} inputMode="decimal"
              aria-label={nativeEingabe.text} aria-invalid={ungueltig || undefined} value={nativeEingabe.wert}
              onChange={(event) => nativeEingabe.onWert(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                event.preventDefault();
                if (!ungueltig && !uebernehmen.deaktiviert) uebernehmen.onAktion();
              }} /> : <output className={styles.wert} aria-live="polite" aria-atomic="true">{wert}</output>}
            {einheit && <span className={styles.einheit}>{einheit}</span>}
          </div>
          <Werkzeug aktion={plus} klasse={styles.schritt} />
        </div>
        {hinweis && <p className={styles.hinweis} data-r53-ungueltig={ungueltig ? '' : undefined} role="status">{hinweis}</p>}
      </div>
      {!tastaturAktiv && <div className={styles.ziffern} aria-label={ziffernGruppe} role="group">
        {tasten.map((taste) => <button key={taste} type="button"
          className={styles.ziffer}
          data-r53-nebentaste={taste === 'komma' || taste === 'loeschen' ? '' : undefined}
          aria-label={taste === 'komma' ? komma.text : taste === 'loeschen' ? loeschen.text : undefined}
          disabled={taste === 'komma' && !komma.erlaubt}
          onClick={() => onTaste(taste)}
        >{taste === 'komma' ? komma.zeichen : taste === 'loeschen' ? loeschen.symbol : taste}</button>)}
      </div>}
      <div className={styles.werkzeug}>
        <button type="button" aria-label={tastatur.text} aria-pressed={tastaturAktiv} disabled={tastatur.deaktiviert} onClick={tastatur.onAktion}>{tastatur.symbol ?? tastatur.text}</button>
        <Werkzeug aktion={leeren} />
      </div>
      <button type="button" className={styles.uebernehmen} disabled={ungueltig || uebernehmen.deaktiviert} onClick={uebernehmen.onAktion}>{uebernehmen.symbol}{uebernehmen.text}</button>
    </div>
  </GlasDialog>;
}
