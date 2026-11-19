'use client';
import { Icon } from './Icon';
import {useVorfinalStyle} from '@/ui/useVorfinalStyle';
import {VORFINAL_COPY} from '@/ui/situationCatalog';
export interface GlobalesPlusProps { onOeffnen: () => void; }
/** Ein kanonischer Einstieg in „Neu erfassen“; Folgeentscheidungen liegen im Eingang. */
export function GlobalesPlus({ onOeffnen }: GlobalesPlusProps) {
  const vorfinal=useVorfinalStyle();
  if(vorfinal)return (
    <button type="button" className="plus" data-glass="act" data-tint="plus" data-open="plus" aria-label={VORFINAL_COPY['vorfinal.kopf.plus.label']} data-spec-id="kopf.plus" onClick={onOeffnen}>
      <Icon variant="vorfinal" name="plus"/>
    </button>
  );
  return (
    <div style={{ position: 'relative' }}>
      <button data-spec-id="navigation.plus" type="button" className="kr-plus" aria-label="Neu erfassen" title="Neu erfassen" onClick={onOeffnen}><Icon name="plus" /></button>
    </div>
  );
}
