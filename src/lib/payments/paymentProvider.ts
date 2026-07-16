export interface PaymentIntentOptions {
  orderId: string;
}

export type PaymentIntentResult =
  | { success: true; checkoutUrl: string; intentId: string; amountCents: number }
  | { success: false; error: string };

export type PaymentStatusResult =
  | { success: true; status: string; providerStatus: string | null }
  | { success: false; error: string };

export interface PaymentProvider {
  createPaymentIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult>;
  getPaymentStatus(intentId: string): Promise<PaymentStatusResult>;
  supportsTapToPay(): boolean;
  cancelPayment(intentId: string): Promise<{ success: boolean; error?: string }>;
}
