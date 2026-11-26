import {LEGACY_ACTION_ACCESS_COPY} from './allgemeinCopy';
export const ORDER_TERMINAL_COPY={dateLocked:'Der Auftrag wurde bereits herausgegeben. Du kannst den Liefertermin nicht mehr ändern.'} as const;
export const ORDER_TERM_COPY = {
  deliveryDate: "Liefertermin",
  missingLeadTime: (leistung: string) => `Durchlaufzeit für ${leistung} fehlt`,
  label: "Termin",
  settings: {
    betriebsruhe: "die Betriebsruhe",
    terminschwelle: "die Terminschwelle",
    both: "die Betriebsruhe und die Terminschwelle",
  },
  settingsMissing: (einstellung: string) => `Die Terminbewertung fehlt. Hinterlege ${einstellung} in den Firmeneinstellungen.`,
  notRecorded: "Nicht erfasst",
  status: {
    ueberfaellig: "Kritisch / Überfällig",
    knapp: "Gefährdet",
    im_plan: "Im Plan",
    unbekannt: "Termin nicht erfasst",
  },
  blocked: {statusText:"Wartet auf Freigabe", dueLabel:"Wartet auf", dueValue:"Freigabe"},
  dueToday: "Heute fällig",
  dueIn: (tage: number) => `Fällig in ${tage} ${tage===1?'Arbeitstag':'Arbeitstagen'}`,
  overdueSince: (tage: number) => `Überfällig seit ${tage} ${tage===1?'Arbeitstag':'Arbeitstagen'}`,
} as const;
export const QUOTE_CANCELLED_ORDER_COPY={title:'Auftrag zurückgenommen',explanation:'Dieser Auftrag ist storniert. Er bleibt mit seinem Rücknahmegrund im Verlauf erhalten.',customer:'Kundenkarte öffnen',quote:(number:string|null)=>number?number+' öffnen':'KV öffnen',reason:'Grund',actor:'Zurückgenommen von'};
export const ORDER_HANDOVER_COPY={
 permission:LEGACY_ACTION_ACCESS_COPY.forbidden,invalid:'Diese Übergabeart passt nicht zum Auftrag. Wähle Abholen oder Versand.',missing:'Wähle Abholen oder Versand für diesen Auftrag.',
 conflict:'Der Auftrag wurde inzwischen geändert. Lade den aktuellen Stand und wähle die Übergabe erneut.',unavailable:'Die Übergabeart ist noch nicht gespeichert. Versuch es gleich noch einmal – deine Auswahl bleibt stehen.',
 manualChanged:(number:string,mode:'pickup'|'shipping')=>mode==='pickup'?`${number} wird jetzt abgeholt.`:`${number} geht jetzt in den Versand.`,
 chooseOrder:"Wähle den Auftrag zu dieser Mail",choose:(number:string)=>"Übergabe für "+number+" übernehmen",
 mode:(mode:'pickup'|'shipping')=>mode==='pickup'?'Abholen':'Versand',
 label:(mode:'pickup'|'shipping'|null|undefined,service:string|null|undefined,error?:string)=>mode==='pickup'?'Abholen':mode==='shipping'?'Versand · '+(service??error??'Versanddienst fehlt'):'Übergabeart fehlt',
 original:'Original-Mail ansehen',task:'Rückruf-Aufgabe öffnen',completed:'Rückruf erledigt',taskUnavailable:'Rückruf-Aufgabe ist für diesen Login nicht verfügbar.',targetUnavailable:'Der gespeicherte Bezug konnte nicht geöffnet werden.',
 changed:(number:string,mode:'pickup'|'shipping',sender:string,at:string)=>'Du übernimmst '+(mode==='pickup'?'Abholen':'Versand')+' für '+number+' · so hat es '+sender+' am '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(at))+' geschrieben.',
 call:(customer:string,phone:string|null)=>{
  const phoneValue=phone===null?'Telefon fehlt':phone.length>80?phone.slice(0,79)+'…':phone;
  const limit=Math.min(55,120-'Ruf '.length-' an: '.length-phoneValue.length);
  const name=customer.length>limit?customer.slice(0,limit-1)+'…':customer;
  return 'Ruf '+name+' an: '+phoneValue;
 },
 late:(number:string,customer:string,phone:string|null,carrier:string|null,mode:'pickup'|'shipping',label:boolean,passed:boolean)=>number+' · '+(passed?'Ware ist bereits übergeben':label?'Versandetikett ist bereits erstellt':'Paket ist bereits beim '+(carrier??'Versanddienst · Name fehlt'))+' · '+customer+' wollte '+(mode==='pickup'?'abholen':'Versand')+'. Ruf '+customer+' an: '+(phone??'Telefon fehlt')+'.',
};
export const ORDER_ITEM_PHOTO_COPY={required:'Nimm für jedes Teil ein Foto auf, bevor Du den Auftrag fertig meldest.'} as const;
export const ORDER_CONTENT_COPY = {
  catalogMissing: 'Diese Katalogleistung gibt es nicht mehr · wähl eine aus der Liste.',
  catalogInactive: (name:string)=>`Die Katalogleistung ${name} ist nicht mehr aktiv · wähl eine andere.`,
  invoiceAlreadyIssued: (nummer: string) => `Rechnung ${nummer} ist schon ausgestellt. Korrigiere zuerst die Rechnung.`,
  extraWorkApprovalUnavailable: "Die Zusage zur Mehrarbeit konnte nicht gespeichert werden. Versuche es erneut.",
  workTimeChanged: "Die Arbeitszeit wurde inzwischen schon korrigiert. Lade die Buchungen neu.",
};
export const ORDER_ITEM_COMPLETION_COPY = {
  alreadyChanged: 'Der Teilstatus hat sich bereits geändert. Öffne den Auftrag erneut.',
  forbidden: 'Diese Rolle darf den Teilstatus nicht ändern.',
  invalid: 'Teilstatus ist ungültig.',
};
export const ORDER_SCRAP_COPY = {
  allParts: "Alle Teile sind Ausschuss. Leg in der Auftragskarte fest, ob du reklamierst oder nacharbeitest.",
  task: "Alle Teile Ausschuss – Reklamation oder Nacharbeit festlegen",
  conflict: "Die Ausschuss-Aufgabe gehört zu einem anderen Auftrag. Lade die Auftragskarte neu.",
} as const;
/** PL11.11.17:05: shared wording for conflicting request identities. */
export const ORDER_REQUEST_COPY={intentConflict:"Anfragekennung wurde bereits anders verwendet."} as const;
export const ORDER_STATION_COPY:Readonly<Record<string,string>>={wareneingang:'Angenommen',angenommen:'Angenommen',galvanik:'In Galvanik',fertig:'Fertig',raus:'Raus / abgeholt',abgeholt:'Raus / abgeholt',versendet:'Raus / abgeholt',unknown:'Station nicht erfasst'};
export const ORDER_BUENDEL_LAUF_COPY = {
  started: (oberflaeche: string) => `${oberflaeche}-Lauf gestartet`,
  completed: (oberflaeche: string) => `${oberflaeche}-Lauf abgeschlossen`,
  itemOccupied: "Wähle ein anderes Teil. Dieses Teil gehört bereits zu einem offenen Bündel-Lauf.",
  itemsNoLongerOpen: "Lade die Werkstatt neu. Mindestens ein Teil des Bündel-Laufs ist nicht mehr offen.",
  runNotFound: "Wähle den Lauf erneut in der Werkstatt. Dieser Bündel-Lauf wurde nicht gefunden.",
} as const;
