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
export const QUOTE_COPY_TEXT={open:'Diesen KV als Vorlage',title:'Du übernimmst die gespeicherten Teile und Preise in einen neuen KV.',date:'Neuer Fertigtermin',missingDate:'Neuen Fertigtermin wählen',confirm:'Neuen KV aus Vorlage anlegen',retry:'Mit gleicher Kennung erneut kopieren',unclear:'Kopierergebnis ungeklärt · mit derselben Kennung erneut versuchen.',source:(number:string)=>'Vorlage · '+number};
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
export const QUOTE_UNDO_COPY={open:"Rückgängig",reason:"Grund der Rücknahme",missing:"Nenne den Grund der Rücknahme.",confirm:"Auftrag zurücknehmen",saved:"Auftrag zurückgenommen · die Ware ist wieder beim KV.",unavailable:(reason:string)=>"Rückgängig nicht mehr möglich · "+reason} as const;
export const QUOTE_RECOVERY_COPY={extend:'Gültig bis verlängern',until:'Neues Gültigkeitsdatum',reason:'Grund / Wortlaut',missing:'Datum und konkreten Grund ergänzen.',extended:'Gültigkeit verlängert · Fassung und vorhandene Zusage bleiben erhalten.',return:(customer:string,location:string)=>'Ware an '+customer+' zurückgeben · '+location,returnConfirm:'Rückgabe mit Beleg bestätigen',returned:'Ware zurückgegeben · der Beleg bleibt im Verlauf.',receipt:'Rückgabebeleg',receiptLine:(quantity:number,location:string,actor:string,at:string)=>quantity+' Stück · '+location+' · '+actor+' · '+at};
export const QUOTE_CYCLE_COPY={
 retainedGoodsBlocked:(reason:string)=>`Die Ware ist gespeichert, aber gesperrt: ${reason}. Kläre die Abweichung an der KV-Ware, dann entsteht der Auftrag.`,
 goodsUnavailable:'KV-Warenannahme konnte nicht sicher bestätigt werden. Eingaben und Kennung behalten.',
 orderRetry:(number:string)=>'Auftrag aus KV '+number+' anlegen',
 orderRetryTask:(number:string)=>'Auftrag aus KV '+number+' anlegen · Ware ist da, der Auftrag fehlt noch',
 orderRetryTaskUnavailable:'Die Erinnerung zum KV konnte nicht angelegt werden · erneut anlegen',
 orderReadbackUnavailable:'Auftrag ist angelegt. Die KV-Ansicht zeigt ihn gleich, lade die Seite in einem Moment neu.',
 editionWarning:(before:number,after:number,customer:string)=>`Du änderst Fassung ${before} zu Fassung ${after} – die Zusage von ${customer} gilt dann nicht mehr. Termin allein ändert nichts.`,
 editionConfirm:'Neue Fassung speichern · Zusage aufheben',
 acceptanceInvalid:(edition:number)=>`Zusage zu Fassung ${edition} ist ungültig · aktuelle Fassung bestätigen lassen`,
 goodsLocation:(location:string)=>'Ware liegt in '+location,
 fromComplaint:(number:string)=>'KV aus Reklamation '+number,complaintCustomerUnavailable:'Der Kunde der Reklamation ist nicht verfügbar · Kundenkarte prüfen.',
 clarify:'Abweichung geklärt',clarificationReason:'Grund der Klärung',clarificationMissing:'Nenne den Grund der Klärung.',clarificationSaved:'Abweichung geklärt · die ursprünglichen Prüfdaten bleiben im Verlauf.',
 discrepancy:(location:string,received:number|null|undefined,total:number|null|undefined,deviations:string[])=>location+' · '+(received??'—')+' von '+(total??'—')+' Packstücke'+(deviations.length?' · '+deviations.join(', '):''),
};
export const QUOTE_COMMERCIAL_SOURCE_COPY={missingVat:'Steuersatz in Firmendaten eintragen'};
