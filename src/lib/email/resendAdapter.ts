import type { EmailProvider, EmailProviderOptions } from "./emailProvider";

/** No browser-to-Edge transport before a server-side mail receipt exists. */
export class ResendAdapter implements EmailProvider {
  async send(_opts: EmailProviderOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return { success: false, error: "NOT_CONFIGURED: E-Mail-Versand benötigt einen geprüften Server- und Receipt-Vertrag." };
  }

  supportsTemplates(): boolean {
    return false;
  }

  supportsWebhooks(): boolean {
    return false;
  }
}

export const emailProvider = new ResendAdapter();
