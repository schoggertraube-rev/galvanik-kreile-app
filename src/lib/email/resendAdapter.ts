import { EmailProvider, EmailProviderOptions } from "./emailProvider";

const notAvailable = "NOT_AVAILABLE: E-Mail-Versand ist bis zum serverseitigen Command-Vertrag nicht verfügbar.";

export class ResendAdapter implements EmailProvider {
  async send(_opts: EmailProviderOptions): Promise<{ success: boolean; messageId?: string; error?: string }> { void _opts; return { success: false, error: notAvailable }; }
  supportsTemplates(): boolean { return false; }
  supportsWebhooks(): boolean { return true; }
}

export const emailProvider = new ResendAdapter();
