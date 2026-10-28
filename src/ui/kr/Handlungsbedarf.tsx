'use client';
import { useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Button, type ButtonArt } from './Button';
import { Chip } from './Chip';
import { MitZustand } from './Zustand';
import { Wischbar } from './Wischbar';
import { cx, type Geraet, type HandlungsArt, type DatenZustand, type ZustandTexte } from './typen';
export interface HandlungsAktion { text: string; /** Kurzlabel fürs Handy */ kurz?: string; icon?: IconName; art?: ButtonArt; specId?: string; onClick: () => void;
  /** V1.1: markiert „Später“ (öffnet Zeitwahl V8 S1) – für Fokuseintrag, Taste s und Wischen links */ spaeter?: boolean; }
export interface HandlungsEintragProps {
  art: HandlungsArt; id?: string; titel: string; titelKurz?: string; meta?: string; metaKurz?: string;
  /** Delegiert von Person (z. B. „Rolf“) – ersetzt das Art-Kurzlabel */
  von?: string;
  /** Erste Aktion = Primäraktion (1 Tipp). Handy: nur erste + Menü „Weitere“. */
  aktionen?: HandlungsAktion[];
  /** Nach Aktion: Statuszeile statt Knöpfen (z. B. „bei Phillip · Frist 11:30“) */
  status?: { text: string; ton?: 'laedt' | 'rot' | 'info'; icon?: IconName; aktion?: { text: string; specId?: string; onClick: () => void } };
  geraet: Geraet; onOeffnen?: () => void; onWeitere?: () => void;
  /** V1.1 B1: dringendster Punkt oben, etwas größer; genau eine Hauptaktion + „Später“ + weitere */
  fokus?: boolean;
  /** V1.1 B4: per Tastatur (j/k) gewählt */
  gewaehlt?: boolean;
  /** V1.1 B5: Wischen erlaubt (nur Touch; nie für Freigaben und Geld – setzt die App) */
  wischbar?: boolean;
  /** Aufgeschobene Einträge bleiben sichtbar, stehen aber gedimmt am Ende. */
  gedimmt?: boolean;
  /** ISO-Termin für die stabile Sortierung innerhalb einer Dringlichkeitsart. */
  termin?: string;
}
const LABEL: Record<HandlungsArt, [string, 'rot' | 'warn' | 'info']> = { konflikt: ['Konflikt', 'rot'], warnung: ['Warnung', 'warn'], entscheidung: ['Entscheidung', 'info'] };
/** Max. 2 Zeilen: Titel + 1 Meta · Aktion rechts · keine Erklärzeile */
export function HandlungsEintrag(p: HandlungsEintragProps) {
  const handy = p.geraet === 'handy';
  const [lbl, ton] = LABEL[p.art];
  const aktionen = p.aktionen ?? [];
  const spaeter = aktionen.find(a => a.spaeter);
  const andere = aktionen.slice(1).filter(a => a !== spaeter);
  const eintrag = (
    <div className={cx('kr-hb-eintrag', 'kr-hb-eintrag--' + p.art, p.fokus && 'kr-fokus', p.gewaehlt && 'kr-hb-eintrag--gewaehlt', p.gedimmt && 'kr-hb-eintrag--gedimmt')} onClick={e => { if (!(e.target as HTMLElement).closest('button')) p.onOeffnen?.(); }}>
      <span className="kr-punkt" />
      <div className="kr-hb-main">
        {/* Handy: Nummer wandert in die Meta-Zeile, damit der Titel lesbar bleibt */}
        <div className="kr-hb-titel">{p.id && !handy && <span className="kr-id">{p.id}</span>}{(handy && p.titelKurz) || p.titel}</div>
        <div className="kr-hb-meta">{p.von ? <Chip text={'von ' + p.von} ton="info" icon="user" /> : <Chip text={lbl} ton={ton} />}{p.id && handy && <><span className="kr-id">{p.id}</span> · </>}{(handy && p.metaKurz) || p.meta}</div>
      </div>
      <div className="kr-hb-aktionen">
        {p.status ? (
          <>
            <span className={p.status.ton && p.status.ton !== 'laedt' ? 'kr-hb-status kr-hb-status--' + p.status.ton : 'kr-hb-status'}>
              {p.status.ton === 'laedt' ? <span className="kr-drehen" /> : <Icon name={p.status.icon ?? 'clock'} />}{p.status.text}
            </span>
            {p.status.aktion ? p.status.aktion.specId === 'hbmehr.zuruckholen'
              ? <Button data-spec-id="hbmehr.zuruckholen" art="leise" icon="back" text={p.status.aktion.text} onClick={p.status.aktion.onClick} />
              : <Button data-spec-id={p.status.aktion.specId} art="leise" icon="back" text={p.status.aktion.text} onClick={p.status.aktion.onClick} />
              : null}
          </>
        ) : p.fokus && aktionen[0] ? (<>
          {aktionen[0].specId === 'hbmehr.auftrag-offnen'
            ? <Button data-spec-id="hbmehr.auftrag-offnen" art={aktionen[0].art ?? 'erledigen'} icon={aktionen[0].icon} text={handy ? aktionen[0].kurz ?? aktionen[0].text : aktionen[0].text} onClick={aktionen[0].onClick} />
            : <Button data-spec-id={aktionen[0].specId} art={aktionen[0].art ?? 'erledigen'} icon={aktionen[0].icon} text={handy ? aktionen[0].kurz ?? aktionen[0].text : aktionen[0].text} onClick={aktionen[0].onClick} />}
          {spaeter && <Button art="leise" icon={spaeter.icon} text={spaeter.text} onClick={spaeter.onClick} />}
          {/* Owner 2026-09-27: keine Auswahl im Fokus – weitere Aktionen hinter „Weitere“ (onWeitere öffnet Menü) */}
          {andere.length > 0 && <Button art="leise" icon="more" text="Weitere" onClick={p.onWeitere} />}
        </>) : (<>
          {(handy ? aktionen.slice(0, 1) : aktionen).map((a, n) => (
            a.specId === 'hbmehr.auftrag-offnen'
              ? <Button key={a.text} data-spec-id="hbmehr.auftrag-offnen" art={a.art ?? (n === 0 ? 'erledigen' : 'leise')} icon={a.icon} text={handy ? a.kurz ?? a.text : a.text} onClick={a.onClick} />
              : <Button key={a.text} data-spec-id={a.specId} art={a.art ?? (n === 0 ? 'erledigen' : 'leise')} icon={a.icon} text={handy ? a.kurz ?? a.text : a.text} onClick={a.onClick} />
          ))}
          {handy && aktionen.length > 1 && <Button art="leise" icon="more" label="Weitere Aktionen" onClick={p.onWeitere} />}
        </>)}
      </div>
    </div>
  );
  if (!p.wischbar || p.status || !aktionen[0] || !spaeter || p.geraet === 'desktop') return eintrag;
  return <Wischbar rechtsText={aktionen[0].text} onRechts={aktionen[0].onClick} onLinks={spaeter.onClick}>{eintrag}</Wischbar>;
}
export interface HandlungsListeProps {
  eintraege: Array<Omit<HandlungsEintragProps, 'geraet'> & { key: string }>; geraet: Geraet;
  /** Nur Phillip V4: „Heute sichern“ (kanonisch). Rolf/Gregor: ohne Label. */
  label?: string; zustand?: DatenZustand; texte?: ZustandTexte; /** Handy/Tablet: max. sichtbare Einträge (inkl. Fokus), Rest fließend aufklappbar */ max?: number;
  /** V1.1 B1: erster offener Eintrag (ohne Status) wird Fokuseintrag. Kein Zähler „1/n“ (steht in der Lage-Leiste). */
  fokus?: boolean;
  /** V1.1 B4: Index des per Tastatur gewählten Eintrags (siehe useListenTastatur) */
  auswahl?: number;
}
/** Handlungsbedarf zuerst (§6.1). Nichts dringend ⇒ rendert nichts (keine „Alles gut“-Fläche). */
const ORDNUNG: Record<HandlungArtKey, number> = { konflikt: 0, warnung: 1, entscheidung: 2 };
type HandlungArtKey = HandlungsArt;
function terminWert(value?: string): number { const parsed = value ? Date.parse(value) : Number.NaN; return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed; }
export function sortHandlungsEintraege<T extends Pick<HandlungsEintragProps, 'art' | 'gedimmt' | 'termin'>>(eintraege: readonly T[]): T[] {
  return [...eintraege].sort((a, c) => Number(Boolean(a.gedimmt)) - Number(Boolean(c.gedimmt)) || ORDNUNG[a.art] - ORDNUNG[c.art] || terminWert(a.termin) - terminWert(c.termin));
}
/** Reihenfolge: Konflikt → Warnung → Entscheidung, innerhalb nach Termin. Nichts dringend ⇒ rendert nichts. */
export function HandlungsListe({ eintraege: roh, geraet, label, zustand = 'daten', texte, max, fokus, auswahl = -1 }: HandlungsListeProps) {
  const [offen, setOffen] = useState(false);
  const sortiert = sortHandlungsEintraege(roh);
  const f = fokus ? sortiert.find(e => !e.status) : undefined;
  const eintraege = (f ? [{ ...f, fokus: true }, ...sortiert.filter(e => e !== f)] : sortiert).map((e, n) => ({ ...e, gewaehlt: geraet === 'desktop' && n === auswahl }));
  if (zustand === 'daten' && eintraege.length === 0 && !label) return null;
  /** Owner 2026-09-27: Konflikte werden nie eingeklappt, nur Entscheidungen und Warnungen */
  const sicht = max && eintraege.length > max ? eintraege.filter((e, n) => e.art === 'konflikt' || n < max) : eintraege;
  const rest = eintraege.filter(e => !sicht.includes(e));
  return (
    <section className="kr-hb" aria-label="Handlungsbedarf">
      {label && <h2 className="kr-hb-label"><Icon name="clock" />{label}</h2>}
      <MitZustand zustand={zustand} texte={{ titel: 'Handlungsbedarf', leerText: 'Nichts Dringendes.', ...texte }}>
        {sicht.map(({ key, ...e }) => <HandlungsEintrag key={key} {...e} geraet={geraet} />)}
        {rest.length > 0 && (<>
          <div className={offen ? 'kr-klapp kr-klapp--offen' : 'kr-klapp'} aria-hidden={!offen}><div>{rest.map(({ key, ...e }) => <HandlungsEintrag key={key} {...e} geraet={geraet} />)}</div></div>
          <button type="button" className="kr-hb-mehr" aria-expanded={offen} onClick={() => setOffen(o => !o)}>{offen ? 'weniger' : rest.length + ' weitere'}<Icon name="chev" /></button>
        </>)}
      </MitZustand>
    </section>
  );
}
