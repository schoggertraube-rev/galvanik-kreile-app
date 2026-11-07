"use server";
import {unstable_noStore as noStore} from "next/cache";
import {readComplaints,executeComplaint,readComplaintOrderSource,readComplaintOrderChoices} from "@/modules/complaints/server-public";
import {recordIntakeComplaintEffect} from "@/modules/eingang/server-public";
import {resolveAuthorization} from '@/lib/server/authorization';
import {sendCommunicationMail} from '@/lib/server/communicationPort';
import {readComplaintResultMail} from '@/lib/server/commands/emailTemplateCommand';
import {COMPLAINT_DEFECTS,type ComplaintWriteResult,type ComplaintRequest,type ComplaintDialogData} from '@/modules/complaints/public';
import {readIntakeCapture} from '@/modules/eingang/server-public';
import {readIntakeSuggestions} from '@/lib/server/intakeSuggestions';
import {nacharbeitAnlegen} from "@/modules/orders/server-public";
import type {ComplaintFilter} from "@/modules/complaints/public";

export async function getComplaints(filter?:ComplaintFilter){noStore();return readComplaints(filter);}
export async function getByOrder(orderId:string){noStore();return readComplaints({orderId});}
export async function getComplaintOrderChoicesAction(customerId:string){
 noStore();const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:'Sitzung fehlt.'};
 return readComplaintOrderChoices(auth.data,customerId);
}
export async function nacharbeitAnlegenAction(input: Parameters<typeof nacharbeitAnlegen>[0]) {
 return nacharbeitAnlegen(input);
}
export async function reklamationAusfuehrenAction(input:unknown) {
 return executeComplaint(input,recordIntakeComplaintEffect);
}
export async function sendeReklamationErgebnisAction(input:{complaintId:string;version:number;clientKey:string;subject:string;body:string}):Promise<ComplaintWriteResult> {
 if(!input||typeof input!=='object'||typeof input.complaintId!=='string'||!input.complaintId||input.complaintId.length>128||!Number.isSafeInteger(input.version)||input.version<1||typeof input.clientKey!=='string'||!/^[0-9a-f-]{36}$/i.test(input.clientKey)||typeof input.subject!=='string'||!input.subject.trim()||input.subject.length>500||typeof input.body!=='string'||!input.body.trim()||input.body.length>20000)return {code:'VALIDATION_ERROR',message:'Mail oder Reklamationsstand ist ungültig.'};
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:'UNAUTHENTICATED',message:'Sitzung konnte nicht geprüft werden.'};
 const rows=await readComplaints({complaintId:input?.complaintId});if(rows.code!=='OK')return rows;
 const complaint=rows.complaints[0];if(!complaint)return {code:'NOT_FOUND',message:'Reklamation nicht verfügbar.'};
 const result=await sendCommunicationMail(authorization.data,{targetType:'ORDER',targetId:complaint.orderId,clientRequestId:input.clientKey,subject:input.subject,body:input.body,complaintResult:{complaintId:complaint.id,version:input.version}});
 if(result.code!=='OK')return {code:result.code==='IN_KLAERUNG'?'UNAVAILABLE':result.code,message:result.message};
 return executeComplaint({action:'abschliessen',clientKey:input.clientKey,complaintId:complaint.id,version:input.version,kind:'mail',note:null,sentThreadId:result.data.threadId},recordIntakeComplaintEffect);
}

export async function getComplaintDialogAction(request:ComplaintRequest):Promise<{code:'OK';data:ComplaintDialogData}|{code:string;message:string}> {
 noStore();
 if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(key=>!['complaintId','orderId','sourceItemId'].includes(key))||Object.values(request).some(value=>typeof value!=='string'||!value||value.length>128)||('complaintId'in request)==('orderId'in request))return {code:'VALIDATION_ERROR',message:'Reklamationsbezug ist ungültig.'};
 try {
  const authorization=await resolveAuthorization();if(!authorization.ok)return {code:'UNAUTHENTICATED',message:'Sitzung konnte nicht geprüft werden.'};
  let complaint:ComplaintDialogData['complaint']=null;
  if('complaintId'in request){const rows=await readComplaints({complaintId:request.complaintId});if(rows.code!=='OK')return rows;complaint=rows.complaints[0]??null;if(!complaint)return {code:'NOT_FOUND',message:'Reklamation ist nicht verfügbar.'};}
  const source=await readComplaintOrderSource(authorization.data,complaint?.orderId??('orderId'in request?request.orderId:''));
  if(!source)return {code:'NOT_FOUND',message:'Auftrag ist nicht verfügbar.'};
  let initial:ComplaintDialogData['initial']={description:'',defect:'',photoIds:[],intakeItemId:null,intakeVersion:null};
  if('sourceItemId'in request&&request.sourceItemId){
   const capture=await readIntakeCapture(request.sourceItemId,{orderId:source.id});if(capture.code!=='OK')return capture;
   const text=capture.capture.text??'',signal=text.toLocaleLowerCase('de-DE');
   const defects:[RegExp,string][]=[[/blasen/u,'Blasen'],[/rost|korrosion/u,'Rost / Korrosion'],[/abgeplatzt|abplatzung/u,'Abplatzung'],[/transportschaden|beschädigt/u,'Transportschaden'],[/farbe|glanz/u,'Farbe / Glanz'],[/gewinde|maß/u,'Maß / Gewinde']];
   const defect=defects.find(([pattern])=>pattern.test(signal))?.[1]??'';
   initial={description:text,defect:COMPLAINT_DEFECTS.includes(defect as typeof COMPLAINT_DEFECTS[number])?defect:'',photoIds:capture.capture.files.filter(file=>file.mime.startsWith('image/')&&file.secured).map(file=>file.id),intakeItemId:capture.capture.id,intakeVersion:capture.capture.version};
  }
  let suggestedDate:string|null=null;
  if(source.items.length&&source.handoverMode){
   try{const suggestions=await readIntakeSuggestions(authorization.data,{customerId:source.customerId,kind:'ORDER',wishDate:null,handoverMode:source.handoverMode,positions:source.items.map(item=>({key:item.id,catalogServiceId:item.catalogServiceId,name:item.name,quantity:item.quantity,surfaceRequested:item.surfaceRequested,unit:item.unit,unitPriceCents:null}))});suggestedDate=suggestions.term?.achievableDate??null;}
   catch(error){console.error('[COMPLAINT_TERM_SUGGESTION_FAILED]',error instanceof Error?error.message:error);}
  }
  let resultMail:ComplaintDialogData['resultMail']=null;
  const resultLabel=complaint?.bewertung==='abgelehnt'?'abgelehnt':complaint?.massnahme==='gutschrift'?'Gutschrift':complaint?.massnahme==='nacharbeit'?'Nacharbeit':null;
  if(complaint?.stand==='kunde_informieren'&&complaint.nummer&&resultLabel){
   try{resultMail=await readComplaintResultMail(authorization.data,{'Kunde':source.customerName,'RK-Nummer':complaint.nummer,Ergebnis:resultLabel,'Begründung':complaint.begruendung??''});}
   catch(error){console.error('[COMPLAINT_RESULT_TEMPLATE_FAILED]',error);}
  }
  return {code:'OK',data:{complaint,source:{id:source.id,number:source.number,customerName:source.customerName,items:source.items.map(item=>({id:item.id,name:item.name,quantity:item.quantity,unit:item.unit}))},initial,suggestedDate,resultMail,rework:complaint?.nacharbeitAuftragId&&complaint.reworkStation?{station:complaint.reworkStation,goods:complaint.reworkGoods??null}:null}};
 }catch(error){console.error('[COMPLAINT_DIALOG_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Reklamation konnte nicht geladen werden. Code: COMPLAINT_DIALOG_READ_FAILED.'};}
}
