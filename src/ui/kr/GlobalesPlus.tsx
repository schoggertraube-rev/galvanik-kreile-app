'use client';
import { Icon } from './Icon';
export interface GlobalesPlusProps { onOeffnen: () => void; }
/** Ein kanonischer Einstieg in „Neu erfassen“; Folgeentscheidungen liegen im Eingang. */
export function GlobalesPlus({ onOeffnen }: GlobalesPlusProps) {
  return (
    <div style={{ position: 'relative' }}>
      <button data-spec-id="navigation.plus" type="button" className="kr-plus" aria-label="Neu erfassen" title="Neu erfassen" onClick={onOeffnen}><Icon name="plus" /></button>
    </div>
  );
}
