import type { OrderReadiness } from "../orderReadiness";

export type CustomerListItem={id:string;customerNumber:string;name:string;type:string;city:string|null;activeOrderCount:number};
export type CustomersViewState={kind:"loading"}|{kind:"denied"|"error"|"conflict";message:string}|{kind:"data";customers:CustomerListItem[]};
export type CustomerOrderItem={id:string;orderNumber:string;title:string;station:string;status:string;dueAt:string|null;version:number};
export type CustomerCardModel=Partial<Pick<CustomerStoredProfile,"salutation"|"firstName"|"lastName"|"contactRole"|"houseNumber"|"billingEmail"|"website"|"handoverPreference"|"iban"|"paymentTermDays"|"autoInfo"|"vorrang"|"addressStatus"|"invoiceTermDays">>&{id:string;customerNumber:string|null;name:string;companyName:string|null;type:string;contactPerson:string|null;email:string|null;phone:string|null;address:string|null;zipCode:string|null;city:string|null;country:string|null;paymentPreference?:string|null;invoiceTermsEnabled:boolean;vatId?:string|null;classification:string|null;notes:string|null;tags:string[];createdAt:string;updatedAt:string;orderCount:number;wareImHausCount:number;invoiceRevenueCents:number;invoiceOpenCents:number;orders:CustomerOrderItem[]};
export type CustomerCardState={kind:"loading"}|{kind:"denied"|"not-found"|"error"|"conflict";message:string}|{kind:"data";card:CustomerCardModel};

export type CreateCustomerInput = {
  clientEventId: string;
  /** Legacy input only; canonical clients send split fields. */
  name?: string;
  contactPerson?: string | null;
  customerType: "business" | "privat" | "lieferant";
  companyName?: string | null;
  salutation?: "frau" | "herr" | "ohne" | null;
  firstName?: string | null;
  lastName?: string | null;
  contactRole?: string | null;
  email?: string | null;
  phone?: string | null;
  billingEmail?: string | null;
  website?: string | null;
  houseNumber?: string | null;
  handoverPreference?: "pickup" | "shipping" | null;
  iban?: string | null;
  paymentTermDays?: number | null;
  autoInfo?: boolean;
  vorrang?: boolean;
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
  country?: string | null;
  paymentPreference?: string | null;
  vatId?: string | null;
  notes?: string | null;
};

export type CustomerCommandCapabilities = {
  canCreateCustomer: boolean;
  canManageMoney: boolean;
  canDecide?: boolean;
  canEditCustomer?: boolean;
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
  street: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
  paymentPreference: string | null;
  vatId: string | null;
  notes: string | null;
  recordedAt: string;
  aggregateVersion: 1;
};

export type CustomerCreateCommandResult =
  | { code: "OK"; receipt: CustomerCreateReceipt; customer: CustomerStoredProfile; replayed: boolean }
  | { code: "FORBIDDEN" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

export type CustomerUpdateCommandResult=
 | {code:"OK";customer:CustomerStoredProfile;replayed:boolean}
 | {code:"FORBIDDEN"|"CONFLICT"|"VALIDATION_ERROR"|"UNAVAILABLE"|"NOT_FOUND";message:string;fields?:Record<string,string>};

export type ReadCustomerCreateReceiptResult =
  | { code: "OK"; receipt: CustomerCreateReceipt; customer: CustomerStoredProfile }
  | { code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

export type UpdateCustomerInput = Partial<Omit<CreateCustomerInput, "clientEventId">> & { clientEventId: string; customerId: string };
export type CustomerStoredProfile = {
  id: string; customerNumber: string | null; name: string;
  customerType: CreateCustomerInput["customerType"];
  companyName: string | null; salutation: "frau" | "herr" | "ohne" | null;
  firstName: string | null; lastName: string | null; contactRole: string | null;
  phone: string | null; email: string | null; billingEmail: string | null; website: string | null;
  street: string | null; houseNumber: string | null; zipCode: string | null; city: string | null;
  country: string | null; paymentPreference: string | null; vatId: string | null; notes: string | null;
  handoverPreference: "pickup" | "shipping" | null; iban: string | null; paymentTermDays: number | null;
  autoInfo: boolean; vorrang: boolean; invoiceTermsEnabled: boolean; invoiceTermDays: number | null;
  addressStatus: string | null;
  contactPerson: string | null;
};

export type EnableCustomerInvoiceTermsInput = {
  clientEventId: string;
  customerId: string;
  targetDays: number;
  cashDiscountPercent: number;
  cashDiscountDays: number;
};

export type ReadCustomerOrderReadinessInput = {
  customerId: string;
  requirePaymentPreference: boolean;
};

export type ReadCustomerOrderReadinessResult =
  | { code: "OK"; readiness: OrderReadiness }
  | { code: "NOT_FOUND" | "UNAVAILABLE"; message: string };
