export type StoredEmailTemplate={id:string;key:string;name:string;subject:string;body:string|null;updatedAt:string};
export const COMPLAINT_RESULT_TEMPLATE='reklamation_ergebnis';
export const COMPLAINT_RESULT_VARIABLES=['Kunde','RK-Nummer','Ergebnis','Begründung'] as const;
export function renderComplaintResultTemplate(text:string,values:Record<typeof COMPLAINT_RESULT_VARIABLES[number],string>){
  return text.replace(/\{([^{}]+)\}/gu,(_match,key:string)=>{
    if(!Object.hasOwn(values,key))throw Error('EMAIL_TEMPLATE_VARIABLE_UNKNOWN');
    return values[key as keyof typeof values];
  });
}
