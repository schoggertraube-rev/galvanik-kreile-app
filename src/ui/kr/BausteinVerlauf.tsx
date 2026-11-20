import type {ReactNode} from 'react';

export interface BelegterVerlaufEintrag {
  ereignisId:string;
  zeit:string;
  inhalt:ReactNode;
}

/** S19: original v10 logShow markup (2172/2271); no event reconstruction. */
export function BausteinVerlauf({eintraege,laden}:{eintraege:readonly BelegterVerlaufEintrag[];laden:boolean}) {
  return <ul className="log" data-spec-id="baustein.verlauf" aria-busy={laden}>
    {eintraege.map(eintrag=><li key={eintrag.ereignisId} data-event-id={eintrag.ereignisId}>
      <small>{eintrag.zeit}</small>{eintrag.inhalt}
    </li>)}
  </ul>;
}
