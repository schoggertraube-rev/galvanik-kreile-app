export const PIN_LENGTH = 4;
export const POSTGRES_BCRYPT_PATTERN = "^\\$2a\\$12\\$[./A-Za-z0-9]{53}$";
export const PIN_LOGIN_ROLES = [
  "meister",
  "buero",
  "werkstatt",
  "readonly",
] as const;

export type PinLoginRole = (typeof PIN_LOGIN_ROLES)[number];

const PIN_PATTERN = /^\d{4}$/;

const BLOCKED_PINS = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "0123",
  "1234",
  "2345",
  "3456",
  "4567",
  "5678",
  "6789",
  "9876",
  "8765",
  "7654",
  "6543",
  "5432",
  "4321",
  "3210",
  "2580",
  "0852",
]);

export type PinValidationResult =
  | { ok: true; pin: string }
  | { ok: false; message: string };

export function isLoginPin(value: unknown): value is string {
  return typeof value === "string" && PIN_PATTERN.test(value);
}

export function isPinLoginRole(value: unknown): value is PinLoginRole {
  return typeof value === "string" && PIN_LOGIN_ROLES.some((role) => role === value);
}

export function validateNewPin(value: unknown): PinValidationResult {
  if (!isLoginPin(value)) {
    return {
      ok: false,
      message: "Die PIN muss genau aus vier Ziffern bestehen.",
    };
  }

  if (BLOCKED_PINS.has(value)) {
    return {
      ok: false,
      message: "Diese PIN ist zu leicht zu erraten. Bitte eine andere PIN wählen.",
    };
  }

  return { ok: true, pin: value };
}
