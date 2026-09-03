import { resolveAuthorization } from "@/lib/server/authorization";
import { readInvoiceSummaries } from "@/lib/server/invoiceRead";
import { InvoicesClient, type InvoicePageInitialState } from "./InvoicesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvoicesPage() {
  let initialState: InvoicePageInitialState;
  const authorization = await resolveAuthorization().catch(() => null);
  if (!authorization || (!authorization.ok && authorization.reason === "AUTHORIZATION_UNAVAILABLE")) {
    initialState = {
      state: "ERROR",
      message: "Rechnungsliste konnte nicht sicher geladen werden.",
      role: null,
    };
  } else if (!authorization.ok) {
    initialState = {
      state: "DENIAL",
      message: "Sitzung oder Berechtigung ist nicht verfügbar.",
      role: null,
    };
  } else if (!(["buero", "meister", "admin"] as const).includes(
    authorization.data.role as "buero" | "meister" | "admin",
  )) {
    initialState = {
      state: "DENIAL",
      message: "Rechnungsliste ist mit dieser Rolle nicht erlaubt.",
      role: authorization.data.role,
    };
  } else {
    const result = await readInvoiceSummaries(authorization.data);
    if (result.code === "OK") {
      initialState = {
        state: result.data.length === 0 ? "EMPTY" : "DATA",
        data: result.data,
        role: authorization.data.role as "buero" | "meister" | "admin",
      };
    } else {
      initialState = {
        state: result.code === "FORBIDDEN" ? "DENIAL" : "ERROR",
        message: result.message,
        role: authorization.data.role,
      };
    }
  }

  return <InvoicesClient initialState={initialState} />;
}
