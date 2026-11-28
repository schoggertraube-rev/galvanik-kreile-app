import {EINGANG_VORSCHLAG_COPY} from '@/ui/eingangCopy';

export const EINGANG_FOLGEN={
  kundenZuordnung:{schluessel:'kundenZuordnung',befehl:'assignIntakeCustomerAction',recht:'kunden',braucht:['kunde'],
    satz:EINGANG_VORSCHLAG_COPY.sollZuordnen,knopf:EINGANG_VORSCHLAG_COPY.jaZuordnen,selbst:true},
} as const;
