const quantityFormat=new Intl.NumberFormat('de-DE',{maximumFractionDigits:3});
const quantity=(value:number)=>quantityFormat.format(value);

export const MAIL_PROMISE_COPY = {
  unavailable: 'Zahlungsstand gerade nicht lesbar – Zusage später senden.',
  handoverRight: 'Mail-Übergabe benötigt Mails und Aufträge.',
  overdueWithoutAmounts: 'Abholung erst nach Zahlung.',
  overdue: (number: string, amount: string, days: number) =>
    `Abholung erst nach Zahlung – ${number} über ${amount} ist seit ${days} Tagen überfällig.`,
  collectAtPickup: (number: string) => `${number} bei Abholung bar kassieren`,
  prepayment: (amount: string|null, handover: 'pickup'|'shipping') => handover==='pickup'
    ? amount?`Bei Abholung ${amount} bar kassieren.`:'Abholung erst nach Zahlung.'
    : amount?`Versand nach Zahlung – ${amount} offen.`:'Versand nach Zahlung.',
  priceRight: 'Beträge fügt jemand mit Preisrecht ein.',
  earliestTerm: (wish: string, date: string) => `${wish} ist nicht machbar – frühestens ${date} anbieten.`,
  quantityNotReady: (groups:readonly {ware:string;fertig:number;gesamt:number}[]) =>
    `${groups.map(({ware,fertig,gesamt})=>`${quantity(fertig)} von ${quantity(gesamt)} ${ware} sind fertig`).join(' · ')} – Teilabholung ist noch nicht möglich.`,
  quantityMismatch: (requested: number, quoted: number) =>
    `Menge weicht ab (${quantity(requested)} statt ${quantity(quoted)}) – Rückfrage senden.`,
  quoteExpired: (number: string) => `KV ${number} ist abgelaufen – neue Fassung anlegen.`,
  quoteAlreadyOrder: (quote: string, order: string) => `KV ${quote} ist schon Auftrag ${order}.`,
  override: 'Trotzdem zusagen',
} as const;
