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
      canCancel: false,
    };
  } else if (!authorization.ok) {
    initialState = {
      state: "DENIAL",
      message: "Sitzung oder Berechtigung ist nicht verfügbar.",
      canCancel: false,
    };
  } else if (!authorization.data.permissions.includes("perm_view_prices")) {
    initialState = {
      state: "DENIAL",
      message: "Rechnungsliste ist für diesen Login nicht freigegeben.",
      canCancel: false,
    };
  } else {
    const result = await readInvoiceSummaries(authorization.data);
    if (result.code === "OK") {
      initialState = {
        state: result.data.length === 0 ? "EMPTY" : "DATA",
        data: result.data,
        canCancel: authorization.data.permissions.includes("perm_view_prices"),
      };
    } else {
      initialState = {
        state: result.code === "FORBIDDEN" ? "DENIAL" : "ERROR",
        message: result.message,
        canCancel: false,
      };
    }
  }

  return <InvoicesClient initialState={initialState} />;
}
