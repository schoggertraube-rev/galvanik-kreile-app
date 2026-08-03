import { supabase } from "@/lib/supabase/client";
import { PaymentProvider, PaymentIntentOptions } from "./paymentProvider";

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error as { message?: unknown };
    return typeof message === "string" ? message : undefined;
  }

  return undefined;
}

export class MollieAdapter implements PaymentProvider {
  async createPaymentIntent(opts: PaymentIntentOptions): Promise<{ success: boolean; checkoutUrl?: string; intentId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke("mollie-create-payment", {
        body: opts,
      });

      if (error) {
        console.error("MollieAdapter Create Error:", error);
        return { success: false, error: error.message };
      }

      return { success: data.success, checkoutUrl: data.checkoutUrl, intentId: data.intentId, error: data.error };
    } catch (error: unknown) {
      console.error("MollieAdapter Exception:", error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async getPaymentStatus(intentId: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('status, mollie_status')
        .eq('provider_intent_id', intentId)
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, status: data.status };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  supportsTapToPay(): boolean {
    return false; // Mollie does not natively support Tap-to-Pay via NFC without external hardware
  }

  async cancelPayment(intentId: string): Promise<{ success: boolean; error?: string }> {
    void intentId;
    // Basic implementation
    return { success: false, error: "Not implemented in MVP" };
  }
}

export const paymentProvider = new MollieAdapter();
