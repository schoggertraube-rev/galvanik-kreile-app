import { resolveAuthorization } from "@/lib/server/authorization";
import { readInvoiceSummaries } from "@/lib/server/invoiceRead";
import { canViewAccounting } from "@/modules/accounting/public";
import { InvoicesClient, type InvoicePageInitialState } from "./InvoicesClient";

export async function InvoicesAppAdapter() {
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
  } else if (!canViewAccounting(authorization.data)) {
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
        canCancel: canViewAccounting(authorization.data),
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
