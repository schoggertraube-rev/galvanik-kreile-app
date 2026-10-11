import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { Ausgrau } from './Ausgrau';
import type { Schritt, DatenZustand as ZustandTyp, ZustandTexte } from './typen';
export interface ZustandProps { art: 'laedt' | 'leer' | 'fehler' | 'gesperrt'; text?: string; aktion?: Schritt; }
const STANDARD = { laedt: 'Wird geladen …', leer: 'Keine Einträge.', fehler: 'Konnte nicht geladen werden.', gesperrt: 'Kein Zugriff · vom Admin gesperrt' } as const;
/** Eine Zeile mit Datenlage + höchstens einem nächsten Schritt (§6.7). Keine Illustration. */
export function Zustand({ art, text, aktion }: ZustandProps) {
  return (
    <div className={'kr-zustand kr-zustand--' + art} role={art === 'fehler' ? 'alert' : 'status'}>
      {art === 'laedt' ? <span className="kr-drehen" /> : <Icon name={art === 'fehler' ? 'alert' : art === 'gesperrt' ? 'lock' : 'check'} />}
      <span className="kr-zustand-text">{text ?? STANDARD[art]}</span>
      {aktion && art !== 'gesperrt' && art !== 'laedt' && (
        <Button art={art === 'fehler' ? 'sekundaer' : 'primaer'} icon={art === 'fehler' ? 'refresh' : aktion.icon} text={aktion.text} onClick={aktion.onClick} />
      )}
    </div>
  );
}
/** Einheitliche 7-Zustände-Weiche für jede datentragende Komponente */
export function MitZustand({ zustand = 'daten', texte = {}, children }: { zustand?: ZustandTyp; texte?: ZustandTexte; children: ReactNode }) {
  switch (zustand) {
    case 'daten': return <>{children}</>;
    case 'klaerung': case 'aufbau': return <Ausgrau art={zustand} text={texte.titel ?? 'Funktion'} />;
    case 'laedt': return <Zustand art="laedt" text={texte.laedtText} />;
    case 'leer': return <Zustand art="leer" text={texte.leerText} aktion={texte.leerAktion} />;
    case 'fehler': return <Zustand art="fehler" text={texte.fehlerText} aktion={texte.fehlerAktion} />;
    case 'gesperrt': return <Zustand art="gesperrt" text={texte.gesperrtText} />;
  }
}
