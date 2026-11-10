/** One presentation catalogue. Facts are projections of existing readers, never stored here. */
export const ORDER_TERMINAL_COPY={dateLocked:'Der Auftrag wurde bereits herausgegeben. Du kannst den Liefertermin nicht mehr ändern.'} as const;
export const MAIL_REQUEST_CONFLICT_COPY='Diese Anfragekennung gehört zu einer anderen Nachricht. Öffne den gespeicherten Versand.';
export const INTAKE_PENDING_WORKFLOW_COPY={quoteRequest:'Lege zuerst den KV zur Anfrage an'} as const;
export const SEARCH_NAME_MATCH_COPY={phonetic:'Klingt gleich',spelling:'Ähnliche Schreibweise'} as const;
export const COMPLAINT_ORDER_COPY={notReady:'Du kannst eine Reklamation aufnehmen, sobald die Ware fertig ist oder bereits herausgegeben wurde.',releaseBlocked:(number:string|null)=>`Du kannst die Ware noch nicht herausgeben: ${number?'Reklamation '+number:'Eine Reklamation'} ist offen. Kläre zuerst die Reklamation.`} as const;
export type SituationCommand='open-order'|'receive-quote'|'open-assignment'|'open-task'|'receive-order'|'convert-quote'|'save-blocked-goods'|'prepare-quote'|'preview-quote-change'|'request-photos'|'save-document'|'open-document'|'undo-document'|'undo-order'|'open-quote'|'create-customer';
export type SituationCandidate={id:string;kind:'customer'|'quote'|'order';label:string;reason:string};
export type SituationFacts={originalCount:number;context?:'capture'|'quote';recognizedText?:boolean;actor?:string|null;kind?:'ware'|'anfrage'|'rechnung'|'dokument'|'kontakt'|'notiz'|'unklar';customerId?:string|null;customerName?:string|null;candidates?:SituationCandidate[];recognized?:Array<{label:string;value:string|null|undefined;uncertain?:boolean}>;quote?:{id:string;number:string;customer:string;accepted:boolean;sent:boolean;goodsHere:boolean;location?:string|null;edition:number};match?:'ambiguous'|'chosen'|'unique-reader';requiredComplete?:boolean;document?:{number:string;complete:boolean;missing:string[]};complaint?:{orderNumber:string;photoCount:number};textChange?:{quoteNumber:string};completed?:{kind:'order'|'document';id:string;number:string;quoteNumber?:string;undoAvailable:boolean;booked?:boolean}};
export type SituationPresentation={id:string;phase:'start'|'situation'|'done';title:string;sentence:string;primary:{command:SituationCommand;label:string;id?:string;automatic?:boolean}|null;candidates:SituationCandidate[];chips:Array<{label:string;value:string;uncertain:boolean}>;fallback:{command:SituationCommand;label:string};undo:{command:'undo-order'|'undo-document';label:string;id:string}|null};
export const SITUATION_COPY={header:'Neuer Eingang',original:'Original ansehen',alternatives:'Anders zuordnen',assignment:'Anderen Kunden oder Vorgang wählen',editText:'Text ändern',morePhoto:'Weiteres Foto',readText:'Gelesener Text',task:'Aufgabe anlegen',pendingRead:'Wird gelesen …',pendingSave:'Wird gespeichert …',close:'Schließen',retry:'Erneut',uploadRetry:'Erneut übertragen',back:'Zurück',print:'Drucken',reload:'Erneut laden',kindLabels:{anfrage:'Auftrag/KV',ware:'Ware',rechnung:'Eingangsrechnung',dokument:'Dokument/Notiz zum Kunden',notiz:'Dokument/Notiz zum Kunden'},quote:{send:'KV per E-Mail senden',sendNow:'KV senden',mailSubject:(number:string)=>number,mailMissing:'Betreff und Nachricht ergänzen',mailRetry:'Mit gleicher Kennung erneut senden',loading:'KV wird geladen …',openOrder:'Auftrag öffnen',goods:'Paket kommt an',editDraft:'KV bearbeiten',rejectionReason:'Grund der Absage',chooseRejection:'Grund der Absage wählen',saveRejection:'Absage festhalten',changeQuestion:'Was soll geändert werden?',showChange:'Änderungsvorschlag anzeigen',backToCard:'Zurück zur KV-Karte',newEdition:(edition:number)=>'Fassung '+edition+' anlegen',waitingForGoods:'Sobald die Teile da sind, wird daraus mit einem Klick der Auftrag.',canRecordPhone:'Du kannst die telefonische Zusage festhalten.',phone:(customer:string)=>customer+' hat am Telefon zugesagt',edit:(edition:number)=>'Ändern · Fassung '+edition+' anlegen',reject:(customer:string)=>customer+' sagt ab',customer:'Kunde',parts:'Teile',price:'Preis',hours:'Arbeitszeit',due:'Fertig',edition:'Fassung',wishes:'Wünsche'},goods:{converted:(number:string)=>'Aus '+number+' wurde bereits ein Auftrag angelegt. Du öffnest denselben Auftrag.',labelPhoto:'Paketetikett fotografieren',contentPhoto:'Ware fotografieren',photoReason:'Zustand bei Annahme – hilft bei Rückfragen und Reklamationen',missingContent:(number?:string)=>'Inhalt fotografieren · dann Auftrag'+(number?' aus '+number:'')+' anlegen',missingQuantity:'Stückzahl eintragen',missingLocation:'Lagerplatz eintragen',missingEvidence:'Wortlaut der Zusage eintragen',missingCustomer:'In Kundenkarte ergänzen',location:'Lager vor Galvanik · Regal / Kiste',evidence:'Wortlaut der Zusage',blocked:'Ware gesperrt ablegen',phone:'Telefonische Zusage eintragen',openQuote:'KV öffnen',packaging:'Packstücke',goodCondition:'Unauffällig',deviation:'Abweichung',labelRole:'Etikett',contentRole:'Inhaltsfoto',ware:'Ware',fileRole:(name:string,kind:'uebersicht'|'teile')=>name+' · '+(kind==='uebersicht'?'Etikett':'Inhaltsfoto'),inspection:(condition:string|null,received:number|null,total:number|null)=>(condition==='unauffaellig'?'Unauffällig':'Abweichung')+' · '+(received??'—')+' von '+(total??'—')+' Packstücke'}} as const;
export function intakeStartTitle(actor?:string|null){return actor?.trim()?'Hey '+actor.trim().split(/\s+/u)[0]+', was kann ich für dich tun?':SITUATION_COPY.header;}
export function resolveIntakeSituation(f:SituationFacts):SituationPresentation{
 const base:SituationPresentation={id:'start',phase:'start',title:intakeStartTitle(f.actor),sentence:'',primary:null,candidates:[],chips:[],fallback:{command:'open-assignment',label:SITUATION_COPY.assignment},undo:null};
 if(f.context!=='quote'&&!f.originalCount&&!f.recognizedText&&!f.completed)return base;
 const v={...base,phase:'situation' as const,chips:(f.recognized??[]).filter((value):value is typeof value&{value:string}=>typeof value.value==='string'&&Boolean(value.value.trim())).map(value=>({label:value.label,value:value.value,uncertain:value.uncertain===true}))};
 if(f.completed){const done=f.completed;return {...v,id:'completed-'+done.kind,phase:'done',title:done.kind==='order'?'Erledigt: Auftrag '+done.number+(done.quoteNumber?' aus '+done.quoteNumber:''):'Erledigt: '+done.number+' abgelegt',sentence:done.kind==='order'?'Zusage war da, die Ware ist angekommen – ich habe den Auftrag angelegt.':done.booked?'Erkannt, abgelegt und verbucht.':'Erkannt und abgelegt.',primary:done.kind==='order'?{command:'open-order',label:'Auftrag '+done.number+' öffnen',id:done.id}:{command:'open-document',label:'Beleg ansehen',id:done.id},undo:done.undoAvailable?{command:done.kind==='order'?'undo-order':'undo-document',label:'Rückgängig',id:done.id}:null};}
 if(f.textChange)return {...v,id:'quote-text-change',title:f.textChange.quoteNumber+' per Text ändern',sentence:'Vorher und Nachher stehen nebeneinander. Du übernimmst nur die bestätigte Änderung.',primary:{command:'preview-quote-change',label:'Vorher → Nachher',id:f.textChange.quoteNumber}};
 if(f.complaint&&f.complaint.photoCount===0)return {...v,id:'complaint-no-photos',title:'Reklamation zu '+f.complaint.orderNumber+' · Fotos fehlen',sentence:'Fordere zuerst Fotos an. Ohne Foto wird keine Reklamation angelegt.',primary:{command:'request-photos',label:'Fotos anfordern',id:f.complaint.orderNumber}};
 if(f.document)return {...v,id:f.document.complete?'document-complete':'document-incomplete',title:f.document.complete?'Der Beleg '+f.document.number+' ist vollständig erkannt.':'Zum Beleg '+f.document.number+' fehlen Angaben.',sentence:f.document.complete?'Ich lege den Beleg über den bestehenden Belegweg ab.':'Noch offen: '+f.document.missing.join(', '),primary:{command:f.document.complete?'save-document':'open-document',label:f.document.complete?f.document.number+' ablegen':f.document.missing[0]??'Beleg öffnen',automatic:f.document.complete&&f.requiredComplete===true}};
 const candidates=(f.candidates??[]).filter(candidate=>Boolean(candidate.id&&candidate.label&&candidate.reason)).slice(0,3);
 if(candidates.length>1||f.match==='ambiguous')return {...v,id:'ambiguous',title:candidates.length+' passen gleich gut – tipp den richtigen an.',sentence:'Du wählst den passenden Vorgang. Es wird nichts still zugeordnet.',primary:null,candidates,fallback:{command:'open-task',label:'Ablegen · Zuordnung klären'}};
 if(f.quote){const q=f.quote;if(q.accepted&&!q.goodsHere)return {...v,id:'quote-waits-goods',title:'Zusage übernommen – jetzt fehlt nur die Ware.',sentence:q.number+' · '+q.customer,primary:{command:'receive-quote',label:SITUATION_COPY.quote.goods,id:q.id,automatic:false}};if(q.accepted)return {...v,id:'goods-accepted-quote',title:'Zusage da, Ware da – jetzt nur noch den Auftrag anlegen.',sentence:q.number+' · '+q.customer+' · Fassung '+q.edition,primary:{command:'convert-quote',label:'Auftrag aus '+q.number+' anlegen',id:q.id,automatic:f.match==='unique-reader'&&f.requiredComplete===true}};return {...v,id:'goods-unaccepted-quote',title:q.goodsHere?'Ware ist da – es fehlt nur die Zusage.':q.sent?q.number+' liegt bei '+q.customer+'.':'Du bereitest den KV vor.',sentence:q.location?'Ware liegt gesperrt in '+q.location+'.':q.customer+' hat diese Fassung noch nicht zugesagt.',primary:{command:q.goodsHere?'save-blocked-goods':'receive-quote',label:q.goodsHere?SITUATION_COPY.goods.blocked:SITUATION_COPY.quote.goods,id:q.id},fallback:{command:'open-quote',label:'Bei '+q.customer+' nachfragen'}};}
 if(f.kind==='anfrage')return {...v,id:'quote-request',title:f.customerName?'KV für '+f.customerName+' · aus der Anfrage':'Du hast eine KV-Anfrage aufgenommen.',sentence:'Die Angaben bleiben mit der Anfrage verbunden.',primary:{command:'prepare-quote',label:'KV vorbereiten'}};
 if(f.kind==='kontakt')return {...v,id:'contact',title:'Du hast Kontaktdaten aufgenommen.',sentence:'Der erkannte Kontakt bleibt am Original.',primary:{command:'create-customer',label:'Kunde anlegen'}};
 if(f.kind==='rechnung')return {...v,id:'document-open',title:'Du hast eine Rechnung aufgenommen.',sentence:'Die fehlenden Angaben ergänzt du am Beleg.',primary:{command:'open-document',label:'Rechnung prüfen'}};
 if(f.kind==='ware'||f.kind==='unklar'){const selected=candidates.length===1&&f.customerId?candidates[0]:null;return {...v,id:'goods-no-reference',title:selected?'Ware zu '+selected.label:'Absender nicht erkannt',sentence:selected?selected.reason:'Fotografier das Paketetikett, dann ordne ich sie zu.',primary:selected?.kind==='order'?{command:'receive-order',label:'Ware zu '+selected.label+' annehmen',id:selected.id}:null,candidates:selected?[]:candidates,fallback:{command:'open-task',label:'Ablegen · Absender klären'}};}
 return {...v,id:'note',title:'Vorschlag: als Aufgabe auf deinen Tag',sentence:'Grund: kein Kunde und kein Vorgang im Text. Der Wortlaut bleibt erhalten.',primary:{command:'open-task',label:SITUATION_COPY.task}};
}
export function quoteGoodsPrimary(f:{busy:boolean;retry:boolean;linked:boolean;gap:string|null;existing:boolean;canAccept:boolean;willOrder:boolean;number?:string}){
 if(f.busy)return SITUATION_COPY.pendingSave;if(f.retry)return SITUATION_COPY.retry;if(f.linked)return SITUATION_COPY.quote.openOrder;
 const gaps:Record<string,string>={Etikett:SITUATION_COPY.goods.labelPhoto,Inhalt:SITUATION_COPY.goods.missingContent(f.number),Packstücke:SITUATION_COPY.goods.packaging,Menge:SITUATION_COPY.goods.missingQuantity,Lager:SITUATION_COPY.goods.missingLocation,Zusage:SITUATION_COPY.goods.missingEvidence,Kunde:SITUATION_COPY.goods.missingCustomer,Zuordnung:SITUATION_COPY.goods.openQuote};
 if(f.gap&&gaps[f.gap])return gaps[f.gap];if(f.existing&&!f.willOrder)return f.canAccept?SITUATION_COPY.goods.phone:SITUATION_COPY.goods.openQuote;return f.willOrder?'Auftrag aus '+f.number+' anlegen':SITUATION_COPY.goods.blocked;
}

export function quoteCardSentence(f:{number:string;customer:string;linkedOrder:boolean;declined:boolean;location?:string|null;accepted:boolean;acceptedDate?:string|null;sent:boolean;sentDate?:string|null}){
 return f.linkedOrder?'Aus '+f.number+' ist der Auftrag geworden.':f.declined?f.customer+' hat abgesagt. Es gibt keinen Auftrag.':f.location&&!f.accepted?'Die Ware liegt in '+f.location+' – es fehlt nur die Zusage von '+f.customer+'.':f.accepted?f.customer+' hat '+(f.acceptedDate?'am '+f.acceptedDate+' ':'')+'zugesagt.':f.sent?'Liegt seit '+f.sentDate+' bei '+f.customer+'.':'Du bereitest den KV vor.';
}

/** Read-only projection of canonical quote/order/receipt readers; permission alone never means ready. */
export type QuoteProgressFacts={orderId:string;number:string;version:number;station:string;status:string;ware:string;canStart:boolean;receipts:Array<{status:string;location:string|null;open:string[]}>};
export function quoteProgressPresentation(f:{accepted:boolean;acceptedAt:string|null;sentChannel:string|null;due:string;order:QuoteProgressFacts|null;goodsLocation:string|null}){
 const o=f.order,inspection=o?.receipts.some(r=>(r.status==='angenommen'||r.status==='galvanik')&&r.open.length===0)===true;
 const ready=Boolean(f.accepted&&o&&o.station==='angenommen'&&o.status==='angenommen'&&(o.ware==='da'||o.ware==='teilweise')&&inspection);
 const started=Boolean(o&&o.station==='galvanik');
 const location=o?.receipts.find(r=>r.location)?.location??f.goodsLocation;
 if(!o)return {title:'Stand auf einen Blick',ready:false,started:false,rows:[{done:f.accepted,text:f.accepted?'Zugesagt'+(f.acceptedAt?' am '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(f.acceptedAt)):''):f.sentChannel?'KV beim Kunden · Zusage fehlt noch':'KV noch nicht zugesagt'},{done:Boolean(location),text:location?'Ware im Haus · '+location:'Ware noch nicht da'},...(f.accepted?[{done:false,text:'Auftrag entsteht, sobald die Ware angenommen ist'}]:[]),{done:false,text:'Fertig bis '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(f.due))}],sentence:null,action:null};
 return {title:'Stand auf einen Blick',ready,started,rows:[
 {done:f.accepted,text:f.accepted?'Zugesagt'+(f.acceptedAt?' am '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(f.acceptedAt)):''):'Zusage fehlt'},
 {done:Boolean(o&&(o.ware==='da'||o.ware==='teilweise')||f.goodsLocation),text:location?'Ware im Haus · '+location:o?.ware==='da'?'Ware im Haus':o?.ware==='teilweise'?'Ware teilweise im Haus':'Ware fehlt'},
 {done:Boolean(o),text:o?'Auftrag '+o.number+' angelegt':'Auftrag fehlt'},
 {done:ready||started,text:started?'In der Galvanik':ready?'Freigegeben · kann in die Galvanik':'Freigabe noch offen'},
 {done:false,text:'Fertig bis '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(f.due))}],
 sentence:ready&&o?'Alles bereit – '+o.number+' kann in die Galvanik.':null,
 action:ready&&o?.canStart?o.number+' in die Galvanik nehmen':null};
}

export type IntakeQuoteCandidate={id:string;number:string;customer:string;accepted:boolean;edition:number;goodsHere:boolean;location:string|null};
export function quoteCandidatePresentation(q:IntakeQuoteCandidate){return {id:q.id,kind:'quote' as const,label:q.customer+' · '+q.number,reason:q.accepted?'Zusage zur aktuellen Fassung liegt vor':'Offener KV dieses Kunden · Zusage fehlt'};}

export const QUOTE_PHOTO_COPY={condition:'Ware fotografieren · Zustand bei Annahme',optional:'Zusätzliches Zustandsfoto · optional',desktop:'Öffne die App auf Handy oder Tablet – die Kamera ist dort offen',chooseFile:'Stattdessen Datei wählen',finish:'Fotos übernehmen',cancel:'Foto-Anfrage beenden',qr:'QR-Code für Fotos mit Tablet/Handy',link:'Fotos für den PC öffnen',expired:'Foto-Anfrage abgelaufen · erneut anfordern',count:(n:number)=>n+' Fotos am Eingang'};

export const WORKSHOP_QUOTE_COPY={title:'KV-Ware',filters:{all:'Alle',expected:'Ware erwartet',blocked:'Gesperrt',here:'Ware im Haus'},empty:'Keine KV-Ware in dieser Auswahl.',limited:'Anzeige auf die 100 zuletzt geänderten offenen KVs beschränkt.',open:'KV öffnen',state:(kind:'expected'|'blocked'|'here',locations:string[],reason:string|null)=>kind==='expected'?'Ware erwartet':(kind==='blocked'?'gesperrt':'Ware im Haus')+(locations.length?' · '+locations.join(' / '):'')+(reason?' · '+reason:'')};

export const CAPTURE_COPY={"cancel":"Abbrechen","assign":"Anderen Kunden oder Vorgang wählen","order":"Auftrag oder KV erfassen","file":"Datei wählen","uploadRetry":"Erneut übertragen","retry":"Erneut versuchen","readDone":"Fertig · lesen","done":"Fertig","office":"Fürs Büro speichern","removeContext":"Kontext entfernen","readContext":"Kontext erneut laden","customer":"Kunde anlegen","newPhoto":"Neues Foto","original":"Original ansehen","acceptDevice":"PC möchte Fotos · Öffnen","invoice":"Rechnung prüfen","close":"Schließen","later":"Später zuordnen","anotherPage":"Weitere Seite"} as const;

export const QUOTE_COPY_TEXT={open:'Diesen KV als Vorlage',title:'Du übernimmst die gespeicherten Teile und Preise in einen neuen KV.',date:'Neuer Fertigtermin',missingDate:'Neuen Fertigtermin wählen',confirm:'Neuen KV aus Vorlage anlegen',retry:'Mit gleicher Kennung erneut kopieren',unclear:'Kopierergebnis ungeklärt · mit derselben Kennung erneut versuchen.',source:(number:string)=>'Vorlage · '+number};


export const CONCERN_COPY={title:'Du findest Nachricht und nächsten Schritt zusammen.',intro:'Nachricht, Kundendaten und Handlung bleiben beieinander.',categories:{kv:'KV',reklamation:'Reklamation',termin:'Termine',belege:'Belege',sonstiges:'Sonstiges'},categoryLabel:'Anliegenarten',missingSubject:'Betreff fehlt',missingCustomer:'Kunde noch nicht zugeordnet',missingSender:'Absender noch nicht zugeordnet',mail:'E-Mail',yourTurn:'Du bist dran',continued:'weitergeführt',openQuote:'KV öffnen',prepareQuote:'KV aus Nachricht öffnen',openMessage:'Nachricht öffnen',original:'Originalnachricht',missingText:'Nachrichtentext fehlt',empty:'Hier ist momentan kein Anliegen.',sentence:(quote:boolean,bound:boolean)=>quote?(bound?'Dein KV und die Nachricht bleiben zusammen. Öffne den gespeicherten Stand.':'Du kannst den KV aus dieser Nachricht vorbereiten. Die Angaben bleiben mit dem Original verknüpft.'):'Du findest die Nachricht und den bisherigen Verlauf am selben Ort.'};

export const QUOTE_PREPARATION_COPY={original:'Original dieser KV-Anfrage',wishes:'Bestätigte Hinweise aus Kunde und Anfrage',openFile:(name:string)=>name+' · Original ansehen',unavailable:'Original konnte nicht geöffnet werden · INTAKE_ORIGINAL_TARGET_NOT_MOUNTED.'};

export const QUOTE_CHANGE_COPY={saveDate:(accepted:boolean)=>accepted?'Termin ändern · Zusage bleibt gültig':'Termin ändern · Fassung bleibt gültig',dateSaved:(accepted:boolean)=>accepted?'Termin geändert · Fassung und Zusage bleiben gültig.':'Termin geändert · Fassung bleibt gültig.',draftSaved:'KV-Entwurf gespeichert.',comparison:'Vorher → Nachher',dateComparison:(before:string,after:string)=>'Fertig · '+before+' → '+after,quantityComparison:(name:string,before:number,after:number)=>name+' · '+before+' → '+after,priceComparison:(before:string,after:string)=>'Preis netto · '+before+' → '+after,editionSaved:'KV geändert · neue Fassung sicher gespeichert.'};

export const QUOTE_REPLY_COPY={title:'Antwort zu diesem KV',accept:'Zusage aus dieser Antwort übernehmen',conditional:'Vorbehalt aus dieser Antwort festhalten',reject:'Absage aus dieser Antwort übernehmen',amend:'Änderung aus dieser Antwort vorbereiten',missing:'Wortlaut der Antwort fehlt',tooLong:'Wortlaut ist zu lang · Nachricht öffnen und den entscheidenden Abschnitt bestätigen.',accepted:'Zusage aus der Antwort gespeichert · Ware erwartet.',conditionalSaved:'Vorbehalt gespeichert · KV anpassen, Ware bleibt gesperrt.',rejected:'Absage aus der Antwort gespeichert · kein Auftrag angelegt.',original:'Originalantwort',sourceUnavailable:'Originalantwort konnte nicht geöffnet werden.'};
export function quoteReplyPresentation(concerns:string[],text:string|null){
 if(concerns.includes('kv_ablehnung'))return {action:'reject' as const,sentence:'Du hältst die Absage aus dieser Antwort fest.',primary:QUOTE_REPLY_COPY.reject};
 if(concerns.includes('kv_annahme')||concerns.includes('preis_einwand')){
  const conditional=concerns.includes('preis_einwand')||/\baber\b|vorbehalt/iu.test(text??'');
  return conditional?{action:'conditional' as const,sentence:'Die Antwort nennt einen Vorbehalt. Du passt den KV an, bevor daraus ein Auftrag wird.',primary:QUOTE_REPLY_COPY.conditional}:{action:'accept' as const,sentence:'Du übernimmst die Zusage zur aktuellen Fassung aus dieser Antwort.',primary:QUOTE_REPLY_COPY.accept};
 }
 if(concerns.includes('aenderung'))return {action:'amend' as const,sentence:'Du bereitest die Änderung aus dieser Antwort vor.',primary:QUOTE_REPLY_COPY.amend};
 return null;
}

export const QUOTE_REPLY_PICKER_COPY={title:'Du wählst den KV zu dieser Antwort.',sentence:(name:string)=>'Die Antwort gehört zu '+name+'. Öffne den passenden gespeicherten KV.',search:'KV-Nummer oder Teil eingrenzen',reason:(name:string)=>'Offener KV des zugeordneten Kunden '+name,empty:'Kein passender KV in der gelesenen Auswahl.',more:(n:number)=>n+' KVs in der Auswahl · bitte Nummer oder Teil eingrenzen.',limited:'Die Quelle enthält die 100 zuletzt geänderten offenen KVs. Die Auswahl ist begrenzt.',assignment:'Kundenzuordnung öffnen',unavailable:'KVs zur Antwort konnten nicht sicher gelesen werden.'};

export const QUOTE_CANCELLED_ORDER_COPY={title:'Auftrag zurückgenommen',explanation:'Dieser Auftrag ist storniert. Er bleibt mit seinem Rücknahmegrund im Verlauf erhalten.',customer:'Kundenkarte öffnen',quote:(number:string|null)=>number?number+' öffnen':'KV öffnen',reason:'Grund',actor:'Zurückgenommen von'};

export const QUOTE_UNDO_COPY={open:"Rückgängig",reason:"Grund der Rücknahme",missing:"Nenne den Grund der Rücknahme.",confirm:"Auftrag zurücknehmen",saved:"Auftrag zurückgenommen · die Ware ist wieder beim KV.",unavailable:(reason:string)=>"Rückgängig nicht mehr möglich · "+reason} as const;

export const QUOTE_RECOVERY_COPY={extend:'Gültig bis verlängern',until:'Neues Gültigkeitsdatum',reason:'Grund / Wortlaut',missing:'Datum und konkreten Grund ergänzen.',extended:'Gültigkeit verlängert · Fassung und vorhandene Zusage bleiben erhalten.',return:(customer:string,location:string)=>'Ware an '+customer+' zurückgeben · '+location,returnConfirm:'Rückgabe mit Beleg bestätigen',returned:'Ware zurückgegeben · der Beleg bleibt im Verlauf.',receipt:'Rückgabebeleg',receiptLine:(quantity:number,location:string,actor:string,at:string)=>quantity+' Stück · '+location+' · '+actor+' · '+at};

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
export const QUOTE_CYCLE_COPY={
 editionWarning:(before:number,after:number,customer:string)=>`Du änderst Fassung ${before} zu Fassung ${after} – die Zusage von ${customer} gilt dann nicht mehr. Termin allein ändert nichts.`,
 editionConfirm:'Neue Fassung speichern · Zusage aufheben',
 acceptanceInvalid:(edition:number)=>`Zusage zu Fassung ${edition} ist ungültig · aktuelle Fassung bestätigen lassen`,
 goodsLocation:(location:string)=>'Ware liegt in '+location,
 fromComplaint:(number:string)=>'KV aus Reklamation '+number,complaintCustomerUnavailable:'Der Kunde der Reklamation ist nicht verfügbar · Kundenkarte prüfen.',
 clarify:'Abweichung geklärt',clarificationReason:'Grund der Klärung',clarificationMissing:'Nenne den Grund der Klärung.',clarificationSaved:'Abweichung geklärt · die ursprünglichen Prüfdaten bleiben im Verlauf.',
 discrepancy:(location:string,received:number|null|undefined,total:number|null|undefined,deviations:string[])=>location+' · '+(received??'—')+' von '+(total??'—')+' Packstücke'+(deviations.length?' · '+deviations.join(', '):''),
};

export const ORDER_HANDOVER_COPY={
 chooseOrder:"Wähle den Auftrag zu dieser Mail",choose:(number:string)=>"Übergabe für "+number+" übernehmen",
 mode:(mode:'pickup'|'shipping')=>mode==='pickup'?'Abholen':'Versand',
 label:(mode:'pickup'|'shipping'|null|undefined,service:string|null|undefined,error?:string)=>mode==='pickup'?'Abholen':mode==='shipping'?'Versand · '+(service??error??'Versanddienst fehlt'):'Übergabeart fehlt',
 original:'Original-Mail ansehen',task:'Rückruf-Aufgabe öffnen',completed:'Rückruf erledigt',taskUnavailable:'Rückruf-Aufgabe ist für diesen Login nicht verfügbar.',targetUnavailable:'Der gespeicherte Bezug konnte nicht geöffnet werden.',
 changed:(number:string,mode:'pickup'|'shipping',sender:string,at:string)=>'Du übernimmst '+(mode==='pickup'?'Abholen':'Versand')+' für '+number+' · so hat es '+sender+' am '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(at))+' geschrieben.',
 call:(customer:string,phone:string|null)=>'Ruf '+customer.slice(0,55)+' an: '+(phone??'Telefon fehlt'),
 late:(number:string,customer:string,phone:string|null,carrier:string|null,mode:'pickup'|'shipping',label:boolean,passed:boolean)=>number+' · '+(passed?'Ware ist bereits übergeben':label?'Versandetikett ist bereits erstellt':'Paket ist bereits beim '+(carrier??'Versanddienst · Name fehlt'))+' · '+customer+' wollte '+(mode==='pickup'?'abholen':'Versand')+'. Ruf '+customer+' an: '+(phone??'Telefon fehlt')+'.',
};

const PACKAGE_UNAVAILABLE_COPY='Erwartete Ware konnte nicht sicher gelesen werden · Original bleibt erhalten.';
export const PACKAGE_COPY={waiting:'wartet auf Ware',rework:'Nacharbeit-Rücksendung erwartet',candidateTitle:'Von wem ist die Ware?',customer:(name:string)=>name+' · Kunde auswählen',history:'Dieses Teil gab es zuletzt bei',unavailable:PACKAGE_UNAVAILABLE_COPY};

export const PACKAGE_ONSITE_COPY={partial:(name:string,nr:string)=>'Kunde '+name+' und KV '+nr+' sind angelegt - korrigiere Ware/Menge und lege den Auftrag an.',openCustomer:'Kundenkarte öffnen',openQuote:'KV öffnen',discardDraft:'Entwurf verwerfen',discardReason:'Grund für das Verwerfen',discardReasonMissing:'Nenne den Grund. Das Original bleibt erhalten.',reload:'Stand neu lesen',conflict:'Der Vorgang wurde inzwischen ge\u00e4ndert. Lies den Stand neu und buche dann.',received:'Angenommene Menge',positions:'Positionen',partName:'Teil / Leistung',surface:'Oberfläche',price:'Preis',labelPhoto:'Paketetikett als Original',contentPhoto:'Inhaltsfoto als Original',packages:'Angenommene Packstücke',condition:'Zustand',customer:'Kunde',missingFields:(fields:readonly string[])=>'Es fehlen noch: '+fields.join(', ')+'.',blocked:(code:string,fields:readonly string[]=[])=>code==='VALIDATION_ERROR'?'Es fehlen noch: '+(fields.length?fields.join(', '):'bestätigte Warenangaben')+'.':code==='FORBIDDEN'?'Dir fehlt die Berechtigung. Du kannst den Entwurf mit Grund verwerfen.':code==='CONFLICT'?'Der gespeicherte Stand passt nicht mehr. Lies ihn neu oder verwirf den Entwurf mit Grund.':'Der Ausgang ist noch nicht bestätigt. Versuche es mit derselben Kennung erneut.',deviationReason:'Abweichungsgrund',savedDraft:'Paket-Entwurf gespeichert · unter „Der Tag“ fortsetzen',award:'Die Zusage auf dem Beilagzettel ist bestätigt',title:'Du ergänzt Kunde und Zusage zu diesem Paket.',open:'Kunde, Zusage und Ware übernehmen',confirm:'Auftrag anlegen',close:'Zurück zur Erfassung',pending:'Wird angelegt …',retry:'Mit gleicher Kennung erneut buchen',saved:(nr:string)=>'Wareneingang gebucht · '+nr,failed:'Nicht gespeichert · alle Eingaben sind noch da · ',source:'Wortlaut auf dem Beilagzettel',due:'Bestätigter Fertigtermin',location:'Lager vor Galvanik',choose:'Bitte wählen',missing:'Fehlende Angaben ergänzen; Original und Entwurf bleiben erhalten.',duplicate:'Vorhandenen Kunden wählen oder bestätigen, dass keiner passt.',chooseCustomer:(name:string)=>name+' · übernehmen',newConfirmed:'Keiner davon · neuen Kunden erfassen',readFailed:'Kundensuche nicht verfügbar · es wurde nichts angelegt.',draftMissing:'Entwurf konnte nicht sicher gespeichert werden · es wurde nichts angelegt.',handover:'Übergabe',pickup:'Abholung',shipping:'Versand',payment:'Zahlungsmodus',advance:'Vorkasse',cash:'Bar oder Karte bei Abholung',invoice:'Rechnung',otherCustomer:'Anderen Kunden wählen',frozen:'Der Buchungsversuch bleibt mit derselben Kennung gespeichert. Angaben werden bis zur Klärung nicht verändert.'} as const;

export const QUOTE_POSITION_COPY={title:'Positionen',position:(n:number)=>'Position '+n,remove:(n:number)=>'Position '+n+' entfernen',name:'Teil / Leistung',placeholder:'Katalog oder Freitext',quantity:'Menge',material:'Material',surface:'Oberfläche',choose:'Bitte wählen',unit:'Einheit',price:'Preis netto (€)',add:'Position hinzufügen'} as const;
export const PACKAGE_ASSIGN_COPY={notConnected:'Kundenzuordnung ist nicht verbunden · Original bleibt erhalten.',changed:'Kunde wurde inzwischen zugeordnet · neu lesen.',failed:'Zuordnung nicht bestätigt · Original und Auswahl bleiben erhalten.',unavailable:PACKAGE_UNAVAILABLE_COPY} as const;
export const QUOTE_COMMERCIAL_SOURCE_COPY={missingVat:'Steuersatz in Firmendaten eintragen'};
export const CUSTOMER_LOOKUP_COPY={invalidId:'Gib eine gültige Kundenkennung an.',invalidQuery:'Gib einen Suchbegriff als Text ein.'} as const;
export const GOODS_OUT_DEBT_COPY = {
  overrideRecorded: 'Du hast die Ware trotz der Kundensperre herausgegeben.',
  reasonMissing: 'Nenne den Grund, warum Du die Ware trotz der überfälligen Rechnung herausgibst.',
  overrideForbidden: 'Du brauchst das Recht „Entscheiden“, um die Ware trotz der Kundensperre herauszugeben.',
  noLongerBlocked: 'Die Kundensperre ist aufgehoben. Lies den Auftrag neu und gib die Ware ohne Ausnahme heraus.',
  blocked: (invoiceNumber?: string) => invoiceNumber
    ? `Du kannst die Ware noch nicht herausgeben: Rechnung ${invoiceNumber} ist überfällig. Buche zuerst die Zahlung.`
    : 'Du kannst die Ware noch nicht herausgeben: Eine Rechnung des Kunden ist überfällig. Lass die Zahlung im Büro buchen.',
} as const;
export const ORDER_ITEM_PHOTO_COPY={required:'Nimm für jedes Teil ein Foto auf, bevor Du den Auftrag fertig meldest.'} as const;
export const CUSTOMER_METRICS_COPY={classificationMissing:'Grenzen für die Einstufung eintragen'} as const;
export const MANUAL_SHIPPING_FIELDS={name:'Name / Firma',street:'Straße',houseNumber:'Hausnummer',zipCode:'PLZ',city:'Ort',country:'Land',phone:'Telefon',email:'E-Mail',reference:'Referenz'} as const;
export const MANUAL_SHIPPING_HANDOVER_LABEL='Paket mit manuell übernommener Sendungsnummer übergeben';
export const MANUAL_SHIPPING_COPY={
 SHIPPING_FORBIDDEN:'Du hast für diesen Versand keine Freigabe.',ORDER_ID_INVALID:'Wähle den Auftrag erneut.',ORDER_NOT_FOUND:'Der Auftrag ist nicht verfügbar. Lade ihn erneut.',
 ORDER_NOT_SHIPPING:'Dieser Auftrag wird abgeholt. Öffne die Abholkarte.',SHIPPING_SETTINGS_MISSING:'Trag den Versanddienst in den Einstellungen ein.',
 MANUAL_SHIPPING_READ_FAILED:'Die Versanddaten konnten nicht geladen werden. Versuch es erneut.',TRACKING_INPUT_INVALID:'Prüf die Sendungsnummer und öffne das Paket erneut.',
 TRACKING_KEY_CONFLICT:'Diese Buchungskennung gehört zu einer anderen Änderung. Lade das Paket erneut.',TRACKING_PATTERN_INVALID:'Korrigiere das Nummernmuster in den Versand-Einstellungen.',TRACKING_PATTERN_MISSING:'Trag das Nummernmuster in den Versand-Einstellungen ein. Die Nummer bleibt ungebucht.',
 TRACKING_FORMAT_CONFIRMATION_REQUIRED:'Die Nummer sieht nicht nach dem eingestellten Versanddienst aus. Du kannst sie ausdrücklich trotzdem übernehmen.',
 SHIPPING_RELEASE_BLOCKED:'Das Paket darf noch nicht raus. Öffne die Zahlung oder die Ausgabesperre am Auftrag.',TRACKING_ALREADY_ASSIGNED:'Die Nummer gehört schon zu einem anderen Paket. Öffne dieses Paket.',
 SHIPMENT_CHANGED:'Das Paket wurde inzwischen geändert. Lade es neu; deine Nummer bleibt zum Abgleichen erhalten.',SHIPMENT_ALREADY_RELEASED:'Das Paket wurde bereits übergeben oder storniert. Die Nummer bleibt im Verlauf.',
 TRACKING_CHANGE_REASON_REQUIRED:'Gib an, warum du die Sendungsnummer änderst.',MANUAL_TRACKING_WRITE_FAILED:'Die Nummer konnte nicht gespeichert werden. Versuch es mit derselben Buchungskennung erneut.',
 SHIPPING_ADDRESS_INCOMPLETE:'Ergänze die fehlende Lieferanschrift in der Kundenkarte. Die Sendungsnummer bleibt ungebucht.',
 SHIPMENT_PROVIDER_LABEL_EXISTS:'Das Paket hat schon ein Etikett vom Versanddienst. Storniere es über den bestehenden Etikettweg, bevor du die Nummer ersetzt.',
 SHIPMENT_CARRIER_CHANGED:'Der Versanddienst des Pakets weicht von den Einstellungen ab. Öffne das Paket und kläre den Versanddienst vor der Änderung.'
} as const;
export const DISPATCH_NOTICE_COPY={legacyCollective:(orders:readonly string[])=>'Deine fertigen Aufträge: '+orders.join(', '),collective:(orders:readonly string[])=>'Ihre fertigen Aufträge: '+orders.join(', ')};
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
export const STORAGE_CHARGE_COPY={name:'Lagergeld',unit:'Woche',forbidden:'Für den Lagergeldbetrag brauchst Du die Freigabe für Geld. Die übrigen Angaben bleiben erhalten.'};
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
export const ORDER_ITEM_COMPLETION_COPY = {
  alreadyChanged: 'Der Teilstatus hat sich bereits geändert. Öffne den Auftrag erneut.',
};

export const INVOICE_DELIVERY_COPY={
 alreadySent:(number:string,date:string)=>`Rechnung ${number} wurde schon am ${date} gesendet.`,
 expectedListMissing:(number:string)=>`Die Liste hat sich geändert – ${number} ist dazugekommen bzw. weggefallen.`,
 listChanged:(number:string,added:boolean)=>`Die Liste hat sich geändert – ${number} ist ${added?'dazugekommen':'weggefallen'}.`,
 'rechnung.senden_sammel':(numbers:readonly string[],customer:string)=>`Rechnungen ${numbers.join(', ')} an ${customer} senden`,
 'rechnung.senden_einzel':(number:string,amount:string,customer:string)=>`Rechnung ${number} über ${amount} an ${customer} senden`
};

export const GOODS_OUT_FOLLOWUP_COPY={incomplete:(order:string)=>`Erinnerungsbeleg zu ${order} unvollständig – Übergabe ist gespeichert`};

/** PL K8: customer-facing originals use Sie; absent facts remove the whole sentence. */
export type CollectionCustomerFacts={name?:string|null;company?:string|null;members:Array<{number:string;quantity?:number|null;finishedDate?:string|null;e1Date?:string|null;e2Date?:string|null;callDate?:string|null}>;deadline?:string|null;storageAmount?:string|null;storageUnit?:string|null;openAmount?:string|null};
const customerDay=(value:string|null|undefined)=>value&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10).split('-').reverse().join('.'):null;
export const CUSTOMER_COLLECTION_COPY={
 'kunde.abholung.e1':{subject:(order:string)=>'Abholbereit: '+(order.includes(', ')?'Aufträge ':'Auftrag ')+order},
 'kunde.abholung.e2':{subject:(order:string)=>'Erinnerung: Auftrag '+order+' wartet auf Abholung'},
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
  const financial=stage==='E4'?CUSTOMER_COLLECTION_COPY['kunde.abholung.lagergeld_satz'](facts.storageAmount,facts.storageUnit):CUSTOMER_COLLECTION_COPY['kunde.zahlung_zeile'](facts.openAmount);if(financial)lines.push(financial);
  if(facts.company?.trim())lines.push('Mit freundlichen Grüßen '+facts.company.trim());
  const key=stage==='E1'?'kunde.abholung.e1':stage==='E2'?'kunde.abholung.e2':'kunde.abholung.lagerfrist';return {subject:CUSTOMER_COLLECTION_COPY[key].subject(facts.members.map(member=>member.number).join(', ')),body:lines.join('\n\n')};
 }
};
