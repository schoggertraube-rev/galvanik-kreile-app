export const CAPTURE_TENANT_ID = "galvanik-kreile";

const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const STATION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TimeCaptureInput = {
  orderId: string;
  stationKuerzel: string;
  minutes: number;
  clientRequestId: string;
  templateId?: string;
};

export type MaterialCaptureLine = {
  inventoryItemId: string;
  quantity: number;
  templateId?: string;
};

export type MaterialCaptureInput = {
  orderId: string;
  stationKuerzel: string;
  materials: MaterialCaptureLine[];
  clientRequestId: string;
};

export type TemplateCaptureInput = {
  orderId: string;
  clientRequestId: string;
};

export type StationCompletionCaptureInput = {
  orderId: string;
  expectedStation: string;
  minutes: number;
  multiplier: 1 | 2 | 3 | 4;
  taskType: string;
  note?: string;
  materials: MaterialCaptureLine[];
  clientRequestId: string;
};

function strictRecord(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_CAPTURE");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw new Error("INVALID_CAPTURE");
  return record;
}

export function parseCaptureEntityId(value: unknown): string {
  if (typeof value !== "string" || !ENTITY_ID.test(value)) throw new Error("INVALID_CAPTURE");
  return value;
}

export function parseCaptureStation(value: unknown): string {
  if (typeof value !== "string" || !STATION_ID.test(value)) throw new Error("INVALID_CAPTURE");
  return value;
}

export function parseCaptureRequestId(value: unknown): string {
  if (typeof value !== "string" || !UUID_V4.test(value)) throw new Error("INVALID_CAPTURE");
  return value.toLowerCase();
}

function parseOptionalTemplateId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !UUID_V4.test(value)) throw new Error("INVALID_CAPTURE");
  return value.toLowerCase();
}

function positiveFourDecimalNumber(value: unknown, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new Error("INVALID_CAPTURE");
  }
  const rounded = Math.round(value * 10_000) / 10_000;
  if (Math.abs(rounded - value) > Number.EPSILON * Math.max(1, Math.abs(value)) * 8) {
    throw new Error("INVALID_CAPTURE");
  }
  return rounded;
}

function boundedText(value: unknown, maximum: number, required: boolean): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error("INVALID_CAPTURE");
    return undefined;
  }
  if (typeof value !== "string") throw new Error("INVALID_CAPTURE");
  const normalized = value.trim();
  if ((required && normalized.length === 0) || normalized.length > maximum || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error("INVALID_CAPTURE");
  }
  return normalized || undefined;
}

function parseMaterialLines(value: unknown, allowEmpty: boolean): MaterialCaptureLine[] {
  if (!Array.isArray(value) || value.length > 50 || (!allowEmpty && value.length < 1)) {
    throw new Error("INVALID_CAPTURE");
  }
  const seen = new Set<string>();
  return value.map((raw) => {
    const line = strictRecord(raw, ["inventoryItemId", "quantity", "templateId"]);
    const inventoryItemId = parseCaptureEntityId(line.inventoryItemId);
    if (seen.has(inventoryItemId)) throw new Error("INVALID_CAPTURE");
    seen.add(inventoryItemId);
    return {
      inventoryItemId,
      quantity: positiveFourDecimalNumber(line.quantity, 1_000_000),
      templateId: parseOptionalTemplateId(line.templateId),
    };
  });
}

export function parseTimeCaptureInput(value: unknown): TimeCaptureInput {
  const input = strictRecord(value, ["orderId", "stationKuerzel", "minutes", "clientRequestId", "templateId"]);
  const minutes = positiveFourDecimalNumber(input.minutes, 1_440);
  if (!Number.isInteger(minutes)) throw new Error("INVALID_CAPTURE");
  return {
    orderId: parseCaptureEntityId(input.orderId),
    stationKuerzel: parseCaptureStation(input.stationKuerzel),
    minutes,
    clientRequestId: parseCaptureRequestId(input.clientRequestId),
    templateId: parseOptionalTemplateId(input.templateId),
  };
}

export function parseMaterialCaptureInput(value: unknown): MaterialCaptureInput {
  const input = strictRecord(value, ["orderId", "stationKuerzel", "materials", "clientRequestId"]);
  const materials = parseMaterialLines(input.materials, false);
  return {
    orderId: parseCaptureEntityId(input.orderId),
    stationKuerzel: parseCaptureStation(input.stationKuerzel),
    materials,
    clientRequestId: parseCaptureRequestId(input.clientRequestId),
  };
}

export function parseStationCompletionCaptureInput(value: unknown): StationCompletionCaptureInput {
  const input = strictRecord(value, [
    "orderId",
    "expectedStation",
    "minutes",
    "multiplier",
    "taskType",
    "note",
    "materials",
    "clientRequestId",
  ]);
  if (!Number.isInteger(input.minutes) || Number(input.minutes) < 0 || Number(input.minutes) > 1_440) {
    throw new Error("INVALID_CAPTURE");
  }
  if (![1, 2, 3, 4].includes(Number(input.multiplier)) || !Number.isInteger(input.multiplier)) {
    throw new Error("INVALID_CAPTURE");
  }
  const materials = parseMaterialLines(input.materials, true);
  if (Number(input.minutes) === 0 && materials.length === 0) throw new Error("INVALID_CAPTURE");
  const taskType = boundedText(input.taskType, 80, true);
  if (!taskType) throw new Error("INVALID_CAPTURE");
  return {
    orderId: parseCaptureEntityId(input.orderId),
    expectedStation: parseCaptureStation(input.expectedStation),
    minutes: Number(input.minutes),
    multiplier: Number(input.multiplier) as 1 | 2 | 3 | 4,
    taskType,
    note: boundedText(input.note, 500, false),
    materials,
    clientRequestId: parseCaptureRequestId(input.clientRequestId),
  };
}

export function parseTemplateCaptureInput(value: unknown): TemplateCaptureInput {
  const input = strictRecord(value, ["orderId", "clientRequestId"]);
  return {
    orderId: parseCaptureEntityId(input.orderId),
    clientRequestId: parseCaptureRequestId(input.clientRequestId),
  };
}
