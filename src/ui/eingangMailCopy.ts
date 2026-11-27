const quantityFormat=new Intl.NumberFormat('de-DE',{maximumFractionDigits:3});
const quantity=(value:number)=>quantityFormat.format(value);
type Handover = 'pickup'|'shipping'|null;
type PaymentReference = {number:string;amount:string};
type OpenOrder = PaymentReference & {total:string};

export const MAIL_PROMISE_COPY = {
  unavailable: 'Die Angaben reichen für eine Zusage noch nicht aus.',
  unknownPayment: 'Zahlungsstand fehlt – Zusage später senden.',
  unknownTerm: 'Für den Wunschtermin fehlen Angaben zur Ware.',
  unknownQuote: 'Zum Angebot fehlen Angaben für eine Auftragszusage.',
  unknownChannel: 'Dieser Versandkanal ist noch nicht verbunden.',
  unknownPriceSource: 'Für diese Positionen fehlt ein belegter Preis.',
  paymentNotice: 'Danke, wir ordnen Ihre Zahlung zu.',
  foreignSender: 'Wir haben Ihre Nachricht erhalten und stimmen das mit Ihrem hinterlegten Ansprechpartner ab.',
  tooLate: 'Ihr Paket ist bereits unterwegs.',
  labelBooked: 'Das Etikett ist gebucht. Der Versand muss die Änderung übernehmen.',
  handoverRight: 'Mail-Übergabe benötigt Mails und Aufträge.',
  roleRight: (role:string,area:string) => `${role} benötigt das Recht ${area}.`,
  overdueWithoutAmounts: (handover:Handover) => handover==='shipping'?'Versand nach Zahlung.':
    handover==='pickup'?'Abholung erst nach Zahlung.':'Herausgabe erst nach Zahlung.',
  overdue: (handover:Handover,older:PaymentReference,open:OpenOrder|null) => {
    const payment=`Rechnung ${older.number} über ${older.amount}${open?` und Auftrag ${open.number} über ${open.amount}`:''}`;
    return handover==='shipping'
      ? `Der Versand erfolgt nach Zahlung von ${payment}.`
      : `Sie können Ihre Ware abholen, sobald ${payment} beglichen ${open?'sind':'ist'} – gern auch bar bei Abholung.`;
  },
  overdueHint: (handover:Handover,older:PaymentReference,open:OpenOrder|null) => {
    const payment=open?`${older.number} + ${open.number} (${open.total})`:`${older.number} ${older.amount}`;
    return handover==='shipping'?`Im Ausgang vorgemerkt: Versand nach Zahlung ${payment}.`
      : `Im Ausgang vorgemerkt: Bei Abholung ${payment} bar kassieren – dann übergeben.`;
  },
  prepayment: (amount:string|null,handover:Exclude<Handover,null>,mode:'vorkasse'|'abholung') => {
    const value=amount?` ${amount}`:'';
    if(handover==='shipping')return `Versand nach Zahlung${value}.`;
    return mode==='vorkasse'?`Abholung erst nach Zahlungseingang${value}.`
      : amount?`Bei Abholung ${amount} kassieren.`:'Zahlung bei Abholung.';
  },
  reissue: (order:string,handover:Handover) =>
    `Die Rechnung zu ${order} stellen wir gerade neu aus. ${handover==='shipping'?'Wir melden uns zum Versand.':
      handover==='pickup'?'Wir melden uns zur Abholung.':'Wir melden uns zur Herausgabe.'}`,
  reissueHint: (handover:Handover) => handover==='shipping'
    ? 'Im Ausgang: Versand erst nach neuer Rechnung.':
    handover==='pickup'?'Im Ausgang: Abholung erst nach neuer Rechnung.':'Im Ausgang: Herausgabe erst nach neuer Rechnung.',
  pending: {
    zu_spaet:'Der Stand der Paketübergabe fehlt. Belasse den Versand wie geplant.',
    etikett:'Der Stand des Versandetiketts fehlt. Belasse den Versand wie geplant.',
    abholer:'Merke den Namen für den Ausgang am Auftrag vor.',
    gewaehrleistung:'Gib die Meldung zur Gewährleistung an die Verwaltung weiter.',
    dublette:'Ein eindeutiger Abgleich mit vorhandenen Kunden fehlt.',
    beleg_dublette:'Der Abgleich mit vorhandenen Belegen fehlt.',
    abwesenheit:'Die Nachricht ist noch nicht als Abwesenheitsnotiz belegt.',
  },
  priceRight: 'Beträge fügt jemand mit Preisrecht ein.',
  earliestTerm: (wish: string, date: string) => `${wish} ist nicht machbar – frühestens ${date} anbieten.`,
  quantityNotReady: (groups:readonly {ware:string;fertig:number;gesamt:number}[]) =>
    `${groups.map(({ware,fertig,gesamt})=>`${quantity(fertig)} von ${quantity(gesamt)} ${ware} sind fertig`).join(' · ')} – Teilabholung ist noch nicht möglich.`,
  quantityMismatch: (requested: number, quoted: number) =>
    `Menge weicht ab (${quantity(requested)} statt ${quantity(quoted)}) – Rückfrage senden.`,
  quoteExpired: (number: string) => `KV ${number} ist abgelaufen – neue Fassung anlegen.`,
  quoteAlreadyOrder: (quote: string, order: string) => `KV ${quote} ist schon Auftrag ${order}.`,
  verifyBankDetails: (sender: string) => `Neue Bankverbindung von ${sender} – telefonisch bestätigen.`,
  cancellation: (replyBy?:string) => replyBy?'Wir prüfen den Stand und melden uns bis '+replyBy+'.':
    'Wir prüfen den Stand und melden uns.',
  cancellationHint: (order: string, station: string, costs: string|null) =>
    `${order} · ${station}${costs===null?'':` · Materialkosten ${costs}`}`,
} as const;
