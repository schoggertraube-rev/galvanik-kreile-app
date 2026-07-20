const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const TEMPLATE_KEY = /^status_[a-z0-9._-]{1,72}$/;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StatusEmailRequest = {
  orderId: string;
  templateKey: string;
  idempotencyKey: string;
};

export function parseStatusEmailOrderId(value: unknown): string {
  if (typeof value !== "string" || !ENTITY_ID.test(value)) throw new Error("INVALID_STATUS_EMAIL_ORDER_ID");
  return value;
}

export function parseStatusEmailRequest(value: unknown): StatusEmailRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_STATUS_EMAIL_REQUEST");
  const object = value as Record<string, unknown>;
  const allowed = ["orderId", "templateKey", "idempotencyKey"];
  if (Object.keys(object).some((key) => !allowed.includes(key))) throw new Error("INVALID_STATUS_EMAIL_REQUEST");
  let orderId: string;
  try {
    orderId = parseStatusEmailOrderId(object.orderId);
  } catch {
    throw new Error("INVALID_STATUS_EMAIL_REQUEST");
  }
  if (typeof object.templateKey !== "string" || !TEMPLATE_KEY.test(object.templateKey)) throw new Error("INVALID_STATUS_EMAIL_REQUEST");
  if (typeof object.idempotencyKey !== "string") throw new Error("INVALID_STATUS_EMAIL_REQUEST");
  const prefix = `status/${orderId}/`;
  if (!object.idempotencyKey.startsWith(prefix) || !REQUEST_ID.test(object.idempotencyKey.slice(prefix.length))) {
    throw new Error("INVALID_STATUS_EMAIL_REQUEST");
  }
  return {
    orderId,
    templateKey: object.templateKey,
    idempotencyKey: object.idempotencyKey,
  };
}
