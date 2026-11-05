export type IntakeDeviceCommand =
  | { command: "request"; itemId: string }
  | { command: "accept"; deviceId: string; requestId?: string; token?: string }
  | { command: "end"; requestId: string; deviceId: string; reason: "fertig" | "abgebrochen" | "geschlossen" }
  | { command: "refresh"; requestId?: string };
export type IntakeDeviceRequest = { id: string; itemId: string; status: "angefordert" | "angenommen" | "fotos_da" | "beendet" | "abgelaufen"; expiresAt: string; acceptedOn: string[]; finishedOn: string[]; photoCount: number };
export type IntakeDeviceResult = { code: "OK"; requests: IntakeDeviceRequest[]; token?: string }
  | { code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE"; message: string };
export function getIntakeDeviceId(): string {
  const key = "kreile-browser-device-v1";
  const stored = localStorage.getItem(key);
  if (stored && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(stored)) return stored;
  const value = crypto.randomUUID(); localStorage.setItem(key, value); return value;
}
