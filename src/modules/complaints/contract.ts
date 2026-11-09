import type {CaseActorTrace} from "@/lib/server/quoteJournalPort";
/** Read projection of the existing complaint row. P48: itemId is the intake source. */
export type ComplaintState='aufgenommen'|'massnahme_nacharbeit'|'massnahme_gutschrift'|'kunde_informieren'|'abgeschlossen';
export type Complaint={actorTrace?:CaseActorTrace;id:string;customerId:string;orderId:string;itemId:string|null;legacyPositionId:string|null;reason:string;stationId:string|null;description:string;photoIds:string[]|null;createdAt:string;resolvedAt:string|null;resolution:string|null;status:string|null;
 goodsReminderSentAt?:string|null;
 nummer?:string|null;stand?:ComplaintState|null;bewertung?:'berechtigt'|'kulanz'|'abgelehnt'|null;massnahme?:'nacharbeit'|'gutschrift'|'ablehnen'|null;
 nacharbeitAuftragId?:string|null;version?:number|null;teile?:Array<{position_id:string;menge:number}>|null;mangel?:string|null;wareZurueck?:'ja'|'nein'|'offen'|null;
 begruendung?:string|null;gutschriftBetrag?:string|null;gutschriftNr?:string|null;orderNumber?:string|null;customerName?:string|null;reworkNumber?:string|null;reworkGoodsSince?:string|null;history?:Array<{at:string;actor:string|null;state:ComplaintState|null;reason:string|null}>;reworkStation?:string|null;reworkGoods?:string|null;abschlussArt?:string|null;abschlussNotiz?:string|null;
};
export type ComplaintFilter={customerId?:string;orderId?:string;complaintId?:string};
export type ComplaintReadResult={code:'OK';complaints:Complaint[]}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
