import { supabase } from "@/lib/supabase/client";
import { EmailProvider, EmailProviderOptions } from "./emailProvider";

export class ResendAdapter implements EmailProvider {
  async send(opts: EmailProviderOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke("email-send", {
        body: opts,
      });

      if (error) {
        console.error("ResendAdapter Invoke Error:", error);
        return { success: false, error: error.message };
      }

      return { success: data.success, messageId: data.messageId, error: data.error };
    } catch (e: any) {
      console.error("ResendAdapter Exception:", e);
      return { success: false, error: e.message };
    }
  }

  supportsTemplates(): boolean {
    return true; // We resolve templates via the Edge Function and DB
  }

  supportsWebhooks(): boolean {
    return true; // Resend Webhooks update communications table via Edge Function
  }
}

export const emailProvider = new ResendAdapter();
