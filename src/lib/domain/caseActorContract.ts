export type CaseActorEvidence={eventId:string;userId:string|null;name:string|null;at:string;action:string;mailSender:string|null};
export type CaseActorTrace={createdBy:CaseActorEvidence|null;lastActor:CaseActorEvidence|null};
