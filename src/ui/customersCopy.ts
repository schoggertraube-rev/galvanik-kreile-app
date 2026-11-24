import {ORDER_REQUEST_COPY} from './ordersCopy';
export const CUSTOMER_LOOKUP_COPY={invalidId:'Gib eine gültige Kundenkennung an.',invalidQuery:'Gib einen Suchbegriff als Text ein.'} as const;
export const CUSTOMER_METRICS_COPY={classificationMissing:'Grenzen für die Einstufung eintragen'} as const;
/** S05K A11: existing invoice-terms messages, corrected UTF-8 in one text source. */
export const CUSTOMER_INVOICE_TERMS_COPY={
 invalid:"Zahlungsziel oder Skonto ist ungültig.",
 forbidden:"Rechnung auf Ziel darf nur mit dem Recht Zahlungen & Mahnungen freigeschaltet werden.",
 notFound:"Kunde ist nicht verfügbar.",
 conflict:ORDER_REQUEST_COPY.intentConflict,
 incomplete:"Rechnung auf Ziel braucht vollständige Kundendaten.",
 unavailable:"Rechnung auf Ziel konnte nicht sicher freigeschaltet werden."
} as const;
