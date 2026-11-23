export type StoredEmailTemplate={id:string;key:string;name:string;subject:string;body:string|null;updatedAt:string};
export const COMPLAINT_RESULT_TEMPLATE='reklamation_ergebnis';
export const COMPLAINT_GOODS_TEMPLATE='nacharbeit_begleitschein';
export const COMPLAINT_RESULT_VARIABLES=['Kunde','RK-Nummer','Ergebnis','Begründung'] as const;
export const MEHRARBEIT_FREIGABE_VORLAGE='mehrarbeit_freigabe';
export const MEHRARBEIT_VORLAGE_FELDER=['Auftragsnummer','Betrag','Grenze','Begründung','Absender'] as const;

function renderVorlagenfelder(text:string,werte:Readonly<Record<string,string>>) {
  return text.replace(/\{([^{}]+)\}/gu,(_match,key:string)=>{
    if(!Object.hasOwn(werte,key))throw Error('EMAIL_TEMPLATE_VARIABLE_UNKNOWN');
    return werte[key];
  });
}

export function renderComplaintGoodsTemplate(text:string,values:Record<'Kunde'|'Auftragsnummer'|'RK-Nummer',string>){
  return renderVorlagenfelder(text,values);
}

export function renderComplaintResultTemplate(text:string,values:Record<typeof COMPLAINT_RESULT_VARIABLES[number],string>){
  return renderVorlagenfelder(text,values);
}

export function renderMehrarbeitVorlage(text:string,werte:Record<typeof MEHRARBEIT_VORLAGE_FELDER[number],string>){
  return renderVorlagenfelder(text,werte);
}

export function pruefeMehrarbeitVorlage(betreff:string,nachricht:string):void {
  const werte=Object.fromEntries(MEHRARBEIT_VORLAGE_FELDER.map(feld=>[feld,""]));
  renderVorlagenfelder(betreff,werte);
  renderVorlagenfelder(nachricht,werte);
  if(!nachricht.includes("{Begründung}"))throw Error("EMAIL_TEMPLATE_REASON_MISSING");
}
