export type MailImportFailure={state:'FAILED'|'SOURCE_INCOMPLETE';label:string;graphMessageId:string|null;reason:string|null;attempts:number|null;mailbox:string|null;taskId:string|null};
export type IntakeMailSummary={importFailure?:MailImportFailure|null;id:string;subject:string|null;senderName:string|null;senderAddress:string|null;receivedAt:string|null;fileCount:number|null;customerId:string|null};
export type IntakeMailSelectionResult={code:'OK';mails:IntakeMailSummary[];notice?:string}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'UNAVAILABLE';message:string};
export const INTAKE_MAIL_ADOPT_EVENT='kreile:intake-mail-adopt';
