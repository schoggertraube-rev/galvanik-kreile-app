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
} as const;
