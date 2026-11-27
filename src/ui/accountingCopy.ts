/** One editable invoice-mail draft for the existing customer/order composer. */
export const INVOICE_MAIL_COMPOSER_COPY={
 subject:(number:string,companyName:string)=>`Rechnung ${number} · ${companyName}`,
 body:'Guten Tag,\n\nanbei erhalten Sie Ihre Rechnungsunterlagen.\n\nMit freundlichen Grüßen',
} as const;
export const INVOICE_VAT_COPY={missingCompanyRate:(part:string)=>`Für ${part} fehlt der Steuersatz. Trag ihn in den Einstellungen unter Firmendaten ein.`,missingRate:(part:string)=>`Für ${part} fehlt der Steuersatz (19 % oder 7 %).`,groupNet:(rate:string)=>"Netto ("+rate+")",groupVat:(rate:string)=>"zzgl. USt ("+rate+")",cancelNet:(rate:string)=>"Storno netto ("+rate+")",cancelVat:(rate:string)=>"Storno USt ("+rate+")",reverseCharge:"Steuerschuldnerschaft des Leistungsempfängers",vatId:"USt-IdNr.:"} as const;
/** S54o C15/R8: provisional field wording, pending the PL text batch. */
const E_INVOICE_FIELD_LABELS:Record<string,string>={country:'Land in der Anschrift',serviceDate:'Leistungsdatum',paymentTermDays:'Zahlungsziel',ziel_tage:'Zahlungsziel',skonto_tage:'Skontofrist',skonto_prozent:'Skontosatz',vatId:'USt-IdNr. (mit Ländercode, z. B. DE123456789)',taxId:'USt-IdNr. oder Steuernummer',street:'Straße',postalCode:'PLZ',zip:'PLZ',city:'Ort',companyName:'Firmenname'};
const eInvoiceFieldLabel=(field:string):string=>Object.hasOwn(E_INVOICE_FIELD_LABELS,field)?E_INVOICE_FIELD_LABELS[field]:field;
export const E_INVOICE_COPY={collectionRoutingRetry:'Abrechnung fortsetzen',collectionRoutingPending:'Abrechnung nach Storno fortsetzen – Storno gespeichert',collectionRoutingDone:'Abrechnung nach Storno wieder möglich',collectionChangeUnavailable:'Sammlung unverändert – lade den Auftrag neu.',collectionRemoved:'Auftrag aus der offenen Sammlung entfernt.',invoiceTimeline:(serviceDate:string|null,issuedDate:string,version:number)=>serviceDate===null?`Ausgabe ${issuedDate} · Version ${version}`:`Leistung ${serviceDate} · Ausgabe ${issuedDate} · Version ${version}`,collectionOpenCustomer:'Kunde öffnen',collectionEmpty:'In dieser Sammlung ist noch kein ausgegebener Auftrag.',collectionInvalid:'Sammlung nicht gefunden – wähle sie neu.',collectionUnavailable:'Sammelrechnung noch nicht ausgestellt – versuch es erneut.',collectionConflict:'Sammlung geändert – neu geladen, bestätige erneut.',collectionSourceIncomplete:(order:string,missing:string)=>`Bei Auftrag ${order} fehlt ${missing} – ergänze es vor der Rechnung.`,collectionNotDue:"Die Sammlung ist noch nicht fällig oder wurde inzwischen abgerechnet.",collectionMember:(number:string,date:string)=>`Auftrag ${number} · Leistungsdatum ${date}`,orderInCollection:(month:string,customer:string)=>`Gehört zur Sammelrechnung ${month} für ${customer} – wird dort abgerechnet.`,cashDiscount:(percent:string,days:string,date:string)=>`Bei Zahlung bis ${date} (${days} Tage) erhalten Sie ${percent} % Skonto.`,legacyCancellation:'Diese Rechnung stammt aus der Testphase und kann nicht als E-Rechnung storniert werden.',vatIdLabel:'USt-IdNr.',taxNumberLabel:'Steuernummer',printNotice:'Ausdruck ist für Firmenkunden keine gültige Rechnung · per Mail senden',missingTax:'Fehlt für die E-Rechnung: USt-IdNr. oder Steuernummer · in Einstellungen eintragen',paymentTerms:(days:number,due:string)=>`Zahlungsziel: ${days} Tage netto, fällig am ${due}.`,cancellationTitle:(number:string,original:string)=>`Stornorechnung ${number} zu ${original}`,missingSource:(field:string):string=>field==='paymentTermDays'?'Zahlungsziel fehlt oder ist ungültig – öffne die Firmeneinstellungen.':['ziel_tage','skonto_tage','skonto_prozent'].includes(field)?`${eInvoiceFieldLabel(field)} fehlt oder ist ungültig – öffne den Kunden.`:field==='taxId'?E_INVOICE_COPY.missingTax:field==='rounding'?'Rechnung nicht ausgestellt: Die Positionen ergeben nicht genau den Rechnungsbetrag. Öffne den Auftrag und korrigiere die Preise.':field.startsWith('unit:')?`Fehlt für die E-Rechnung: Einheit bei ${field.slice(5)}`:`Fehlt für die E-Rechnung: ${eInvoiceFieldLabel(field)}`,correctionWithoutRight:(field:string,roles:string[])=>roles.length?`Rechnung nicht ausgestellt: ${field} enthält ein Zeichen, das die E-Rechnung nicht darstellen kann. Korrigieren kann das: ${roles.join(", ")}.`:E_INVOICE_COPY.correctionRolesUnavailable(field),correctionRolesUnavailable:(field:string)=>`Rechnung nicht ausgestellt: ${field} enthält ein Zeichen, das die E-Rechnung nicht darstellen kann. Wende dich an jemanden mit Rechnungsrecht.`,missingGlyph:(field:string,codePoint:number)=>`Rechnung nicht ausgestellt: Das Zeichen U+${codePoint.toString(16).toUpperCase()} in ${field} passt nicht in die E-Rechnung. Ersetze es und stelle die Rechnung neu aus.`} as const;
export const INVOICE_DELIVERY_COPY={manualHandover:'Schon übergeben',alreadyHandedOver:(number:string,date:string)=>`Rechnung ${number} wurde am ${date} übergeben.`,manualHandoverSaved:'Rechnung übergeben – Beleg gespeichert.',manualHandoverFailed:'Übergabe noch nicht gespeichert. Versuch es erneut.',manualHandoverConflict:'Rechnung oder Kennung geändert. Lade die Rechnung neu.',manualHandoverForbidden:'Die Rechnungsübergabe ist für Deinen Login nicht freigegeben.',followupEditBlocked:'Diese Aufgabe folgt dem gespeicherten Rechnungsauftrag.',
 queued:(customer:string)=>`Geht mit der nächsten Rechnungsmail an ${customer} raus`,
 remainderPending:'Weitere Rechnungen senden – Versand noch nicht bestätigt',
 remainderTask:'Weitere Rechnungen senden – Versandbeleg fehlt',
 remainderDone:'Rechnungsauftrag erledigt – kein offenes Original übrig',
 alreadySent:(number:string,date:string)=>`Rechnung ${number} wurde schon am ${date} gesendet.`,
 expectedListMissing:(number:string)=>`Die Liste hat sich geändert – ${number} ist dazugekommen bzw. weggefallen.`,
 listChanged:(number:string,added:boolean)=>`Die Liste hat sich geändert – ${number} ist ${added?'dazugekommen':'weggefallen'}.`,
 'rechnung.senden_sammel':(numbers:readonly string[],customer:string)=>`Rechnungen ${numbers.join(', ')} an ${customer} senden`,
 'rechnung.senden_einzel':(number:string,amount:string,customer:string)=>`Rechnung ${number} über ${amount} an ${customer} senden`
};
/** PL11.11.12:42 / R2; actual part and immutable pricing receipt date. */
const productionPricingDescription=(part:string,day:string)=>`Wochenwert für ${part} nachtragen – Preisbuchung vom ${day} ist gescheitert`;
export const PRODUCTION_PRICING_RETRY_COPY={
 baseTitle:(part:string)=>{const prefix='Wochenwert für ',suffix=' nachtragen';if(prefix.length+part.length+suffix.length<=120)return prefix+part+suffix;let short='';for(const char of part){if(prefix.length+short.length+char.length+suffix.length+1>120)break;short+=char;}return prefix+short+'…'+suffix;},
 baseDescription:(part:string)=>`Wochenwert für ${part} nachtragen - die Fertigmeldung hat noch keinen Preis`,
 description:productionPricingDescription,
 title:(part:string,day:string)=>{
  const full=productionPricingDescription(part,day);if(full.length<=120)return full;
  // R10: preserve every fixed word; shorten only the real placeholder value.
  const room=120-productionPricingDescription('',day).length;let short='';
  for(const char of part){if(short.length+char.length>room-1)break;short+=char;}
  return productionPricingDescription(short+'…',day);
 },
 retry:"Nachtrag erneut auslösen",taskPending:"Wochenwert gespeichert. Die Aufgabe ist noch offen - tippe, um sie abzuschließen."
} as const;
/** PL21:04 CB21:00: keep every original in transport; bound only the text value. */
export const CUSTOMER_INVOICE_ACTION_COPY={numbers:(numbers:readonly string[])=>{
 const all=numbers.join(', ');if(all.length<=120)return all;
 let prefix='';
 for(let i=0;i<numbers.length;i++){const next=prefix?prefix+', '+numbers[i]:numbers[i],suffix=` und ${numbers.length-i-1} weitere`;if(next.length+suffix.length>120)break;prefix=next;}
 if(prefix){const shown=prefix.split(', ').length;return prefix+` und ${numbers.length-shown} weitere`;}
 const suffix=` und ${numbers.length-1} weitere`;let short='';for(const char of numbers[0]){if(short.length+char.length+1+suffix.length>120)break;short+=char;}return short+'…'+suffix;
}} as const;
// R8 S08: PL13.11.23:25.
export const CUSTOMER_CREDIT_COPY={
 payoutLabel:(amount:string,customer:string,method:'bar'|'ueberweisung')=>`${amount} Guthaben an ${customer} ausgezahlt (${method==='bar'?'bar':'Überweisung'})`,
 payoutMethodMissing:'Wie wurde ausgezahlt? Wähle bar oder Überweisung',
 payoutReferenceMissing:'Referenz der Überweisung fehlt – trag Datum und Verwendungszweck ein',
 payoutInvalid:'Betrag oder Nachweis fehlt. Trag beides ein, dann speichere ich die Erstattung.',
 payoutForbidden:'Erstattungen speichern darf nur, wer das Recht Zahlungen & Mahnungen hat.',
 payoutChanged:'Der Erstattungsbetrag oder sein Zahlungsbeleg hat sich geändert. Lade den aktuellen Stand; dein Nachweis bleibt erhalten.',
 methodLabel:'Guthaben',
 applyLabel:(amount:string,number:string)=>`Guthaben ${amount} mit Rechnung ${number} verrechnen`,
 changed:'Das Guthaben oder der Rechnungsrest hat sich geändert. Lade die aktuelle Verrechnung; deine Angaben bleiben erhalten.',
 retryTask:(number:string)=>`Guthaben aus Storno ${number} bilden · die Zahlung ist da, das Guthaben fehlt noch`,
 invalid:'Betrag oder Rechnung fehlt. Trag beides ein, dann verrechne ich das Guthaben.',
 forbidden:'Guthaben verrechnen darf nur, wer das Recht Zahlungen & Mahnungen hat.',
 unavailable:'Das Guthaben ist gerade nicht erreichbar. Deine Angaben bleiben erhalten – versuch es gleich noch einmal.',
 notFound:'Für diesen Kunden gibt es dieses Guthaben nicht mehr. Lade den aktuellen Stand.',
 pending:'Der Storno ist noch nicht übertragen. Er wird gesendet, sobald die Verbindung steht.',
 paymentUnknown:'Die Zahlung zu dieser Rechnung ist nicht vollständig belegt. Erfass zuerst Betrag und Datum der Zahlung, dann storniere die Rechnung erneut.',
 tooHigh:(amount:string)=>`Der Betrag ist höher als das Guthaben von ${amount}.`,
} as const;
export const E_INVOICE_SETTINGS_COPY={
 fieldLabels:{companyName:'Firmenname',street:'Straße',zip:'PLZ',city:'Ort',country:'Land',taxId:E_INVOICE_COPY.vatIdLabel,taxNumber:E_INVOICE_COPY.taxNumberLabel,iban:'IBAN',bic:'BIC',bankName:'Bank',paymentTermDays:'Zahlungsziel in Tagen',logoUrl:'Logo-Pfad'},
 action:(field:string)=>`${eInvoiceFieldLabel(field)} in den Einstellungen eintragen`,
} as const;
export const E_INVOICE_CORRECTION_COPY={
 customerAction:(field:string)=>`${eInvoiceFieldLabel(field)} beim Kunden eintragen`,
 action:(nr:string)=>`Auftrag ${nr} zur Korrektur wieder öffnen`,
 confirmation:(nr:string)=>`Auftrag ${nr} wird wieder geöffnet. Danach Feld korrigieren und erneut fertig melden.`,
 reason:'Rechnungsfeld korrigieren',cancel:'Abbrechen',
 busy:'Auftrag wird wieder geöffnet …',
 done:(nr:string)=>`Auftrag ${nr} ist wieder offen. Korrigiere das Feld und melde ihn erneut fertig.`,
 failed:'Auftrag konnte nicht wieder geöffnet werden. Versuch es gleich noch einmal.',
} as const;
export const INVOICE_SCRAP_COPY = {
  piecesMissing: (position: string) => `Ausschuss ohne Teilezahl bei Position ${position}. Trag die Gesamtzahl der Teile in der Werkstatt nach.`,
} as const;
export const INVOICE_EXTRA_WORK_COPY = { roundingAllowance: 'Abrundung Mehrarbeit' } as const;
