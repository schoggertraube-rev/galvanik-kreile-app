export type GlobalCreateIntent = "CUSTOMER" | "QUOTE" | "DIRECT_INTAKE";

export type GlobalCreateRequest = {
  intent: GlobalCreateIntent;
  handoverToken?: string;
  draftId?: string;
  prefill?: {
    orderCopyId?: string;
    customerId?: string;
    customerMode?:"lieferant";
    name?: string;
    email?: string;
    customerQuery?: string;
    note?: string;
    dueDate?: string;
    sourceMode?: "camera" | "document" | "mail";
    intakeSource?: "personal" | "shipping" | "pickup" | "mail" | "phone";
    graphMessageId?: string;
    quotePositions?: Array<{ quantity?: string; material?: string }>;
  };
};

export const GLOBAL_CREATE_OPEN_EVENT = "path1:global-create-open";

export function requestGlobalCreate(request: GlobalCreateIntent | GlobalCreateRequest = "DIRECT_INTAKE"): void {
  window.dispatchEvent(new CustomEvent<GlobalCreateIntent | GlobalCreateRequest>(GLOBAL_CREATE_OPEN_EVENT, { detail: request }));
}
