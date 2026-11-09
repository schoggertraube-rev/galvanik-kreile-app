import type { AccessArea } from '@/lib/auth/authorizationContract';
import type {ComponentType} from 'react';
import type { Complaint } from './contract';
import type { ComplaintCommand, ComplaintWriteResult } from './writeContract';

export type ComplaintRequest = { complaintId:string } | { orderId:string; sourceItemId?:string } | {reminderOrderId:string};
export type ComplaintDialogData = {
  complaint:Complaint|null;
  source:{ id:string; number:string; customerName:string; items:Array<{id:string;name:string;quantity:number;unit:string|null}> };
  initial:{description:string;defect:string;photoIds:string[];intakeItemId:string|null;intakeVersion:number|null};
  suggestedDate:string|null;
  mailRecovery?:{kind:'result'|'reminder';retryAt:string;request:{complaintId:string;version:number;clientKey:string;subject:string;body:string;orderId?:string}|null}|null;
  resultMail?:{subject:string;body:string}|null;
  rework:{station:string;goods:string|null}|null;
};
export type ComplaintPorts = {
  areas:readonly AccessArea[];
  listDeliveredOrders?:(customerId:string)=>Promise<{code:'OK';orders:Array<{id:string;number:string;title:string}>}|{code:string;message:string}>;
  read:(request:ComplaintRequest)=>Promise<{code:'OK';data:ComplaintDialogData}|{code:string;message:string}>;
  write:(input:ComplaintCommand)=>Promise<ComplaintWriteResult>;
  rework:(input:{reklamationId:string;version:number;bewertung:'berechtigt'|'kulanz';massnahme:'nacharbeit';liefertermin:string})=>Promise<{code:'OK';receipt:{orderId:string}}|{code:string;message:string}>;
  openOrder:(id:string)=>void;
  createQuote?:(source:{id:string;number:string;customerId:string})=>void;
  openPhoto:(photoId:string,sourceItemId:string|null,orderId:string)=>Promise<void>;
  addPhoto:(orderId:string,file:File)=>Promise<{code:'OK';id:string}|{code:string;message:string}>;
  sendResult:(input:{complaintId:string;version:number;clientKey:string;subject:string;body:string})=>Promise<ComplaintWriteResult>;
  sendReminder?:(input:{complaintId:string;version:number;orderId:string;clientKey:string;subject:string;body:string})=>Promise<{code:'OK';data?:{sourceChanged?:boolean;deliveryCustomer?:string}}|{code:string;message:string;delivery?:'checking'|'failed'|'source-changed';retryAt?:string;deliveryCustomer?:string}>;
  ResultMail?:ComponentType<{orderId:string;subject:string;body:string;onSubject:(value:string)=>void;onBody:(value:string)=>void;onSend:()=>void;busy:boolean}>;
};
export const COMPLAINT_CHANGED_EVENT='kreile:complaint-changed';
export const COMPLAINT_STATE_LABELS={aufgenommen:'aufgenommen · Meister entscheidet',massnahme_nacharbeit:'Nacharbeit läuft',massnahme_gutschrift:'Gutschrift offen',kunde_informieren:'Kunde informieren',abgeschlossen:'abgeschlossen'} as const;
