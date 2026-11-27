import {LEGACY_ACTION_ACCESS_COPY} from './allgemeinCopy';
// PL14Nov18:09: one payment line per real existing invoice payment.
export const DELIVERY_NOTE_COPY={title:'Lieferschein',date:'Datum:',order:'Auftrag',description:'Beschreibung',quantity:'Anzahl Teile',payment:(date:string,amount:string)=>`Bezahlt am ${date}: ${amount}`,invalid:'Wähle den Auftrag erneut.',sourceMissing:'Für diesen Auftrag ist noch keine Rechnung bezahlt. Öffne die Zahlung am Auftrag.',changed:'Die Zahlung hat sich geändert. Lade den Auftrag neu und erzeuge den Lieferschein erneut.',unavailable:'Geht nur mit Netz'} as const;
export const DELIVERY_NOTE_SOURCE_COPY={companyMissing:'Firmendaten fehlen. Trag sie in den Einstellungen ein.',addressMissing:(field:string)=>`${field} fehlt beim Kunden. Trag es in den Kundendaten ein.`,mixedCustomers:'Ein Lieferschein gilt für einen Kunden. Wähle nur dessen Aufträge.',orderChanged:'Der Auftrag hat sich geändert. Lade ihn neu und erzeuge den Lieferschein erneut.',handoverSignature:'Übergabe (Firma)',takeoverSignature:'Übernahme (Kunde)',handoverNote:(zeit:string,name:string)=>`Übergeben am ${zeit} an ${name}`,phone:'Tel:'} as const;
export const GOODS_OUT_DEBT_COPY = {
  overrideRecorded: 'Du hast die Ware trotz der Kundensperre herausgegeben.',
  reasonMissing: 'Nenne den Grund, warum Du die Ware trotz der überfälligen Rechnung herausgibst.',
  overrideForbidden: 'Du brauchst das Recht „Entscheiden“, um die Ware trotz der Kundensperre herauszugeben.',
  noLongerBlocked: 'Die Kundensperre ist aufgehoben. Lies den Auftrag neu und gib die Ware ohne Ausnahme heraus.',
  blocked: (invoiceNumber?: string) => invoiceNumber
    ? `Du kannst die Ware noch nicht herausgeben: Rechnung ${invoiceNumber} ist überfällig. Buche zuerst die Zahlung.`
    : 'Ausgabe gesperrt – Rechnung offen',
} as const;
export const MANUAL_SHIPPING_FIELDS={name:'Name / Firma',street:'Straße',houseNumber:'Hausnummer',zipCode:'PLZ',city:'Ort',country:'Land',phone:'Telefon',email:'E-Mail',reference:'Referenz'} as const;
export const MANUAL_SHIPPING_HANDOVER_LABEL='Paket mit manuell übernommener Sendungsnummer übergeben';
export const MANUAL_SHIPPING_COPY={
 SHIPPING_FORBIDDEN:'Du hast für diesen Versand keine Freigabe.',ORDER_ID_INVALID:'Wähle den Auftrag erneut.',ORDER_NOT_FOUND:'Der Auftrag ist nicht verfügbar. Lade ihn erneut.',
 ORDER_NOT_SHIPPING:'Dieser Auftrag wird abgeholt. Öffne die Abholkarte.',SHIPPING_SETTINGS_MISSING:'Trag den Versanddienst in den Einstellungen ein.',
 MANUAL_SHIPPING_READ_FAILED:'Die Versanddaten konnten nicht geladen werden. Versuch es erneut.',TRACKING_INPUT_INVALID:'Prüf die Sendungsnummer und öffne das Paket erneut.',
 TRACKING_NUMBER_MISSING:'Sendungsnummer fehlt – trag sie ein',
 TRACKING_KEY_CONFLICT:'Diese Buchungskennung gehört zu einer anderen Änderung. Lade das Paket erneut.',TRACKING_PATTERN_INVALID:'Korrigiere das Nummernmuster in den Versand-Einstellungen.',TRACKING_PATTERN_MISSING:'Trag das Nummernmuster in den Versand-Einstellungen ein. Die Nummer bleibt ungebucht.',
 TRACKING_FORMAT_CONFIRMATION_REQUIRED:'Die Nummer sieht nicht nach dem eingestellten Versanddienst aus. Du kannst sie ausdrücklich trotzdem übernehmen.',
 SHIPPING_RELEASE_BLOCKED:'Das Paket darf noch nicht raus. Öffne die Zahlung oder die Ausgabesperre am Auftrag.',TRACKING_ALREADY_ASSIGNED:'Die Nummer gehört schon zu einem anderen Paket. Öffne dieses Paket.',
 SHIPMENT_CHANGED:'Das Paket wurde inzwischen geändert. Lade es neu; deine Nummer bleibt zum Abgleichen erhalten.',SHIPMENT_ALREADY_RELEASED:'Das Paket wurde bereits übergeben oder storniert. Die Nummer bleibt im Verlauf.',
 TRACKING_CHANGE_REASON_REQUIRED:'Gib an, warum du die Sendungsnummer änderst.',MANUAL_TRACKING_WRITE_FAILED:'Die Nummer konnte nicht gespeichert werden. Versuch es mit derselben Buchungskennung erneut.',
 SHIPPING_ADDRESS_INCOMPLETE:'Ergänze die fehlende Lieferanschrift in der Kundenkarte. Die Sendungsnummer bleibt ungebucht.',
 SHIPMENT_PROVIDER_LABEL_EXISTS:'Das Paket hat schon ein Etikett vom Versanddienst. Storniere es über den bestehenden Etikettweg, bevor du die Nummer ersetzt.',
 SHIPMENT_CARRIER_CHANGED:'Der Versanddienst des Pakets weicht von den Einstellungen ab. Öffne das Paket und kläre den Versanddienst vor der Änderung.'
} as const;
export const DISPATCH_NOTICE_COPY={invoiceRequestSnapshot:'Rechnungen für deinen Versandauftrag festgehalten',nativeCollective:(orders:readonly string[])=>'Sammelrechnungen zu Ihren Aufträgen: '+orders.join(', '),legacyCollective:(orders:readonly string[])=>'Deine fertigen Aufträge: '+orders.join(', '),collective:(orders:readonly string[])=>'Ihre fertigen Aufträge: '+orders.join(', ')};
export const DELIVERY_FAILURE_COPY={
 recorded:'Unzustellbarkeit aus gesichertem Mail-Original belegt',
 forbidden:'Für dieses Mail-Original brauchst Du die Freigabe für Eingang und Mails.',
 unclear:'Das Original ist gesichert. Ordne die Rückmeldung der ursprünglichen Ausgangsmail zu; ich rate die Zuordnung nicht.',
 assignment:'Das Original ist einem anderen Vorgang zugeordnet. Öffne es und kläre die Zuordnung zur Ausgangsmail.',
 unavailable:'Das Original bleibt erhalten. Die Unzustellbarkeit konnte ich noch nicht belegen; öffne es oder versuche den Abgleich erneut.'
};
export const PICKUP_APPOINTMENT_COPY={
 invalid:'Trage den vereinbarten Abholtermin mit dem aktuellen Auftragsstand ein. Deine Eingaben bleiben erhalten.',
 changed:'Der Fertig-Stand oder der Abholtermin hat sich geändert. Öffne den Auftrag erneut; Deine Eingaben bleiben erhalten.',
 forbidden:'Für den Abholtermin brauchst Du die Freigabe für Aufträge.',
 unavailable:'Der Abholtermin konnte nicht sicher gespeichert werden. Deine Eingaben bleiben erhalten; versuche es erneut.',
 recorded:(date:string)=>'Abholtermin vereinbart '+date,
};
export const STORAGE_CHARGE_COPY={name:'Lagergeld',unit:'Woche',forbidden:'Für den Lagergeldbetrag brauchst Du das Recht Zahlungen & Mahnungen. Die übrigen Angaben bleiben erhalten.'};
export const DISPATCH_CALL_COPY={
 title:'Ruf den Kunden wegen seiner fertigen Ware an',note:'Sprich mit dem Kunden über diese fertigen Aufträge: ',
 created:'Gemeinsamer Anruf zu fertiger Ware vorbereitet',resultRecorded:'Ergebnis des gemeinsamen Anrufs festgehalten',
 resultMissing:'Halte fest, ob Du den Kunden erreicht hast. Deine Notiz bleibt erhalten.',
 resultConflict:'Für diesen Anruf ist bereits ein anderes Ergebnis gespeichert. Öffne die Aufgabe erneut.',
 changed:'Der nächste Schritt hat sich geändert. Lies die fertigen Aufträge neu ein.',
 notCall:'Diese Aufgabe gehört nicht zur Anrufstufe. Schließe sie über ihren normalen Weg ab.',
 preserve:'Dieser Anruf hält die gemeinsamen Aufträge zusammen. Halte Dein Ergebnis beim Erledigen fest.',
 cohortChanged:'Die fertigen Aufträge haben sich geändert. Öffne den gemeinsamen Anruf aus der Fertig-Liste erneut.',
 goodsGone:'Die Ware ist bereits übergeben. Der Anruf zur Abholung entfällt.',
 forbidden:'Für diesen Schritt brauchst Du die Freigabe für Aufträge und beim Vorbereiten auch Mails.',
 unavailable:'Der Anruf konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten; versuche es erneut.',
 session:'Melde Dich erneut an; Deine Eingaben bleiben erhalten.',invalid:'Öffne den Anruf aus der Liste der fertigen Aufträge erneut.'
};
export const COLLECTION_REMINDER_COPY={
  moneyRequired:(customer:string,roles:string)=>'Schreiben an '+customer+' enthält Beträge – senden kann '+roles,
  letterTitle:'Lagerfrist-Schreiben',
  letterDraft:'Entwurf · noch nicht versendet',
  letterDeadline:(date:string)=>'Die zugesagte Lagerfrist endet am '+date.split('-').reverse().join('.')+'.',
  letterBody:(numbers:readonly string[],days:number|null)=>'Deine Aufträge '+numbers.join(', ')+' sind fertig. Bitte melde Dich bei uns, damit wir die Übergabe abstimmen können.'+(days===null?'':' Die Frist ab dem Datum dieses Schreibens beträgt '+days+' Arbeitstage nach unserem Betriebskalender.'),
  letterAddressMissing:'Ergänze die Postanschrift in der Kundenkarte. Dein Schreiben wurde noch nicht vorbereitet.',
  letterSenderMissing:'Ergänze Name und Postanschrift der Firma in den Einstellungen. Dein Schreiben wurde noch nicht vorbereitet.',
  postalTaskTitle:(name:string)=>'Lagerfrist-Schreiben an '+(name.length>55?name.slice(0,54)+'…':name)+' drucken und per Post senden',
  postalTaskNote:(address:readonly string[],numbers:readonly string[])=>address.join('\n')+'\n\n'+numbers.join(', '),
  postalDateMissing:'Bestätige das tatsächliche Versanddatum und das Original-PDF. Die Lagerfrist läuft noch nicht.',
  postalNotTask:'Dieses Ergebnis gehört zu keiner Postaufgabe.',
  postalProtected:'Druckauftrag und Original bleiben zusammen. Verwirf das Schreiben mit Grund und bereite es danach neu vor.',
  postalMailPresent:'Für diesen Kunden ist eine E-Mail-Adresse eingetragen. Nutze den vorhandenen Mailversand oder korrigiere die Kundenkarte.',
  finalTaskTitle:'Lagergeld oder Einlagerung vorschlagen',
  finalTaskNote:(numbers:readonly string[])=>'Lagerfrist-Schreiben zu '+numbers.join(', ')+' · Lagergeld nur als Positionsvorschlag; noch nichts berechnet.',
  finalRecipientMissing:'Empfänger für die letzte Stufe eintragen.',
  finalTaskProtected:'Diese Aufgabe gehört zum Lagerfrist-Schreiben. Empfänger und Auftragsbezug bleiben erhalten.',
  finalTaskGoodsGone:'Die Ware ist bereits übergeben. Die Lageraufgabe entfällt.',
 forbidden:'Sammelerinnerung benötigt Mails und Aufträge sowie einen Kundenbezug.',
 invalid:'Erinnerungsstufe, Frist oder Versandkennung fehlt.',
 unavailable:'Aufträge oder Fristen konnten nicht sicher gelesen werden.',
 notReady:'Diese Erinnerung ist nicht freigegeben: Bescheid, Antwort oder Frist ist noch offen. Lies den aktuellen Ausgang neu.',
 holdUnavailable:'Der zeitversetzte Rückhalte-Versand ist noch nicht angeschlossen. Es wurde nichts gesendet.',
 keyConflict:'Die Versandkennung ist bereits anders belegt.',
 unclear:'Dieser Versand ist ungeklärt. Gleiche Ausgangsmail abgleichen, nicht erneut senden.',
 proofUnavailable:'Der Original-Versandbeleg konnte nicht sicher gelesen werden.',
 preparedConflict:'Die Sammelerinnerung wurde bereits vorbereitet oder der Auftrag hat sich geändert. Lies den aktuellen Ausgang neu.',
};
export const GOODS_OUT_FOLLOWUP_COPY={incomplete:(order:string)=>`Erinnerungsbeleg zu ${order} unvollständig – Übergabe ist gespeichert`};
export const COLLECTION_FOLLOWUP_COPY={pendingHistory:'Sammelzuordnung offen – Übergabe gespeichert',repairedHistory:'Sammelzuordnung nachgeholt – ursprüngliche Übergabe belegt',task:(order:string)=>`Sammelzuordnung für ${order} nachholen – Übergabe gespeichert`,retry:'Sammelzuordnung nachholen',editBlocked:'Sammelzuordnung wird über den ursprünglichen Übergabebeleg nachgeholt.'};
/** PL K8: customer-facing originals use Sie; absent facts remove the whole sentence. */
export type CollectionCustomerFacts={name?:string|null;company?:string|null;members:Array<{number:string;quantity?:number|null;finishedDate?:string|null;e1Date?:string|null;e2Date?:string|null;callDate?:string|null}>;deadline?:string|null;storageAmount?:string|null;storageUnit?:string|null;openAmount?:string|null};
const customerDay=(value:string|null|undefined)=>value&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10).split('-').reverse().join('.'):null;
export const CUSTOMER_COLLECTION_COPY={
 'kunde.abholung.e1':{subject:(order:string)=>'Abholbereit: '+(order.includes(', ')?'Aufträge ':'Auftrag ')+order},
 'kunde.abholung.e2':{subject:(order:string)=>order.includes(', ')?'Erinnerung: Aufträge '+order+' warten auf Abholung':'Erinnerung: Auftrag '+order+' wartet auf Abholung'},
 'kunde.abholung.lagerfrist':{subject:(order:string)=>'Lagerfrist für Ihre Teile aus '+(order.includes(', ')?'den Aufträgen ':'Auftrag ')+order},
 'kunde.abholung.lagergeld_satz':(amount?:string|null,unit?:string|null)=>amount&&unit?'Danach berechnen wir Lagergeld von '+amount+' je '+unit+'.':'',
 'kunde.zahlung_zeile':(amount?:string|null)=>amount?'Offen sind '+amount+'; bitte bringen Sie den Betrag zur Abholung mit.':'',
 'notiz.abholung.antwort':(customer:string,date:string)=>customer+' hat am '+customerDay(date)+' geantwortet – Anruf und Brief entfallen.',
 'notiz.abholung.termin':(customer:string,date:string)=>'Abholtermin '+customerDay(date)+' mit '+customer+' vereinbart – Anruf und Brief entfallen.',
 render:(stage:'E1'|'E2'|'E4',facts:CollectionCustomerFacts)=>{
  const lines:string[]=[];if(facts.name?.trim())lines.push('Guten Tag '+facts.name.trim()+',');
  const collective=facts.members.length>1,numbers=facts.members.map(member=>member.number).join(', ');
  if(collective)lines.push('Ihre Teile aus den Aufträgen '+numbers+(stage==='E2'?' warten auf Abholung.':' sind fertig und liegen zur Abholung bereit.'));
  for(const member of collective?[]:facts.members){const day=customerDay(member.finishedDate),quantity=member.quantity;
   if(member.number&&day&&quantity!=null&&Number.isFinite(quantity)&&quantity>0)lines.push('Ihre '+quantity+' Teile aus Auftrag '+member.number+(stage==='E1'?' sind fertig und liegen seit '+day+' zur Abholung bereit.':stage==='E2'?' liegen seit '+day+' bei uns.':' liegen seit '+day+' zur Abholung bereit.'));
  }
  if(stage==='E4'){
   const shared=(key:'e1Date'|'e2Date'|'callDate')=>{const dates=facts.members.map(member=>customerDay(member[key]));return dates.length&&dates[0]&&dates.every(date=>date===dates[0])?dates[0]:null;};
   const e1=shared('e1Date'),e2=shared('e2Date'),call=shared('callDate');
   if(e1&&e2)lines.push('Wir haben Sie am '+e1+' und '+e2+' erinnert'+(call?' und am '+call+' versucht, Sie telefonisch zu erreichen.':'.'));
  }
  if(stage==='E2')lines.push('Bitte holen Sie sie ab oder antworten Sie auf diese Mail mit einem Abholtermin.');
  const deadline=customerDay(facts.deadline);if(stage==='E4'&&deadline)lines.push('Bitte holen Sie die Teile bis '+deadline+' ab.');
  const payment=CUSTOMER_COLLECTION_COPY['kunde.zahlung_zeile'](facts.openAmount);if(payment)lines.push(payment);
  const storage=stage==='E4'?CUSTOMER_COLLECTION_COPY['kunde.abholung.lagergeld_satz'](facts.storageAmount,facts.storageUnit):'';if(storage)lines.push(storage);
  if(facts.company?.trim())lines.push('Mit freundlichen Grüßen '+facts.company.trim());
  const key=stage==='E1'?'kunde.abholung.e1':stage==='E2'?'kunde.abholung.e2':'kunde.abholung.lagerfrist';return {subject:CUSTOMER_COLLECTION_COPY[key].subject(facts.members.map(member=>member.number).join(', ')),body:lines.join('\n\n')};
 }
};
// S09: package text is fixed; additional failure copy stays in the same catalog (R8).
export const SHIPPING_FEE_COPY={
 proposalMissing:(number:string,invoice:boolean,reason:'freigabe'|'einstellungen'|'original'|'quelle')=>`Versandvorschlag für ${invoice?'Rechnung':'Auftrag'} ${number.length>24?number.slice(0,23)+'…':number} fehlt: ${{freigabe:'Freigabebeleg fehlt',einstellungen:'Versandangaben fehlen',original:'Originalbeleg ist unklar',quelle:'Quelle nicht lesbar'}[reason]}.`,
 orderQuoteMissing:(number:string)=>`Preisbeleg zu Auftrag ${number.length>24?number.slice(0,23)+'…':number} ist nicht lesbar.`,
 noAdditionalInvoiceNeeded:'Versandkosten sind 0 € – keine Zusatzrechnung nötig',
 groupAlreadyCharged:(number:string,other:string)=>`${number} und ${other} sind schon einzeln mit Versand berechnet – verschick sie getrennt.`,
 reissueReleaseBlocked:(number:string)=>`Stell zuerst die Rechnung zu ${number} ohne Versand neu aus – dann kann die Ware raus.`,
 reissue:(number:string)=>`Rechnung ${number} stornieren und ohne Versand neu ausstellen`,
 reissueReason:'Übergabeart Versand → Abholung',
 reissueForbidden:LEGACY_ACTION_ACCESS_COPY.forbidden,
 reissuePending:'Der Storno ist gespeichert, das Guthaben steht. Die neue Rechnung ohne Versand fehlt noch – dafür liegt eine Aufgabe am Auftrag.',
 reissueTaskPending:'Der Storno ist gespeichert. Die Aufgabe für die neue Rechnung ohne Versand wird noch angelegt – versuch es gleich noch einmal.',
 reissueTaskCompletionPending:'Die neue Rechnung ohne Versand ist ausgestellt. Die Aufgabe dazu wird gleich abgeschlossen.',
 reissueUnpaidPending:'Der Storno ist gespeichert. Die Rechnung war unbezahlt, es entsteht kein Guthaben. Die neue Rechnung ohne Versand fehlt noch – dafür liegt eine Aufgabe am Auftrag.',
 reissueTask:(number:string)=>`Rechnung zu ${number} ohne Versand neu ausstellen`,
 additional:(amount:string,customer:string)=>`Versandkosten ${amount} netto an ${customer} berechnen`,
 relatedInvoice:(number:string)=>`Versandkosten zu Rechnung ${number}`,
 changed:'Versandkosten neu berechnet – die Rechnung zeigt den aktuellen Stand.',
 line:'Versand',
 inInvoice:(number:string)=>`Versand in Rechnung ${number}`,
 included:'Versand enthalten',
 includedChanged:'Versand im KV geändert. Ein schon gesendeter KV bekommt dafür eine neue Fassung.',
 missing:'Versandpauschale fehlt in den Einstellungen – trag sie dort ein',
 invalid:'Der Versandpreis muss ein Betrag ab 0,00 € sein. Leer heißt: kein Standard.',
 forbidden:'Die Versandpauschale ändert nur, wer das Recht Preise & Rechnungen hat.',
} as const;
export const SHIPMENT_GROUP_COPY={
 // PL14.11.19:13; the unavailable copy is the existing goods-out failure text.
 invalid:'Wähle die Sendung erneut.',changed:'Die Sendung hat sich geändert. Lade sie neu und bestätige sie noch einmal.',
 confirmGroup:'Diese Aufträge gehen zusammen raus. Öffne die Versanddaten und bestätige die Sendung.',
 blocked:(order:string,reason:string)=>`${order}: ${reason}`,
 unavailable:'Warenausgang konnte nicht sicher gebucht werden.'
};
