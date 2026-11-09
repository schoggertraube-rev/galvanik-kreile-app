export type IntakeDraft = {
  id: string;
  art: "eingang" | "kunde" | null;
  payload: Record<string, unknown>;
  zuletzt_feld: string | null;
  version: number;
  updated_at: string;
};
export type IntakeDraftResult = { code: "OK"; drafts: IntakeDraft[] }
  | { code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_ERROR" | "CONFLICT" | "UNAVAILABLE"; message: string };
export type IntakeDraftPorts = {
  readDrafts: () => Promise<IntakeDraftResult>;
  saveDraft: (input: { id: string; clientEventId: string; art: "eingang" | "kunde"; payload: Record<string, unknown>; lastField: string | null; expectedVersion: number | null }) => Promise<IntakeDraftResult>;
  discardDraft: (input: { id: string; clientEventId: string; expectedVersion: number; reason?:string }) => Promise<IntakeDraftResult>;
};
