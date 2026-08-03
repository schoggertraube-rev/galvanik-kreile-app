export interface PaymentIntentOptions {
  amountEur: number;
  description: string;
  orderId: string;
  customerId?: string;
  metadata?: Record<string, PaymentMetadataValue>;
}

export type PaymentMetadataValue =
  | string
  | number
  | boolean
  | null
  | PaymentMetadataValue[]
  | { [key: string]: PaymentMetadataValue };

export interface PaymentProvider {
  createPaymentIntent(opts: PaymentIntentOptions): Promise<{ success: boolean; checkoutUrl?: string; intentId?: string; error?: string }>;
  getPaymentStatus(intentId: string): Promise<{ success: boolean; status?: string; error?: string }>;
  supportsTapToPay(): boolean;
  cancelPayment(intentId: string): Promise<{ success: boolean; error?: string }>;
}
