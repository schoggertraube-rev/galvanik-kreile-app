/** PL13.11.00:14 immutable invoice VAT display. */
/** Existing evidence-read wording, shared by the original and visibility read. */
export const EVIDENCE_READ_COPY={unavailable:'Nachweise konnten nicht sicher geladen werden.'} as const;
export const EVIDENCE_VISIBILITY_COPY={
 invalid:'Wähle das Foto erneut.',missing:'Das Foto ist nicht mehr da. Lade den Auftrag neu.',
 forbidden:'Die Sichtbarkeit von Fotos darfst du nicht ändern.',conflict:'Das Foto wurde gerade geändert. Lade es neu und wähle die Sichtbarkeit noch einmal.',
 save:'Die Sichtbarkeit ist nicht gespeichert. Versuch es erneut.',
 cancelled:(order:string)=>`Auftrag ${order} ist storniert – die Foto-Freigabe entfällt.`,
 toCustomer:'Für Kunden sichtbar machen',toInternal:'Nur intern zeigen',
 customerHistory:(name:string)=>`Foto ${name} für Kunden freigegeben`,
 internalHistory:(name:string)=>`Foto ${name} auf intern gesetzt`,
 retryTask:(name:string)=>`Sichtbarkeit von Foto ${name} erneut speichern`,
} as const;
/** PL13.11.00:14 deferred sales-stage sources. */
export const DEFERRED_LEGACY_COPY={unavailable:"Kommt nach dem Start dazu - bis dahin ausgeschaltet."} as const;
/** Existing compatibility denial text, now shared by canonical area gates. */
export const LEGACY_ACTION_ACCESS_COPY={forbidden:"Keine Berechtigung für diese Aktion."} as const;
export const PIN_LOGIN_COPY={unavailable:'Anmeldung gerade nicht möglich – wir sind dran.',incomplete:'Anmeldung konnte nicht sicher abgeschlossen werden.',blocked:(time:string)=>`Zu viele Versuche. Versuch es um ${time} wieder.`} as const;
export const MAIL_REQUEST_CONFLICT_COPY='Diese Anfragekennung gehört zu einer anderen Nachricht. Öffne den gespeicherten Versand.';
export const ACTOR_COPY={
 unreadable:'Zuständigkeit gerade nicht lesbar - lade den Auftrag neu.',reload:'Neu laden',
 assignmentError:(code:string)=>code==='CONFLICT'?'Der Auftrag wurde geändert. Du siehst jetzt den aktuellen Stand.':code==='FORBIDDEN'?'Du darfst die Zuständigkeit für diesen Auftrag nicht ändern.':code==='NOT_FOUND'?'Du kannst diesen Auftrag nicht mehr aufrufen.':code==='VALIDATION_ERROR'?'Der Auftrag hat sich inzwischen geändert. Lade ihn neu und übernimm ihn dann.':'Du kannst die Zuständigkeit gerade nicht laden oder speichern. Versuche es erneut.',
 missingCase:'Für diesen Vorgang fehlt ein belegtes Anlageereignis.',
 received:(name:string,at:string)=>'Eingang erfasst von '+name+' · '+at,
 created:(name:string,at:string)=>'Angelegt von '+name+' · '+at,
 last:(name:string,action:string)=>'Zuletzt: '+name+' · '+action,
 responsible:(name:string)=>'Zuständig: '+name,unassigned:'Noch niemand zuständig',
 missing:'Für diesen Auftrag fehlt ein belegtes Anlageereignis.',unknownLogin:'Loginname nicht mehr verfügbar',
 take:'Übernehmen',mine:'Deins',saving:'Deine Zuständigkeit wird gespeichert.',taken:'Du hast den Auftrag übernommen.',failed:'Du hast den Auftrag noch nicht übernommen. Tippe noch einmal auf Übernehmen.',
 action:(type:string,kind:'order'|'quote'|'complaint'='order')=>type==='rechnung.erfassen'?'Rechnung erfasst':type==='rechnung.unklar'?'Rechnung zur Klärung abgelegt':type==='rechnung.status'?'Rechnung geändert':type==='rechnung.klaeren'?'Rechnung geklärt':type==='INTAKE:angelegt'?'Eingang angelegt':type==='INTAKE:original_gespeichert'?'Original gesichert':type==='INTAKE:zugeordnet'?'Kunde zugeordnet':type==='INTAKE:umgehaengt'?'Zuordnung geändert':type.startsWith('INTAKE:')?'Eingang bearbeitet':type==='QUOTE_LIFECYCLE_V04:accept'?'Zusage übernommen':type==='QUOTE_LIFECYCLE_V04:sent'?'KV gesendet':type==='QUOTE_LIFECYCLE_V04:extend'?'Gültigkeit verlängert':type==='QUOTE_CREATED_V1'?'KV angelegt':type==='COMPLAINT_CHANGED_V1:aufnehmen'?'Reklamation aufgenommen':type==='COMPLAINT_CHANGED_V1:entscheiden'?'Reklamation entschieden':type==='ORDER_TASK_ASSIGNED_V1'?'Zuständigkeit übernommen':type==='ORDER_INTAKE_CREATED_V1'?'Auftrag angelegt':type==='ORDER_PROMISED_DUE_DATE_CHANGED_V1'?'Termin geändert':type.includes('PAYMENT')?'Zahlung erfasst':type.includes('PICKED_UP')?'Ware ausgegeben':type.includes('FROZEN')?'Fertig gemeldet':kind==='quote'?'KV geändert':kind==='complaint'?'Reklamation geändert':'Auftrag geändert',
 mail:(sender:string)=>'Mail von '+sender,
};
export const MAIL_RESEND_COPY={
 canceledCompleted:(customer:string)=>`Storno an ${customer} gesendet`,
 confirm:(customer:string)=>'Mail an '+customer+' erneut senden – nicht im Postausgang gefunden',
 canceledTask:(invoice:string,customer:string)=>{
  const prefix='Storno an ',suffix=' senden – Rechnung '+invoice+' kam trotz Storno an';
  const space=120-Array.from(prefix+suffix).length;
  if(space<1)throw Error('INVOICE_TASK_TITLE_NO_CUSTOMER_SPACE');
  const name=Array.from(customer);
  return prefix+(name.length>space?name.slice(0,space-1).join('')+'…':customer)+suffix;
 },
 canceledTaskDescription:(invoice:string,customer:string,sentAt:string|null)=>'Kunde: '+customer+'\nRechnung: '+invoice+'\nSendezeit: '+(sentAt?new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'medium',timeZone:'Europe/Berlin'}).format(new Date(sentAt)):'nicht belegt'),
 canceled:(invoice:string)=>'Rechnung '+invoice+' ist storniert – Versand nicht mehr nötig'
};
export const MANAGED_USER_COPY={forbidden:"Nutzer dürfen nicht geändert werden."} as const;
/** Owner 19.11.: literal vorfinal source copy, separate from frozen V45 flows. */
export const VORFINAL_COPY = {
  "vorfinal.kopf.plus.label": "Neuer Eingang",
} as const;
/** S19 component inspection, never a simulated domain command. */
export const COMPONENT_PREVIEW_COPY={
 title:'Bausteine · TEST',notice:'TEST-Vorschau: Hier wird nichts gespeichert oder verschickt.',
 component:'Baustein',state:'Darstellung',normal:'Normal',loading:'Laden',disabled:'Deaktiviert',
 source:'Auftrag',open:'Auftrag öffnen',refresh:'Neu laden',
 missing:'Wähle einen TEST-Auftrag aus der Auftragsliste.',
 unavailable:'Die Quelle ist nicht lesbar. Lade sie erneut.',
 unbound:'Der Fachbefehl wird im zugehörigen Bereich verbunden.',
 noFact:'Diese Angabe ist nicht belegt.',draft:'Deine Eingabe bleibt nur in dieser Vorschau.',
 overlay:'Dialog öffnen',field:'Deine Eingabe',history:'Belegter Verlauf',
 errors:{offline:'Kein Netz',server:'Server nicht erreichbar',conflict:'Stand geändert',permission:'Recht fehlt',
  empty:'Keine Daten',mailbox:'Postfach nicht erreichbar',send_unknown:'Versand noch unklar',save:'Speichern fehlgeschlagen'},
 names:{hauptaktion:'Hauptaktion',vertiefung:'Vertiefung',verlauf:'Verlauf',formularfeld:'Formularfeld',
 lage:'Lage',suchtreffer:'Suchtreffer',fehler:'Fehler',werkstattkachel:'Werkstattkachel',teilchip:'Teilchip',
 zeit:'Arbeitszeit',overlay:'Dialog',mehrarbeit:'Mehrarbeit',kundenbild:'Kundenbild',
 kv_dokument:'KV-Dokument',kv_verlauf:'KV-Verlauf',eingang:'Eingang'},
} as const;
/** U-291: local cancellation is not a confirmed server reversal. */
export const PENDING_UNDO_COPY={title:'Wartende Aktionen',undo:'Rückgängig',
 count:(count:number)=>`${count} Aktionen warten`,
 remaining:'Zeit für Rückgängig',pending:'Wartet auf Übertragung',started:'Übertragung gestartet',
 unknown:'Deine wartenden Änderungen sind gerade nicht lesbar.',
 unconfirmed:'Rückgängig wurde nicht bestätigt. Lade den aktuellen Stand.',
} as const;
export const SURFACE_ASSIGNMENT_COPY={
 open:'Oberfläche zuordnen',
 title:(value:string,number:string)=>{
  const suffix=`“ in Auftrag ${number} zuordnen`,limit=90-'Oberfläche „'.length-suffix.length;
  return `Oberfläche „${value.length>limit?value.slice(0,Math.max(0,limit-1))+'…':value}${suffix}`;
 },
 proposal:(label:string)=>`Als ${label} zuordnen`,
} as const;
/** PL20.11 L1: operating limits in the existing company settings. */
export const DIALOG_LOAD_COPY={unavailable:'Der Dialog hat sich nicht geladen – lade die Seite neu.',mailUnavailable:'Die Mailansicht hat sich nicht geladen – lade die Seite neu.',reload:'Neu laden'} as const;
/** PLAN_LADEZEIT E3: only stale model facts use these refresh messages. */
export const TODAY_MODEL_COPY={homeTitle:'Der Tag',cardRefreshing:'Diese Karte holt sich gerade den neuesten Stand.',reload:'Jetzt laden',mainRefreshing:'Ich hole gerade den neuesten Stand – dein nächster Schritt erscheint gleich.',rebuildButton:'Startseite neu aufbauen',rebuildRunning:'Ich baue die Startseite gerade neu auf – das dauert ein paar Sekunden.',rebuildDone:'Die Startseite ist neu aufgebaut.'} as const;
export const PAGE_READ_COPY={orderIncomplete:(number:string)=>`Auftrag ${number} ist gerade nicht lesbar · öffne den Auftrag.`,loading:"Deine Arbeitsfläche wird geladen.",sourceIncomplete:"Diese Quelle ist gerade nicht erreichbar · Erneut laden.",qualificationUnknown:"Den Status kann ich gerade nicht laden.",partial:"Ein Teil der Aufträge fehlt noch · Deine übrigen Aufgaben bleiben sichtbar.",reload:"Erneut laden",settingsPending:"Die neuen Abfragewerte sind noch nicht verfügbar.",timeout:"Abfragezeit in Millisekunden",mailBatch:"Rechnungen je Versandtakt",invalid:"Abfragezeit und Versandgrenze brauchen ganze Zahlen größer null.",refreshLeaseInvalid:(seconds:number)=>`Du kannst die Nachlauf-Frist nur zwischen 1 und ${seconds} Sekunden speichern.`,refreshLeaseTooLong:(seconds:number)=>`Du kannst die Nachlauf-Frist auf höchstens ${seconds} Sekunden setzen.`} as const;
export const TODAY_WEEK_COPY={
 title:'Diese Woche fertig',
 open:'Diese Woche fertig – Liste öffnen',
 header:(amount:string)=>'Diese Woche fertig: '+amount,
 close:'Schließen',
 workshop:'Werkstatt',
 total:'Fertig gemeldeter Auftragswert',
 since:'seit Montag',
 workday:'Werkstatttag',
 daily:'Tageswert',
 running:'Wochenstand',
 graph:'Tagesmeldungen und kumulierter Auftragswert',
  weekPositions:'Fertigmeldungen dieser Woche',
  dayPositions:(day:string)=>'Fertigmeldungen · '+day,
  throughPositions:(day:string)=>'Fertigmeldungen bis '+day,
  noPositions:'Keine Daten',
  unvalued:'Unbewertet',
 method:'Berechnungsgrundlage',
 today:'bis jetzt',
 source:'Die Summe enthält die Nettowerte der Fertigmeldungen seit Montag. Heute fertig gemeldete Aufträge fließen in den heutigen Tageswert ein.',
 methodBody:'Die Wochenübersicht übernimmt die Tageswerte der Fertigmeldungen. Heute neu fertig gemeldete Aufträge fließen mit ihrem Nettowert in den laufenden Tag ein. Zahlungseingänge werden separat erfasst.',
} as const;
export const KREILE_KOPF_KUERZEL = 'GK';

/** Wortlaut der Eingabewähler aus dem eingefrorenen Owner-Design. */
export const FELDWAHL_COPY = {
  datum: 'Datum', uhrzeit: 'Uhrzeit', wert: 'Wert direkt eingeben',
  abbrechen: 'Abbrechen', ausserhalb: 'Dieser Wert liegt außerhalb des verfügbaren Bereichs.',
  vorherigerMonat: 'Vorheriger Monat', naechsterMonat: 'Nächster Monat',
  stunden: 'Stunden', minuten: 'Minuten',
  groesser: (einheit: string) => einheit + ' erhöhen',
  kleiner: (einheit: string) => einheit + ' verringern',
  zeitWaehlen: (wert: string) => wert + ' wählen',
  zeitEinsetzen: (wert: string) => wert + ' Uhr ins Formular einsetzen',
  ziffern: 'Ziffern', komma: 'Dezimalkomma', loeschen: 'Letzte Stelle löschen',
  tastatur: 'Gerätetastatur', leeren: 'Leeren', uebernehmen: 'Wert übernehmen',
  plus: 'Um einen Schritt erhöhen', minus: 'Um einen Schritt verringern',
} as const;
