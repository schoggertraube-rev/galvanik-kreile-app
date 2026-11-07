export type IntakeMailSummary={id:string;subject:string|null;senderName:string|null;senderAddress:string|null;receivedAt:string|null;fileCount:number;customerId:string|null};
export type IntakeMailSelectionResult={code:'OK';mails:IntakeMailSummary[];notice?:string}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'UNAVAILABLE';message:string};
export const INTAKE_MAIL_ADOPT_EVENT='kreile:intake-mail-adopt';
