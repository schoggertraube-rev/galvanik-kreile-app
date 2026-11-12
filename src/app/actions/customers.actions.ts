"use server";
import {openIntakePredicate} from '@/modules/eingang/server-public';


import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";
import { Customer } from "@/lib/types/customer";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import {
  getAuthorizationActionGrants,
  hasAuthorizationArea,
  resolveAuthorization,
} from "@/lib/server/authorization";
import { readCustomerSummary,readCustomerListSignals } from "@/lib/server/customerSummaryRead";
import { readInvoiceTruth } from "@/lib/server/invoiceTruthRead";
import {CUSTOMER_LOOKUP_COPY} from '@/ui/situationCatalog';
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {customerContactLabel,customerSortKey,kundeVollstaendigkeit,type CustomerAddressInput,type CustomerListSignals,type CustomerStoredProfile} from "@/modules/customers/public";
import {
  createCustomerCommand,
  readCustomerCreateReceiptCommand,
  updateCustomerCommand,
  saveCustomerAgreementCommand,
  revokeCustomerAgreementCommand,
  readCustomerAddress,
  type CreateCustomerInput,
  type RevokeCustomerAgreementInput,
  type SaveCustomerAgreementInput,
  type UpdateCustomerInput,
} from "@/modules/customers/server-public";

export async function getCustomerSummaryAction(input: { customerId: string }) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch (error) {
    console.error("[CUSTOMER_SUMMARY_AUTHORIZATION_FAILED]", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return { code: "UNAVAILABLE" as const, message: "Kundenkarte ist derzeit nicht verfügbar." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE" as const, message: "Kundenkarte ist derzeit nicht verfügbar." }
      : { code: "UNAUTHENTICATED" as const, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  return readCustomerSummary(authorization.data, input,openIntakePredicate());
}

async function customerAuthorization() {
  try { return await resolveAuthorization(); }
  catch (error) {
    console.error("[CUSTOMER_AUTHORIZATION_UNAVAILABLE]", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return null;
  }
}
function customerContext(authorization: Extract<Awaited<ReturnType<typeof resolveAuthorization>>, {ok:true}>["data"]) {
  return {
    tenantId: authorization.tenantId, userId: authorization.userId,
    capabilities: {
      canCreateCustomer: getAuthorizationActionGrants(authorization).createCustomer,
      canEditCustomer: hasAuthorizationArea(authorization,"kunden"),
      canManageMoney: hasAuthorizationArea(authorization,"geld"),
      canDecide: hasAuthorizationArea(authorization,"entscheiden"),
    },
  };
}
export async function readCustomerAddressAction(input: CustomerAddressInput) {
  const authorization=await customerAuthorization();
  if(!authorization?.ok || (!hasAuthorizationArea(authorization.data,"eingang")&&!hasAuthorizationArea(authorization.data,"kunden"))) {
    return {code:"FORBIDDEN" as const,message:"Adressprüfung ist nicht erlaubt."};
  }
  if(!input || ["country","zipCode","city","street","houseNumber"].some(key=>typeof input[key as keyof CustomerAddressInput]!=="string") || Object.values(input).some(value=>value.length>254)) {
    return {code:"VALIDATION_ERROR" as const,message:"Anschrift ist ungültig."};
  }
  try { return {code:"OK" as const,data:await withPrivilegedTenantTransaction(authorization.data,tx=>readCustomerAddress(tx,input))}; }
  catch(error) {
    console.error("[CUSTOMER_ADDRESS_READ_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});
    return {code:"UNAVAILABLE" as const,message:"Adressprüfung gerade nicht möglich. Code: CUSTOMER_ADDRESS_READ_FAILED."};
  }
}
export async function createCustomerAction(input: CreateCustomerInput) {
  const authorization=await customerAuthorization();
  if(!authorization?.ok)return {code:"UNAVAILABLE" as const,message:"Kunde konnte nicht sicher gespeichert werden. Code: CUSTOMER_AUTHORIZATION_UNAVAILABLE."};
  const result=await createCustomerCommand(customerContext(authorization.data),input);
  if(result.code!=="OK")return result;
  revalidatePath("/customers");
  revalidatePath(`/customers/${result.receipt.customerId}`);
  return result;
}
export async function readCustomerCreateReceiptAction(input: CreateCustomerInput) {
  noStore();
  const authorization=await customerAuthorization();
  if(!authorization?.ok)return {code:"UNAVAILABLE" as const,message:"Kundenbeleg konnte nicht sicher gelesen werden. Code: CUSTOMER_AUTHORIZATION_UNAVAILABLE."};
  return readCustomerCreateReceiptCommand(customerContext(authorization.data),input);
}
export async function updateCustomerAction(input: UpdateCustomerInput) {
  const authorization=await customerAuthorization();
  if(!authorization?.ok)return {code:"UNAVAILABLE" as const,message:"Kunde konnte nicht sicher gespeichert werden. Code: CUSTOMER_AUTHORIZATION_UNAVAILABLE."};
  const result=await updateCustomerCommand(customerContext(authorization.data),input);
  if(result.code!=="OK")return result;
  revalidatePath("/customers"); revalidatePath(`/customers/${input.customerId}`);
  return result;
}
export async function saveCustomerAgreementAction(input: SaveCustomerAgreementInput) {
  const authorization=await customerAuthorization();
  if(!authorization?.ok)return {code:"UNAVAILABLE" as const,message:"Absprache konnte nicht sicher gespeichert werden. Code: CUSTOMER_AUTHORIZATION_UNAVAILABLE."};
  const result=await saveCustomerAgreementCommand(customerContext(authorization.data),input);
  if(result.code!=="OK")return result;
  revalidatePath("/customers");
  revalidatePath(`/customers/${result.agreement.customerId}`);
  if(result.agreement.orderId)revalidatePath(`/orders/${result.agreement.orderId}`);
  revalidatePath("/");
  return result;
}
export async function revokeCustomerAgreementAction(input: RevokeCustomerAgreementInput) {
  const authorization=await customerAuthorization();
  if(!authorization?.ok)return {code:"UNAVAILABLE" as const,message:"Absprache konnte nicht sicher widerrufen werden. Code: CUSTOMER_AUTHORIZATION_UNAVAILABLE."};
  const result=await revokeCustomerAgreementCommand(customerContext(authorization.data),input);
  if(result.code!=="OK")return result;
  revalidatePath("/customers");
  revalidatePath(`/customers/${result.agreement.customerId}`);
  if(result.agreement.orderId)revalidatePath(`/orders/${result.agreement.orderId}`);
  revalidatePath("/");
  return result;
}

type DbCustomer = InferSelectModel<typeof customers>;

function mapDbCustomer(c: DbCustomer): Customer {
  return {
    id: c.id,
    customerNumber: c.customerNumber ?? "",
    name: c.name,
    companyName: c.companyName || undefined,
    type: c.type as import("@/lib/types/customer").CustomerType,
    contactPerson: customerContactLabel({customerType:c.type,salutation:c.salutation,firstName:c.firstName,lastName:c.lastName,contactRole:c.contactRole}) ?? undefined,
    salutation:c.salutation as Customer["salutation"],firstName:c.firstName,lastName:c.lastName,contactRole:c.contactRole,houseNumber:c.houseNumber,billingEmail:c.billingEmail,website:c.website,
    handoverPreference:c.handoverPreference as Customer["handoverPreference"],invoiceTermsEnabled:c.invoiceTermsEnabled,invoiceTermDays:c.invoiceTermDays,autoInfo:c.autoInfo,vorrang:c.vorrang,
    email: c.email || undefined,
    phone: c.phone || undefined,
    paymentProfile: c.paymentProfile || undefined,
    paymentPreference: c.paymentPreference || undefined,
    vatId: c.vatId || undefined,
    approvalProfile: c.approvalProfile || undefined,
    expectationProfile: c.expectationProfile || undefined,
    technicalProfile: c.technicalProfile || undefined,
    trustLevel: c.trustLevel as import("@/lib/types/customer").Customer["trustLevel"] || undefined,
    internalWarning: c.internalWarning || undefined,
    tags: (c.tags as string[]) || [],
    creditRating: c.creditRating || undefined,
    imageUrls: (c.imageUrls as string[]) || [],
    address: [c.street,c.houseNumber].filter(Boolean).join(" ") || undefined,
    street: c.street || undefined,
    city: c.city || undefined,
    zipCode: c.zipCode || undefined,
    country: c.country || undefined,
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function getCustomersDb(): Promise<ActionResult<Array<Customer & {
  activeOrderCount: number;
  activeQuoteCount:number;hints:CustomerListSignals['hints'];complete:boolean;
}>>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  const authRes = await resolveAuthorization();
  if (!authRes.ok) return { ok: false, error: "UNAUTHORIZED", message: authRes.message };
  if (!hasAuthorizationArea(authRes.data, "kunden")) {
    return { ok: false, error: "FORBIDDEN", message: "Kundenstamm ist für diesen Login nicht freigegeben." };
  }
  const tenantId = authRes.data.tenantId;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const dbCustomers = await db.select().from(customers).where(
      and(
        eq(customers.tenantId, tenantId),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
        sql`coalesce(${customers.name}, '') NOT LIKE 'Capture%'`
      )
    ).orderBy(customers.createdAt);
    const signals=await readCustomerListSignals(authRes.data,dbCustomers.map(customer=>customer.id),openIntakePredicate());
    const data = dbCustomers.map((record) => {
      const customer=mapDbCustomer(record),signal=signals.get(record.id);if(!signal)throw Error('CUSTOMER_SIGNALS_MISSING');
      const readiness=kundeVollstaendigkeit({...customer,customerType:customer.type as CustomerStoredProfile['customerType']},{geld:hasAuthorizationArea(authRes.data,'geld')});
      const hints=[...signal.hints,...(!readiness.vollstaendig?[{kind:'incomplete' as const,text:readiness.text.replace('Unvollständig – für Auftrag fehlt:','Für Auftrag fehlt:').replace('Unvollständig – ',''),urgent:false}]:[])];
      return {...customer,...signal,hints,complete:readiness.vollstaendig};
    }).filter(customer=>customer.type!=="lieferant"||hasAuthorizationArea(authRes.data,"geld")).sort((a,b)=>Number(b.hints.length>0)-Number(a.hints.length>0)||customerSortKey({...a,customerType:a.type}).localeCompare(customerSortKey({...b,customerType:b.type}),"de")||a.id.localeCompare(b.id));
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get customers from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getCustomerByIdDb(id: string): Promise<ActionResult<Customer | null>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  const authRes = await resolveAuthorization();
  if (!authRes.ok) return { ok: false, error: "UNAUTHORIZED", message: authRes.message };
  if (!hasAuthorizationArea(authRes.data, "kunden")) return { ok: false, error: "FORBIDDEN", message: "Kundenstamm ist für diesen Login nicht freigegeben." };
  if (typeof id !== 'string' || !id.trim() || id.trim() !== id || id.length > 128) return {ok:false,error:'VALIDATION_ERROR',message:CUSTOMER_LOOKUP_COPY.invalidId};
  const tenantId = authRes.data.tenantId;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const dbCustomers = await db.select().from(customers).where(
      and(
        eq(customers.id, id),
        eq(customers.tenantId, tenantId),
        sql`(${customers.type} IS DISTINCT FROM 'lieferant' OR ${hasAuthorizationArea(authRes.data, "geld")})`,
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`
      )
    ).limit(1);
    if (dbCustomers.length === 0) return { ok: true, data: null };

    return { ok: true, data: mapDbCustomer(dbCustomers[0]) };
  } catch (error) {
    console.error("Failed to get customer by id from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden des Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createCustomerDb(data: Record<string, unknown>): Promise<ActionResult<Customer>> {
  void data;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Kundenerstellung benötigt den W3-Command-Vertrag." };
}

export async function updateCustomerDb(id: string, changes: Partial<Customer>): Promise<ActionResult<Customer | null>> {
  void id;
  void changes;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Kundenänderungen benötigen den W3-Command-Vertrag." };
}

export async function searchCustomersDb(query: string): Promise<ActionResult<Customer[]>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  const authRes = await resolveAuthorization();
  if (!authRes.ok) return { ok: false, error: "UNAUTHORIZED", message: authRes.message };
  if (!hasAuthorizationArea(authRes.data, "kunden")) return { ok: false, error: "FORBIDDEN", message: "Kundenstamm ist für diesen Login nicht freigegeben." };
  if (typeof query !== 'string') return {ok:false,error:'VALIDATION_ERROR',message:CUSTOMER_LOOKUP_COPY.invalidQuery};
  const tenantId = authRes.data.tenantId;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  if (!query || query.trim() === "") {
    return { ok: true, data: [] };
  }

  try {
    const searchPattern = `%${query.trim()}%`;
    const dbCustomers = await db.select().from(customers).where(
      and(
        eq(customers.tenantId, tenantId),
        sql`(${customers.type} IS DISTINCT FROM 'lieferant' OR ${hasAuthorizationArea(authRes.data, "geld")})`,
        or(
          ilike(customers.name, searchPattern),
          ilike(customers.phone, searchPattern),
          ilike(customers.email, searchPattern)
        ),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
        sql`coalesce(${customers.name}, '') NOT LIKE 'Capture%'`
      )
    );

    return { ok: true, data: dbCustomers.map(mapDbCustomer) };
  } catch (error) {
    console.error("Failed to search customers in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Suchen der Kunden", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getTopKunden(limit = 5) {
  try {
    const authRes = await resolveAuthorization();
    if (!authRes.ok) return [];
    const tenantId = authRes.data.tenantId;
    const invoiceTruth = await readInvoiceTruth(authRes.data);
    if (invoiceTruth.code !== "OK") return [];
    const revenueByCustomer = new Map<string, number>();
    for (const invoice of invoiceTruth.data) {
      if (invoice.status !== "issued") continue;
      revenueByCustomer.set(
        invoice.customerId,
        (revenueByCustomer.get(invoice.customerId) ?? 0) + invoice.grossAmountCents,
      );
    }
    const customerRows = await db.select({ id: customers.id, name: customers.name }).from(customers).where(
      and(
        eq(customers.tenantId, tenantId),
        sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
      ),
    );
    return customerRows
      .map((customer) => ({ id: customer.id, name: customer.name, wert: (revenueByCustomer.get(customer.id) ?? 0) / 100 }))
      .filter((customer) => customer.wert > 0)
      .sort((left, right) => right.wert - left.wert || left.name.localeCompare(right.name, "de"))
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to get top customers:", error);
    return [];
  }
}
