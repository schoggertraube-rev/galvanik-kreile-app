const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export type HandoverMethod = "shipment" | "pickup";

export type CompleteHandoverInput = {
  orderId: string;
  clientRequestId: string;
  method: HandoverMethod;
  reference: string;
  carrier?: string;
  recipient?: string;
  note?: string;
  confirmed: true;
};

function strictRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_HANDOVER");
  const record = value as Record<string, unknown>;
  const allowed = ["orderId", "clientRequestId", "method", "reference", "carrier", "recipient", "note", "confirmed"];
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw new Error("INVALID_HANDOVER");
  return record;
}

function text(value: unknown, maximum: number, required: boolean): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error("INVALID_HANDOVER");
    return undefined;
  }
  if (typeof value !== "string") throw new Error("INVALID_HANDOVER");
  const normalized = value.trim();
  if ((!normalized && required) || normalized.length > maximum || CONTROL_CHARACTERS.test(normalized)) {
    throw new Error("INVALID_HANDOVER");
  }
  return normalized || undefined;
}

export function parseCompleteHandoverInput(value: unknown): CompleteHandoverInput {
  const input = strictRecord(value);
  if (typeof input.orderId !== "string" || !ENTITY_ID.test(input.orderId)) throw new Error("INVALID_HANDOVER");
  if (typeof input.clientRequestId !== "string" || !UUID_V4.test(input.clientRequestId)) throw new Error("INVALID_HANDOVER");
  if (input.method !== "shipment" && input.method !== "pickup") throw new Error("INVALID_HANDOVER");
  if (input.confirmed !== true) throw new Error("INVALID_HANDOVER");

  const reference = text(input.reference, 120, true);
  const note = text(input.note, 500, false);
  if (!reference) throw new Error("INVALID_HANDOVER");

  if (input.method === "shipment") {
    const carrier = text(input.carrier, 80, true);
    if (!carrier || input.recipient !== undefined) throw new Error("INVALID_HANDOVER");
    return {
      orderId: input.orderId,
      clientRequestId: input.clientRequestId.toLowerCase(),
      method: input.method,
      reference,
      carrier,
      ...(note ? { note } : {}),
      confirmed: true,
    };
  }

  const recipient = text(input.recipient, 120, true);
  if (!recipient || input.carrier !== undefined) throw new Error("INVALID_HANDOVER");
  return {
    orderId: input.orderId,
    clientRequestId: input.clientRequestId.toLowerCase(),
    method: input.method,
    reference,
    recipient,
    ...(note ? { note } : {}),
    confirmed: true,
  };
}

export function getHandoverEventType(method: HandoverMethod): "SHIPMENT_SENT" | "CUSTOMER_PICKUP" {
  return method === "shipment" ? "SHIPMENT_SENT" : "CUSTOMER_PICKUP";
}
