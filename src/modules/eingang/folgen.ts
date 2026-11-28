import {EINGANG_VORSCHLAG_COPY} from '@/ui/eingangCopy';

export const EINGANG_FOLGEN={
  kundenZuordnung:{schluessel:'kundenZuordnung',befehl:'assignIntakeCustomerAction',recht:'kunden',braucht:['kunde'],
    satz:EINGANG_VORSCHLAG_COPY.sollZuordnen,knopf:EINGANG_VORSCHLAG_COPY.jaZuordnen,selbst:true},
  kvVorbereiten:{schluessel:'kvVorbereiten',befehl:'prepareQuoteFromIntakeAction',recht:'preise',braucht:['kunde','originaltext'],
    satz:EINGANG_VORSCHLAG_COPY.sollKvVorbereiten,knopf:EINGANG_VORSCHLAG_COPY.jaKvVorbereiten,selbst:false},
} as const;
