import {Icon,type VorfinalIconName} from './Icon';

export type LageTon='succ'|'warn'|'ral'|'info';
// V45 semantics -> the four original v10 data-tone selectors, not a new palette.
const SOURCE_TONES:Record<LageTon,{tone:'ok'|'warn'|'ral'|'calm';icon:VorfinalIconName}>={
  succ:{tone:'ok',icon:'check'},warn:{tone:'warn',icon:'alert'},
  ral:{tone:'ral',icon:'alert'},info:{tone:'calm',icon:'arrow'},
};
export const vorfinalLageDarstellung=(zustand:LageTon)=>SOURCE_TONES[zustand];

/** S19: v10's chip/data-tone (e.g. 2957); facts/text arrive from the caller. */
export function Lage({zustand,text,laden}:{zustand:LageTon;text:string;laden:boolean}) {
  const source=vorfinalLageDarstellung(zustand);
  return <span className="chip" data-tone={source.tone} data-spec-id="baustein.lage" aria-busy={laden}>
    <Icon variant="vorfinal" name={source.icon}/>{text}
  </span>;
}
