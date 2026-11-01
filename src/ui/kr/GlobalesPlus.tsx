'use client';
import { Icon } from './Icon';
export interface GlobalesPlusProps { onKundeAnlegen: () => void; onAuftragKv: () => void; }
/** Ein kanonischer Einstieg in „Neu erfassen“; Folgeentscheidungen liegen im Eingang. */
export function GlobalesPlus({ onAuftragKv }: GlobalesPlusProps) {
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="kr-plus" aria-label="Neu erfassen" title="Neu erfassen" onClick={onAuftragKv}><Icon name="plus" /></button>
    </div>
  );
}
