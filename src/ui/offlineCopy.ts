import {DELIVERY_NOTE_COPY,MANUAL_SHIPPING_HANDOVER_LABEL} from './ausgangCopy';
/** PL12.11.00:11: a missing historical time stays explicit, never today. */
export const OFFLINE_NOTE_QUARANTINE_COPY={notice:(time:string|null)=>time?`Notiz von ${time} zurückgehalten - tippe zum Zuordnen`:'Notiz zurückgehalten - tippe zum Zuordnen'} as const;
/** One presentation catalogue. Facts are projections of existing readers, never stored here. */
export const OFFLINE_LOGOUT_COPY={cachePending:'Du bist abgemeldet. Die gespeicherten Daten auf diesem Gerät werden beim nächsten Start gelöscht.',pending:(count:number)=>`${count} Aktionen warten auf Netz - sie gehen raus, sobald du wieder angemeldet und online bist`} as const;
/** PL13:29 / PL15:50, same original source and read-only preview. */
export const OFFLINE_TAKEOVER_COPY={title:'Zurückgehaltene Eingaben',adopt:'Als Eingang übernehmen',noRight:'Zuordnen kann, wer den Eingang bearbeiten darf',taken:(login:string)=>`Original übernommen von ${login}`,note:'Notiz',file:'Datei',unreadable:'Inhalt nicht lesbar – das Original bleibt gespeichert.',unavailable:'Übernehmen hat gerade nicht geklappt. Die Eingabe bleibt auf diesem Gerät – versuch es gleich noch einmal.'} as const;
export const OFFLINE_RECONCILIATION_COPY={noteChanged:'Deine Notiz wurde inzwischen geändert · neuen Stand laden und erneut speichern',reason:'Konflikt beim Abgleich',rejected:'abgelehnt, ohne Wirkung',originalCommand:{
 'item.finished':'Teil fertig melden',
 'document.deliveryNote':DELIVERY_NOTE_COPY.title,
 'shipment.handover':MANUAL_SHIPPING_HANDOVER_LABEL,
 'item.extraWork':'Mehrarbeit erfassen',
 'order.handover':'Übergabeart ändern',
 'invoice.issue':'Rechnung ausstellen',
 'invoice.cancel':'Rechnung stornieren',
 'credit.apply':'Guthaben verrechnen',
 'credit.payout':'Guthaben auszahlen',
}} as const;
/** PL11.11.11:01: pending is not a successful server completion. */
export const OFFLINE_ITEM_FINISHED_COPY={pending:(part:string)=>`Teil ${part} fertig – wird übertragen, sobald Netz da ist`,networkRequired:'Geht nur mit Netz',notSaved:'Teilstatus ist noch nicht gesichert. Erneut speichern.'} as const;
export const OFFLINE_DEVICE_READ_COPY={invalidWindow:'Die Geräteuhr passt nicht zum letzten Stand - neue Eingaben erst wieder mit Verbindung.'} as const;
export const OFFLINE_DEVICE_STATUS_COPY={
 networkStatus:'Netzwerkstatus',
 pending:(count:number)=>`${count} lokal ausstehend`,
 invalidWindow:OFFLINE_DEVICE_READ_COPY.invalidWindow,
 persistence:'Dieses Gerät kann Offline-Daten selbst löschen – Eingaben gehen sofort raus, sobald Netz da ist',
 stand:(time:string,count:number)=>`Offline – Stand ${time}, ${count} Änderungen warten`,
 expired:'Seit über 24 Stunden kein Netz – neue Eingaben erst wieder mit Verbindung',
 unavailable:'Offline-Speicher auf diesem Gerät nicht verfügbar - Eingaben gehen nur mit Netz',
 quarantine:(count:number)=>`${count} Eingaben zurückgehalten - tippe zum Zuordnen`,
 incomplete:'Noch nicht alle Daten auf diesem Gerät – mit Netz lädt die App den Rest automatisch.',
} as const;
