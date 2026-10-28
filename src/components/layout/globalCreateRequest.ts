export type GlobalCreateIntent = "CUSTOMER" | "QUOTE" | "DIRECT_INTAKE";

export type GlobalCreateRequest = {
  intent: GlobalCreateIntent;
  prefill?: {
    customerId?: string;
    name?: string;
    email?: string;
    customerQuery?: string;
    note?: string;
    dueDate?: string;
    sourceMode?: "camera" | "document" | "mail";
    graphMessageId?: string;
    quotePositions?: Array<{ quantity?: string; material?: string }>;
  };
};

export const GLOBAL_CREATE_OPEN_EVENT = "path1:global-create-open";

export function requestGlobalCreate(request: GlobalCreateIntent | GlobalCreateRequest): void {
  window.dispatchEvent(new CustomEvent<GlobalCreateIntent | GlobalCreateRequest>(GLOBAL_CREATE_OPEN_EVENT, { detail: request }));
}
