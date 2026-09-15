"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { createCustomerAction, getCustomersDb } from "@/app/actions/customers.actions";
import { convertQuoteToOrderAction, createQuoteAction, readQuoteAction } from "@/app/actions/quotes.actions";
import {
  GlobalCreateFlow,
  type GlobalCreateConversionResult,
  type GlobalCreateCustomerResult,
  type GlobalCreateQuoteReadResult,
  type GlobalCreateQuoteResult,
} from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { getRoleLabel, isAppRole } from "@/lib/auth/authorizationContract";
import { useOverlayStore } from "@/lib/overlayStore";
import type { ConvertQuoteInput, CreateQuoteInput } from "@/modules/quotes/public";

type CreateCustomerInput = Parameters<typeof createCustomerAction>[0];

const PENDING_QUOTE_KEY = "path1.global-create.pending-quote";

export function GlobalCreateAppAdapter() {
  const router = useRouter();
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const { hasPermission, role } = usePermissions();
  const [resumeQuoteId, setResumeQuoteId] = useState<string | null>(null);

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

  return (
    <GlobalCreateFlow
      ports={{
        canCreateCustomer: hasPermission("perm_data_customers"),
        canCreateQuote: hasPermission("perm_data_orders"),
        roleLabel: role && isAppRole(role) ? getRoleLabel(role) : "aktuelles",
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
        createQuote: async (input: CreateQuoteInput): Promise<GlobalCreateQuoteResult> => createQuoteAction(input),
        readQuote: async (input: { quoteId: string }): Promise<GlobalCreateQuoteReadResult> => readQuoteAction(input),
        convertQuote: async (input: ConvertQuoteInput): Promise<GlobalCreateConversionResult> => convertQuoteToOrderAction(input),
        rememberQuote,
        openCustomer,
        openOrder: (orderId) => router.push(`/orders/${encodeURIComponent(orderId)}`),
        switchProfile: async () => {
          await logout();
          router.replace("/start");
          router.refresh();
        },
      }}
    />
  );
}
