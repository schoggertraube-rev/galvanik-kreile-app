export interface EmailProviderOptions {
  to: string;
  templateKey: string;
  variables: Record<string, string>;
  orderId?: string;
  customerId?: string;
  idempotencyKey: string;
}

export interface EmailProvider {
  send(opts: EmailProviderOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
  supportsTemplates(): boolean;
  supportsWebhooks(): boolean;
}
