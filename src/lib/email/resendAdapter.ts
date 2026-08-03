import { supabase } from "@/lib/supabase/client";
import { EmailProvider, EmailProviderOptions } from "./emailProvider";

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
    } catch (error: unknown) {
      console.error("ResendAdapter Exception:", error);
      return { success: false, error: getErrorMessage(error) };
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
