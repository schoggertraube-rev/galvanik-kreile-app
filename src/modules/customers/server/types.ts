export type CustomerListItem={id:string;customerNumber:string;name:string;type:string;city:string|null};
export type CustomersViewState={kind:"loading"}|{kind:"denied"|"error"|"conflict";message:string}|{kind:"data";customers:CustomerListItem[]};
export type CustomerOrderItem={id:string;orderNumber:string;title:string;station:string;status:string;dueAt:string|null;version:number};
export type CustomerCardModel={id:string;customerNumber:string|null;name:string;companyName:string|null;type:string;contactPerson:string|null;email:string|null;phone:string|null;address:string|null;zipCode:string|null;city:string|null;country:string|null;classification:string|null;notes:string|null;tags:string[];createdAt:string;updatedAt:string;orderCount:number;wareImHausCount:number;orders:CustomerOrderItem[]};
export type CustomerCardState={kind:"loading"}|{kind:"denied"|"not-found"|"error"|"conflict";message:string}|{kind:"data";card:CustomerCardModel};

export type CreateCustomerInput = {
  clientEventId: string;
  name: string;
  customerType: "business" | "privat" | "institution";
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
};

export type CustomerCommandCapabilities = {
  canCreateCustomer: boolean;
};

export type CustomerCommandContext = {
  tenantId: string;
  userId: string;
  capabilities: CustomerCommandCapabilities;
};

export type CustomerCreateReceipt = {
  receiptId: string;
  eventId: string;
  customerId: string;
  customerNumber: string;
  clientEventId: string;
  correlationId: string;
  actorId: string;
  name: string;
  customerType: CreateCustomerInput["customerType"];
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  recordedAt: string;
  aggregateVersion: 1;
};

export type CustomerCreateCommandResult =
  | { code: "OK"; receipt: CustomerCreateReceipt; replayed: boolean }
  | { code: "FORBIDDEN" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };
