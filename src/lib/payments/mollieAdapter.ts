import type { PaymentIntentOptions, PaymentProvider } from "./paymentProvider";

/** No browser-to-provider transport before payment ownership and receipts are proven. */
export class MollieAdapter implements PaymentProvider {
  async createPaymentIntent(_opts: PaymentIntentOptions): Promise<{ success: boolean; checkoutUrl?: string; intentId?: string; error?: string }> {
void _opts;
    return { success: false, error: "NOT_CONFIGURED: Zahlungen benötigen einen geprüften Server- und Receipt-Vertrag." };
  }

  async getPaymentStatus(_intentId: string): Promise<{ success: boolean; status?: string; error?: string }> {
void _intentId;
    return { success: false, error: "NOT_CONFIGURED: Zahlungsstatus ist noch nicht freigegeben." };
  }

  supportsTapToPay(): boolean {
    return false;
  }

  async cancelPayment(_intentId: string): Promise<{ success: boolean; error?: string }> {
void _intentId;
    return { success: false, error: "NOT_CONFIGURED: Zahlungen sind noch nicht freigegeben." };
  }
}

export const paymentProvider = new MollieAdapter();
