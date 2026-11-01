import type {
  OrderIntakeItemInput,
} from "@/lib/server/commands/orderIntakeCommand";
import type { PaymentMode } from "@/lib/server/paymentContract";

export type ErfasseAuftragInput = {
  clientKey: string;
  text: string | null;
  customer: { mode: "EXISTING"; customerId: string };
  dueDate: string;
  items: OrderIntakeItemInput[];
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
    }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "CUSTOMER_INCOMPLETE"; message: string; missing: string[] }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "CONFLICT"; message: string };
