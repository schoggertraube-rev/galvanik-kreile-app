import { resolveAuthorization } from "@/lib/server/authorization";
import { readInvoiceSummaries } from "@/lib/server/invoiceRead";
import { canViewAccounting } from "@/modules/accounting/public";
import { InvoicesClient, type InvoicePageInitialState } from "./InvoicesClient";

export async function InvoicesAppAdapter() {
  let initialState: InvoicePageInitialState;
  const authorization = await resolveAuthorization();
  if (!authorization.ok && authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
    initialState = {
      state: "ERROR",
      message: authorization.message,
      canCancel: false,
    };
  } else if (!authorization.ok) {
    initialState = {
      state: "DENIAL",
      message: authorization.message,
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
