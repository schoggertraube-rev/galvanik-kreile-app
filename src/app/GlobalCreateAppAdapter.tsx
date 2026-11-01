"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { createCustomerAction, getCustomersDb, readCustomerCreateReceiptAction } from "@/app/actions/customers.actions";
import { erfasseAuftragAusEingangAction } from "@/app/actions/eingang.actions";
import { convertQuoteToOrderAction, createQuoteAction, listOpenQuotesAction, readQuoteAction, readQuoteCreateReceiptAction, readQuoteConversionReceiptAction, readQuoteUpdateReceiptAction, updateQuoteAction } from "@/app/actions/quotes.actions";
import { getOrderIntakeReceiptAction, getOrderIntakeSuggestionsAction, recognizeOrderIntakeTextAction, searchOrderIntakeCustomersAction } from "@/app/warendurchlauf/actions";
import { getActiveCatalogAction } from "@/app/actions/catalog.actions";
import {
  GlobalCreateFlow,
  type GlobalCreateConversionResult,
  type GlobalCreateCustomerResult,
  type GlobalCreateQuoteReadResult,
  type GlobalCreateQuoteResult,
  type GlobalCreateOpenQuotesResult,
  type GlobalCreateDirectIntakeResult,
  type DirectIntakeInput,
  type ConvertQuoteInput,
  type CreateQuoteInput,
  type UpdateQuoteInput,
} from "@/modules/eingang/public";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { isAppRole } from "@/lib/auth/authorizationContract";
import { useOverlayStore } from "@/lib/overlayStore";

type CreateCustomerInput = Parameters<typeof createCustomerAction>[0];

const PENDING_QUOTE_KEY = "path1.global-create.pending-quote";
const PENDING_QUOTE_CONVERSION_KEY = "path1.global-create.pending-quote-conversion";

export function GlobalCreateAppAdapter() {
  const router = useRouter();
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const { canAction, hasArea, name, role } = usePermissions();
  const [resumeQuoteId, setResumeQuoteId] = useState<string | null>(null);
  const [resumeQuoteConversionId, setResumeQuoteConversionId] = useState<string | null>(null);
  const canCreateCustomer = canAction("createCustomer");
  const canCreateQuote = canAction("createQuote");
  const roleLabel = name.trim() || "dieses Profil";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setResumeQuoteId(window.sessionStorage.getItem(PENDING_QUOTE_KEY));
      setResumeQuoteConversionId(window.sessionStorage.getItem(PENDING_QUOTE_CONVERSION_KEY));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const rememberQuote = (quoteId: string | null) => {
    if (quoteId) {
      window.sessionStorage.setItem(PENDING_QUOTE_KEY, quoteId);
      window.sessionStorage.removeItem(PENDING_QUOTE_CONVERSION_KEY);
    } else {
      window.sessionStorage.removeItem(PENDING_QUOTE_KEY);
      window.sessionStorage.removeItem(PENDING_QUOTE_CONVERSION_KEY);
    }
    setResumeQuoteId(quoteId);
    setResumeQuoteConversionId(null);
  };

  const rememberQuoteConversion = (quoteId: string, clientEventId: string) => {
    window.sessionStorage.setItem(PENDING_QUOTE_KEY, quoteId);
    window.sessionStorage.setItem(PENDING_QUOTE_CONVERSION_KEY, clientEventId);
    setResumeQuoteId(quoteId);
    setResumeQuoteConversionId(clientEventId);
  };

  // Keep one safe, typed intake boundary mounted for authenticated workshop roles.
  // Their request is denied by the same flow before any command can run.
  if (!role || !isAppRole(role)) return null;

  return (
    <GlobalCreateFlow
      ports={{
        canCreateCustomer,
        canCreateOrder: hasArea("eingang"),
        canCreateQuote,
        canManageMoney: hasArea("geld"),
        showPrimaryTrigger: false,
        roleLabel,
        resumeQuoteId,
        resumeQuoteConversionId,
        listCustomers: async () => {
          const result = await getCustomersDb();
          if (!result.ok) {
            return {
              code: result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN" ? "DENIED" as const : "UNAVAILABLE" as const,
              message: result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN"
                ? "Der Kundenstamm ist für dieses Profil nicht freigegeben."
                : "Der Kundenstamm konnte nicht sicher gelesen werden.",
            };
          }
          return {
            code: "OK" as const,
            customers: result.data.map((customer) => ({
              id: customer.id,
              customerNumber: customer.customerNumber ?? null,
              name: customer.name,
              customerType: customer.type === "institution" || customer.type === "Institution" ? "institution" as const : customer.type === "private" || customer.type === "Privatkunde" ? "privat" as const : "business" as const,
              companyName: customer.companyName ?? null,
              contactPerson: customer.contactPerson ?? null,
              email: customer.email ?? null,
              phone: customer.phone ?? null,
              street: customer.street ?? "",
              zipCode: customer.zipCode ?? "",
              city: customer.city ?? null,
              country: customer.country ?? "",
              paymentPreference: customer.paymentPreference,
              vatId: customer.vatId ?? null,
              lastHandoverMode: customer.lastHandoverMode,
            })),
          };
        },
        searchIntakeCustomers: async (query) => {
          const result = await searchOrderIntakeCustomersAction({ query });
          if (!result.ok) {
            return {
              code: result.error === "FORBIDDEN" || result.error === "AUTH_ERROR" ? "DENIED" as const : "UNAVAILABLE" as const,
              message: result.message,
            };
          }
          return {
            code: "OK" as const,
            customers: result.data.customers.map((customer) => ({
              id: customer.id,
              customerNumber: customer.customerNumber,
              name: customer.name,
              customerType: customer.customerType === "institution" ? "institution" as const : customer.customerType === "privat" || customer.customerType === "private" ? "privat" as const : "business" as const,
              companyName: customer.companyName,
              contactPerson: customer.contactPerson,
              email: customer.email,
              phone: customer.phone,
              street: customer.street ?? "",
              zipCode: customer.zipCode ?? "",
              city: customer.city,
              country: customer.country ?? "",
              paymentPreference: customer.paymentPreference ?? undefined,
              vatId: customer.vatId,
              lastHandoverMode: customer.lastHandoverMode,
            })),
          };
        },
        recognizeIntakeText: async (text) => {
          const result = await recognizeOrderIntakeTextAction({ text });
          if (result.ok) return { code: "OK" as const, data: result.data };
          return {
            code: result.error === "FORBIDDEN" ? "FORBIDDEN" as const : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" as const : "UNAVAILABLE" as const,
            message: result.message,
          };
        },
        getIntakeSuggestions: async (input) => {
          const result = await getOrderIntakeSuggestionsAction(input);
          if (result.ok) return { code: "OK" as const, data: result.data };
          return {
            code: result.error === "FORBIDDEN" ? "FORBIDDEN" as const : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" as const : "UNAVAILABLE" as const,
            message: result.message,
          };
        },
        listCatalog: async () => {
          if (!hasArea("geld")) return { code: "OK" as const, services: [] };
          const result = await getActiveCatalogAction();
          return result.code === "OK" ? result : { code: result.code === "FORBIDDEN" ? "DENIED" as const : "UNAVAILABLE" as const, message: result.message };
        },
        createCustomer: async (input: CreateCustomerInput): Promise<GlobalCreateCustomerResult> => {
          const result = await createCustomerAction(input);
          if (result.code !== "OK") return result;
          return {
            code: "OK",
            replayed: result.replayed,
            receipt: result.receipt,
            customer: {
              id: result.customer.id,
              customerNumber: result.customer.customerNumber,
              name: result.customer.name,
            },
          };
        },
        readCustomerCreateReceipt: async (input: CreateCustomerInput): Promise<GlobalCreateCustomerResult> => {
          const result = await readCustomerCreateReceiptAction(input);
          if (result.code !== "OK") return result;
          return { code: "OK", replayed: true, receipt: result.receipt, customer: {
            id: result.customer.id, customerNumber: result.customer.customerNumber, name: result.customer.name,
          } };
        },
        createQuote: async (input: CreateQuoteInput): Promise<GlobalCreateQuoteResult> => createQuoteAction(input),
        updateQuote: async (input: UpdateQuoteInput): Promise<GlobalCreateQuoteResult> => updateQuoteAction(input),
        readQuoteCreateReceipt: async (input: CreateQuoteInput): Promise<GlobalCreateQuoteResult> => {
          const result = await readQuoteCreateReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        readQuote: async (input: { quoteId: string }): Promise<GlobalCreateQuoteReadResult> => readQuoteAction(input),
        listOpenQuotes: async (): Promise<GlobalCreateOpenQuotesResult> => listOpenQuotesAction(),
        readQuoteUpdateReceipt: async (input: UpdateQuoteInput): Promise<GlobalCreateQuoteResult> => {
          const result = await readQuoteUpdateReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        convertQuote: async (input: ConvertQuoteInput): Promise<GlobalCreateConversionResult> => convertQuoteToOrderAction(input),
        readQuoteConversionReceipt: async (input: { quoteId: string; clientEventId: string }): Promise<GlobalCreateConversionResult> => {
          const result = await readQuoteConversionReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        createDirectIntake: async (input: DirectIntakeInput): Promise<GlobalCreateDirectIntakeResult> => {
          if (input.customer.mode !== "EXISTING") {
            return { code: "VALIDATION_ERROR", message: "AP-01 verarbeitet Aufträge nur für Bestandskunden." };
          }
          const result = await erfasseAuftragAusEingangAction({
            clientKey: input.clientEventId,
            text: input.note,
            customer: input.customer,
            dueDate: input.dueDate,
            items: input.items,
            handoverMode: input.handoverMode,
            paymentMode: input.paymentMode,
          });
          if (result.code !== "OK") return result;
          const readback = await getOrderIntakeReceiptAction({ orderId: result.orderId, clientEventId: input.clientEventId });
          if (!readback.ok) {
            return {
              code: readback.error === "FORBIDDEN" ? "FORBIDDEN" : readback.error === "AUTH_ERROR" ? "UNAUTHENTICATED" : "UNAVAILABLE",
              message: readback.message,
            };
          }
          if (!readback.data) return { code: "UNAVAILABLE", message: "Der gespeicherte Eingang konnte nicht sicher gelesen werden." };
          return { code: "OK", replayed: result.replayed, receipt: readback.data };
        },
        readDirectIntakeReceipt: async ({ orderId, clientEventId }): Promise<GlobalCreateDirectIntakeResult> => {
          const result = await getOrderIntakeReceiptAction({ orderId, clientEventId });
          if (!result.ok) {
            return {
              code: result.error === "FORBIDDEN" ? "FORBIDDEN" : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" : "UNAVAILABLE",
              message: result.message,
            };
          }
          if (!result.data) return { code: "NOT_FOUND", message: "Der gespeicherte Eingang wurde nicht gefunden." };
          return { code: "OK", replayed: true, receipt: result.data };
        },
        rememberQuote,
        rememberQuoteConversion,
        openCustomer,
        openOrder: (orderId) => router.push(`/orders/${encodeURIComponent(orderId)}`),
        refresh: () => router.refresh(),
        switchProfile: async () => {
          await logout();
          router.replace("/start");
          router.refresh();
        },
      }}
    />
  );
}
