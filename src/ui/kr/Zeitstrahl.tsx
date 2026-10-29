import { Chip } from './Chip';
import { Button, type ButtonArt } from './Button';
import type { IconName } from './Icon';
import { MitZustand } from './Zustand';
import type { DatenZustand, Ton, ZustandTexte } from './typen';
export interface ZeitstrahlZeile {
  key: string; zeit: string; id?: string; titel: string; meta?: string; ton?: 'ok' | 'info' | 'warn' | 'rot';
  chip?: { text: string; ton?: Ton };
  /** Öffnet nur den BESTEHENDEN Ablauf (z. B. „Ware raus“ mit allen Prüfungen, Abholung mit Zahlung) – nie Abschluss mit einem Tipp */
  aktion?: { text: string; icon?: IconName; art?: ButtonArt; onClick: () => void };
  onOeffnen?: () => void;
}
export interface ZeitstrahlGruppe { key: string; titel: string; zeilen: ZeitstrahlZeile[]; }
export interface ZeitstrahlProps { gruppen: ZeitstrahlGruppe[]; /** Jetzt-Linie in der ersten Gruppe, z. B. „08:12“ */ jetzt?: string; zustand?: DatenZustand; texte?: ZustandTexte; }
/** V1.1 C1 (Owner-Umschalter, Standard = Kacheln): „Heute & Woche“ ersetzt Kacheln Termine + Heute raus.
 *  Rolf-Startseite: keine Beträge, kein Kassieren (§6.9). Phillip: ohne jede Geld-Info – Meta liefert die App entsprechend. */
export function Zeitstrahl({ gruppen, jetzt, zustand = 'daten', texte }: ZeitstrahlProps) {
  const leer = zustand === 'daten' && gruppen.every(g => g.zeilen.length === 0);
  return (
    <MitZustand zustand={leer ? 'leer' : zustand} texte={{ titel: 'Heute & Woche', leerText: 'Keine Termine und kein Warenausgang.', ...texte }}>
      <div className="kr-zeitstrahl">{gruppen.filter(g => g.zeilen.length).map((g, gi) => (
        <div key={g.key} style={{ display: 'contents' }}>
          <div className="kr-zeit-gr">{g.titel}</div>
          {gi === 0 && jetzt && <div className="kr-jetzt"><span>{jetzt}</span><i /></div>}
          {g.zeilen.map(r => (
            <div key={r.key} className={'kr-zeit-el kr-zeit-el--' + (r.ton ?? 'info')}>
              <span className="kr-zeit-z">{r.zeit}</span><span className="kr-zeit-p" />
              <button type="button" className="kr-zeit-t" onClick={r.onOeffnen}><span>{r.id && <span className="kr-id">{r.id}</span>}{r.titel}</span>{r.meta && <small>{r.meta}</small>}</button>
              <span className="kr-zeit-seite">{r.chip && <Chip text={r.chip.text} ton={r.chip.ton} />}{r.aktion && <Button art={r.aktion.art ?? 'sekundaer'} icon={r.aktion.icon} text={r.aktion.text} onClick={r.aktion.onClick} />}</span>
            </div>))}
        </div>))}
      </div>
    </MitZustand>
  );
}
