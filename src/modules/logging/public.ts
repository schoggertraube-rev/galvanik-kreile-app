/** Browser-safe logging contracts; writes go through authenticated Server Actions. */
export type LogSubject={type:string;id:string};
export type LogSettings=import('@/modules/fundament/public').ProtocolSettings&{enabled:boolean};
export type LogReason='FORBIDDEN'|'VALIDATION'|'CONFLICT'|'NOT_FOUND'|'UNAVAILABLE'|'UNAUTHENTICATED'|'SERVER_ERROR'|'UNKNOWN';
export type TechnicalEvent={command:string;subject:LogSubject;occurredAt?:string}&(
 |{type:'rejected'|'server_error';reason:LogReason}
 |{type:'slow';durationMs:number}
 |{type:'external';dienst:'microsoft365'|'belegerkennung'|'versand'|'druck';ergebnis:'ok'|'fehler'|'zeitueberschreitung'|'unklar';original?:{ref:string;sha256:string}}
 |{type:'offline_sync'|'offline_conflict'|'offline_quarantine'}
);
export type LoggingSettingsReader=(context:{tenantId:string})=>Promise<LogSettings|null>;
export type LogFilter={userId?:string;subjectId?:string;from?:string;until?:string;limit?:number};
export type TechnicalLogRow={id:string;userId:string;occurredAt:string;recordedAt:string;type:string;command:string;subjectType:string;subjectId:string;durationMs:number|null;reason:string|null;dienst:string|null;ergebnis:string|null;originalRef:string|null;originalSha256:string|null;verpasst:number};
export type ClickInput={id:string;sessionId:string;route:string;target:string;deviceClass:'desktop'|'tablet'|'mobile'|'unknown';outcome:'success'|'failure'|'cancelled';durationMs:number;clickCount:number;occurredAt:string};
/** A local-only click without a command response has no invented outcome/duration. */
export type ClickFact=Omit<ClickInput,'outcome'|'durationMs'>&{outcome:ClickInput['outcome']|null;durationMs:number|null};
export type ClientDiagnosticFact={kind:'error';id:string;command:import('./clientErrorCodes').ProtocolClientErrorCode;occurredAt:string};
export type DiagnosticFact=ClickFact|ClientDiagnosticFact;
export type ClickLogRow={id:string;target:string|null;route:string;occurredAt:string;durationMs:number|null;outcome:string|null;clickCount:number|null;hang:boolean|null};
export {installProtocolClickCapture,observeProtocolCommand,reportProtocolClientError} from './clientCapture';
