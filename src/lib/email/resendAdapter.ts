import { EmailProvider, EmailProviderOptions } from "./emailProvider";

export class ResendAdapter implements EmailProvider {
  async send(opts: EmailProviderOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
        cache: 'no-store',
      });
      const data = await response.json() as { ok?: boolean; messageId?: string; code?: string };
      if (!response.ok || data.ok !== true || !data.messageId) {
        return { success: false, error: data.code || 'EMAIL_DELIVERY_FAILED' };
      }
      return { success: true, messageId: data.messageId };
    } catch {
      return { success: false, error: 'EMAIL_DELIVERY_UNAVAILABLE' };
    }
  }

  supportsTemplates(): boolean {
    return true;
  }

  supportsWebhooks(): boolean {
    return true;
  }
}

export const emailProvider = new ResendAdapter();
