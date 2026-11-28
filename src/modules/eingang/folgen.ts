import {EINGANG_VORSCHLAG_COPY,SITUATION_COPY} from '@/ui/eingangCopy';

export const EINGANG_FOLGEN={
  kundenZuordnung:{schluessel:'kundenZuordnung',befehl:'assignIntakeCustomerAction',recht:'kunden',braucht:['kunde'],
    satz:EINGANG_VORSCHLAG_COPY.sollZuordnen,knopf:EINGANG_VORSCHLAG_COPY.jaZuordnen,selbst:true},
  kvVorbereiten:{schluessel:'kvVorbereiten',befehl:'prepareQuoteFromIntakeAction',recht:'preise',braucht:['kunde','originaltext'],
    satz:EINGANG_VORSCHLAG_COPY.sollKvVorbereiten,knopf:EINGANG_VORSCHLAG_COPY.jaKvVorbereiten,selbst:false},
  aufgabeAnlegen:{schluessel:'aufgabeAnlegen',befehl:'saveIntakeTaskAction',recht:'eingang',braucht:['original'],
    satz:EINGANG_VORSCHLAG_COPY.weiterMit(SITUATION_COPY.task),knopf:SITUATION_COPY.task,selbst:false},
} as const;
