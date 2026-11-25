// Einbau in src/app/HomeAppAdapter.tsx und src/components/home/OfficeHome.tsx.
// Erweitert src/ui/kr/Lage.tsx und src/ui/kr/Kachel.tsx.
import type { ReactNode } from 'react';
import styles from './Tagescockpit.module.css';

export type Betriebsfarbe = 'ruhig' | 'zusage' | 'risiko';

export interface PrioritaetskarteProps {
  kategorie: string;
  titel: string;
  begruendung: string;
  zusatz?: string;
  frist?: string;
  pigment: Betriebsfarbe;
  symbol?: ReactNode;
  foto?: { src: string; alt: string; hinweis?: string; onOpen?: () => void };
  hauptaktion: ReactNode;
  nebenaktion?: ReactNode;
  verweise?: ReactNode;
  /** Nur setzen, wenn eine weitere fachliche Priorität bereitsteht. */
  stapel?: boolean;
  /** Ändert sich nach einer bestätigten Aktion. Reine Filterwechsel lassen den Schlüssel stehen. */
  wechselSchluessel?: string;
}

export function Prioritaetskarte({ kategorie, titel, begruendung, zusatz, frist, pigment, symbol,
  foto, hauptaktion, nebenaktion, verweise, stapel, wechselSchluessel }: PrioritaetskarteProps) {
  const plate = foto ? <img className={styles.photo} src={foto.src} alt={foto.alt} /> : null;
  return <div className={styles.deck} data-stack={stapel || undefined}>
    <article className={styles.priority} key={wechselSchluessel} data-next={wechselSchluessel !== undefined || undefined} data-pigment={pigment} data-photo={Boolean(foto) || undefined}>
      <header className={styles.priorityHeader}>
        <strong>{symbol}{kategorie}</strong>
        {frist && <span className={styles.deadline}>{frist}</span>}
      </header>
      <h2 className={styles.priorityTitle}>{titel}</h2>
      <div className={styles.reason}><strong>{begruendung}</strong>{zusatz && <p>{zusatz}</p>}</div>
      {foto && <figure className={styles.plate}>
        {foto.onOpen ? <button type="button" className={styles.photoButton} onClick={foto.onOpen} aria-label={foto.alt}>{plate}</button> : plate}
        {foto.hinweis && <figcaption>{foto.hinweis}</figcaption>}
      </figure>}
      <div className={styles.actions}>{hauptaktion}{nebenaktion}</div>
      {verweise && <div className={styles.links}>{verweise}</div>}
    </article>
  </div>;
}

export interface KennzahlProps {
  titel: string;
  wert: string;
  einordnung?: string;
  folge?: string;
  risiko?: string;
  icon?: ReactNode;
  pigment: 'tag' | 'kunden' | 'rechnung' | 'risiko';
  onOpen: () => void;
}

export function Kennzahl({ titel, wert, einordnung, folge, risiko, icon, pigment, onOpen }: KennzahlProps) {
  return <button type="button" className={styles.metric} data-pigment={pigment} onClick={onOpen}>
    <span className={styles.metricTitle}>{icon}{titel}</span>
    <strong className={styles.metricValue}>{wert}</strong>
    {einordnung && <span className={styles.metricDetail}>{einordnung}</span>}
    {(folge || risiko) && <span className={styles.metricFoot}>{risiko && <strong>{risiko}</strong>}{folge}</span>}
  </button>;
}

export interface TagescockpitProps {
  kopf: ReactNode;
  prioritaet: ReactNode;
  kalender: ReactNode;
  kennzahlen: ReactNode;
  notizen: ReactNode;
  ergebnis?: ReactNode;
  warteschlange?: ReactNode;
}

export function Tagescockpit({ kopf, prioritaet, kalender, kennzahlen, notizen, ergebnis, warteschlange }: TagescockpitProps) {
  return <div className={styles.cockpit}>
    <div className={styles.top}>{kopf}</div>
    <div className={styles.lead}>{prioritaet}</div>
    <div className={styles.planning}>{kalender}</div>
    <div className={styles.metrics}>{kennzahlen}</div>
    <div className={styles.notes}>{notizen}</div>
    {ergebnis && <div className={styles.result}>{ergebnis}</div>}
    {warteschlange && <div className={styles.queue}>{warteschlange}</div>}
  </div>;
}
