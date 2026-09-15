"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { createCustomerAction, getCustomersDb, readCustomerCreateReceiptAction } from "@/app/actions/customers.actions";
import { convertQuoteToOrderAction, createQuoteAction, readQuoteAction, readQuoteCreateReceiptAction, readQuoteConversionReceiptAction } from "@/app/actions/quotes.actions";
import { createOrderIntakeAction, getOrderIntakeReceiptAction } from "@/app/warendurchlauf/actions";
import {
  GlobalCreateFlow,
  type GlobalCreateConversionResult,
  type GlobalCreateCustomerResult,
  type GlobalCreateQuoteReadResult,
  type GlobalCreateQuoteResult,
  type GlobalCreateDirectIntakeResult,
  type DirectIntakeInput,
} from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { isAppRole } from "@/lib/auth/authorizationContract";
import { useOverlayStore } from "@/lib/overlayStore";
import type { ConvertQuoteInput, CreateQuoteInput } from "@/modules/quotes/public";

type CreateCustomerInput = Parameters<typeof createCustomerAction>[0];

const PENDING_QUOTE_KEY = "path1.global-create.pending-quote";

export function GlobalCreateAppAdapter() {
  const router = useRouter();
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const { hasPermission, name, role } = usePermissions();
  const [resumeQuoteId, setResumeQuoteId] = useState<string | null>(null);
  const canCreateCustomer = hasPermission("perm_data_customers");
  const canCreateQuote = hasPermission("perm_data_orders");
  const roleLabel = name.trim() || "dieses Profil";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setResumeQuoteId(window.sessionStorage.getItem(PENDING_QUOTE_KEY));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const rememberQuote = (quoteId: string | null) => {
    if (quoteId) window.sessionStorage.setItem(PENDING_QUOTE_KEY, quoteId);
    else window.sessionStorage.removeItem(PENDING_QUOTE_KEY);
    setResumeQuoteId(quoteId);
  };

  // Keep one safe, typed intake boundary mounted for authenticated workshop roles.
  // Their request is denied by the same flow before any command can run.
  if (!role || !isAppRole(role)) return null;

  return (
    <GlobalCreateFlow
      ports={{
        canCreateCustomer,
        canCreateQuote,
        showPrimaryTrigger: canCreateCustomer || canCreateQuote,
        roleLabel,
        resumeQuoteId,
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
              city: customer.city ?? null,
            })),
          };
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
        readQuoteCreateReceipt: async (input: CreateQuoteInput): Promise<GlobalCreateQuoteResult> => {
          const result = await readQuoteCreateReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        readQuote: async (input: { quoteId: string }): Promise<GlobalCreateQuoteReadResult> => readQuoteAction(input),
        convertQuote: async (input: ConvertQuoteInput): Promise<GlobalCreateConversionResult> => convertQuoteToOrderAction(input),
        readQuoteConversionReceipt: async (input: { quoteId: string; clientEventId: string }): Promise<GlobalCreateConversionResult> => {
          const result = await readQuoteConversionReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        createDirectIntake: async (input: DirectIntakeInput): Promise<GlobalCreateDirectIntakeResult> => {
          const result = await createOrderIntakeAction(input);
          if (result.code !== "OK") return result;
          return { code: "OK", replayed: result.replayed, receipt: result.receipt };
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
