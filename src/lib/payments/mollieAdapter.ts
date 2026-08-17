import { PaymentProvider, PaymentIntentOptions } from "./paymentProvider";

const notAvailable = "NOT_AVAILABLE: Zahlungsanbieter sind bis zum serverseitigen Command-Vertrag nicht verfügbar.";

export class MollieAdapter implements PaymentProvider {
  async createPaymentIntent(_opts: PaymentIntentOptions): Promise<{ success: boolean; checkoutUrl?: string; intentId?: string; error?: string }> { void _opts; return { success: false, error: notAvailable }; }
  async getPaymentStatus(_intentId: string): Promise<{ success: boolean; status?: string; error?: string }> { void _intentId; return { success: false, error: notAvailable }; }
  supportsTapToPay(): boolean { return false; }
  async cancelPayment(_intentId: string): Promise<{ success: boolean; error?: string }> { void _intentId; return { success: false, error: notAvailable }; }
}

export const paymentProvider = new MollieAdapter();
