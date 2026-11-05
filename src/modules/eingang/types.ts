import type {
  OrderIntakeCustomerInput,
  OrderIntakeItemInput,
  OrderIntakeSource,
  OrderIntakeTermStatus,
} from "@/lib/server/commands/orderIntakeCommand";
import type { PaymentMode } from "@/lib/server/paymentContract";

import type {IntakeTermOrigin} from "@/lib/intakeSuggestionsContract";
export type ErfasseAuftragInput = {
  wishDate?:string|null;termOrigin?:IntakeTermOrigin|null;processingWeeks?:1|2|3|5|null;
  geprueft: boolean;
  draftId?: string;
  sourceCaptures?:Array<{id:string;version:number}>;
  clientKey: string;
  text: string | null;
  telefonNotiz?: string | null;
  customer: OrderIntakeCustomerInput;
  dueDate: string;
  items: OrderIntakeItemInput[];
  intakeSource?: OrderIntakeSource;
  termStatus?: OrderIntakeTermStatus;
  handoverMode?: "pickup" | "shipping";
  paymentMode?: PaymentMode;
};

export type ErfasseAuftragResult =
  | {
      code: "OK";
      orderNumber: string;
      orderId: string;
      intakeItemId: string;
      replayed: boolean;
      confirmationMessage?: string;
    }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "CUSTOMER_INCOMPLETE"; message: string; missing: string[] }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "CONFLICT"; message: string };
