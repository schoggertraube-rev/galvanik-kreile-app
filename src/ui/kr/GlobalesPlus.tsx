'use client';
import { useState } from 'react';
import { Icon } from './Icon';
export interface GlobalesPlusProps { onKundeAnlegen: () => void; onAuftragKv: () => void; }
/** Globales Plus (D-UI-V5-001): ≤ 2 Klicks zu „Kunde anlegen“ oder „Auftrag / KV“. Nur reale Commands. */
export function GlobalesPlus({ onKundeAnlegen, onAuftragKv }: GlobalesPlusProps) {
  const [offen, setOffen] = useState(false);
  const wahl = (f: () => void) => () => { setOffen(false); f(); };
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="kr-plus" aria-label="Neu anlegen" aria-expanded={offen} onClick={() => setOffen(o => !o)}><Icon name="plus" /></button>
      {offen && (
        <div className="kr-plus-menue" role="menu" style={{ top: 56, right: 0 }}>
          <button type="button" role="menuitem" className="kr-menue-el" onClick={wahl(onKundeAnlegen)}><Icon name="user" />Kunde anlegen</button>
          <button type="button" role="menuitem" className="kr-menue-el" onClick={wahl(onAuftragKv)}><Icon name="file" />Auftrag / KV</button>
        </div>
      )}
    </div>
  );
}
