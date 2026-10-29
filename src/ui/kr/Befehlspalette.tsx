'use client';
import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { Chip, Punkt } from './Chip';
import { MitZustand, Zustand } from './Zustand';
import type { DatenZustand, Geraet, ZustandTexte } from './typen';
import type { SuchTreffer } from './Suche';
/** Nur Aktionen, die es in V1 gibt. Die App filtert nach Rechten: gesperrte Bereiche und bei Werkstatt alles zu Geld erscheinen nicht. */
export type PalettenAktionId = 'eingang' | 'raus' | 'fertig' | 'mehrarbeit' | 'woche';
export interface PalettenAktion { id: PalettenAktionId; text: string; icon: IconName; /** Tastenhinweis, nur Desktop */ kbd?: string; onTun: () => void; }
export interface BefehlspaletteProps {
  wert: string; onWert: (v: string) => void;
  /** Treffer mit Grund + Quelle wie V1-Suche (SuchTreffer) */ treffer: SuchTreffer[];
  aktionen: PalettenAktion[];
  zustand?: DatenZustand; texte?: ZustandTexte; geraet: Geraet;
  onSchliessen: () => void; children?: ReactNode;
}
/** V1.1 B2 „Suchen oder tun“ – Strg K und / (Desktop) öffnen; Kopf-Suchfeld öffnet ebenfalls; Plus-Menü bleibt unverändert.
 *  ↑/↓ wählen, Enter führt aus, Esc schließt. Keine Überschrift (Eingabefeld ist die Mitte); aria-label trägt den Namen. */
export function Befehlspalette({ wert, onWert, treffer, aktionen, zustand = 'daten', texte, geraet, onSchliessen }: BefehlspaletteProps) {
  const [sel, setSel] = useState(-1);
  const liste = useRef<HTMLDivElement>(null);
  const n = (zustand === 'daten' ? treffer.length : 0) + aktionen.length;
  useEffect(() => { setSel(wert ? 0 : -1); }, [wert]);
  const tun = (i: number) => { const t = zustand === 'daten' ? treffer : []; if (i < t.length) t[i].onOeffnen(); else aktionen[i - t.length]?.onTun(); };
  const taste = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(n - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); tun(Math.max(0, sel)); }
    else if (e.key === 'Escape') onSchliessen();
  };
  let idx = -1; const nx = () => { idx++; return idx === sel; };
  return (
    <div className="kr-ebene kr-ebene--palette" onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <section className="kr-palette" role="dialog" aria-modal="true" aria-label="Suchen oder tun">
        <label className="kr-palette-in"><Icon name="search" /><input value={wert} onChange={e => onWert(e.target.value)} onKeyDown={taste} placeholder="Suchen oder tun" autoComplete="off" autoFocus /><Button art="leise" icon="x" label="Schließen" onClick={onSchliessen} /></label>
        <div className="kr-palette-liste" ref={liste}>
          <MitZustand zustand={zustand} texte={{ titel: 'Suche', ...texte }}>
            {treffer.length > 0 ? <><div className="kr-palette-gr">Treffer</div><div className="kr-treffer-liste">{treffer.map(t => (
              <button key={t.key} type="button" className="kr-treffer" aria-selected={nx()} onClick={t.onOeffnen}>
                <Punkt ton={t.dringend ? 'rot' : undefined} />
                <span style={{ minWidth: 0 }}><span className="kr-treffer-t" style={{ display: 'block' }}>{t.id && <span className="kr-id">{t.id} </span>}{t.titel}</span><span className="kr-treffer-grund" style={{ display: 'block' }}>{t.grund}</span></span>
                <Chip text={t.quelle} ton="info" />
              </button>))}</div></> : wert ? <Zustand art="leer" text={'Kein Treffer für „' + wert + '“.'} /> : null}
          </MitZustand>
          {aktionen.length > 0 && <><div className="kr-palette-gr">Tun</div>{aktionen.map(a => (
            <button key={a.id} type="button" className="kr-tun" aria-selected={nx()} onClick={a.onTun}><span className="kr-tun-ic"><Icon name={a.icon} /></span><span>{a.text}</span>{a.kbd && geraet === 'desktop' && <span className="kr-tun-kbd">{a.kbd}</span>}</button>))}</>}
        </div>
      </section>
    </div>
  );
}
