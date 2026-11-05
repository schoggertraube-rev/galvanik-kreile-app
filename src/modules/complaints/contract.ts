/** Read projection of the existing complaint row. P48: itemId is the intake source. */
export type Complaint={id:string;customerId:string;orderId:string;itemId:string|null;legacyPositionId:string|null;reason:string;stationId:string|null;description:string;photoIds:string[]|null;createdAt:string;resolvedAt:string|null;resolution:string|null;status:string|null};
export type ComplaintFilter={customerId?:string;orderId?:string};
export type ComplaintReadResult={code:'OK';complaints:Complaint[]}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
