import type {CreateCustomerInput} from '@/modules/customers/public';

export type IntakeProspectInput={
  clientKey:string;
  customer:Omit<CreateCustomerInput,'clientEventId'>;
  text:string;
  draft:Record<string,unknown>;
  activeDraft?:{id:string;version:number};
};
export type IntakeProspectResult=
 |{code:'OK';customerId:string;customerNumber:string;intakeItemId:string;draftId:string;replayed:boolean}
 |{code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
