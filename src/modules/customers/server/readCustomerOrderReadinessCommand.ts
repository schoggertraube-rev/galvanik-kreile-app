import "server-only";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { kundeVollstaendigkeit } from "../orderReadiness";
import { readCustomerProfile } from "./customerWriteContract";
import type { CustomerCommandContext, ReadCustomerOrderReadinessInput, ReadCustomerOrderReadinessResult } from "./types";

export async function readCustomerOrderReadinessCommand(
  context: Pick<CustomerCommandContext,"tenantId">,input: ReadCustomerOrderReadinessInput,
): Promise<ReadCustomerOrderReadinessResult> {
  try {
    return await withPrivilegedTenantTransaction(context,async tx=>{
      const customer=await readCustomerProfile(tx,context.tenantId,input.customerId);
      if(!customer)return {code:"NOT_FOUND",message:"Der ausgewählte Kunde ist nicht verfügbar."};
      const readiness=kundeVollstaendigkeit(customer,{geld:input.requirePaymentPreference});
      if(customer.customerType==="lieferant")return {code:"OK",readiness:{...readiness,vollstaendig:false,issues:[{field:"customerType",message:"Lieferanten erhalten keine Aufträge."}]}};
      return {code:"OK",readiness};
    });
  } catch(error) {
    console.error("[CUSTOMER_ORDER_READINESS_READ_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});
    return {code:"UNAVAILABLE",message:"Kundenstand konnte nicht sicher gelesen werden. Fehlercode: CUSTOMER_ORDER_READINESS_READ_FAILED."};
  }
}
