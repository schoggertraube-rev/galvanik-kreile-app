export interface EmailProviderOptions {
  templateKey: string;
  orderId: string;
  idempotencyKey: string;
}

export interface EmailProvider {
  send(opts: EmailProviderOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
  supportsTemplates(): boolean;
  supportsWebhooks(): boolean;
}
