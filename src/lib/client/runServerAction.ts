export const CLIENT_ACTION_ERROR_CODE = "ACTION_REQUEST_FAILED" as const;

type ClientActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: typeof CLIENT_ACTION_ERROR_CODE; message: string };

export async function runServerAction<T>(
  task: () => Promise<T>,
  operation = "Die Aktion",
): Promise<ClientActionResult<T>> {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    console.error(`[${CLIENT_ACTION_ERROR_CODE}]`, error);
    return {
      ok: false,
      code: CLIENT_ACTION_ERROR_CODE,
      message: `${operation} konnte nicht ausgeführt werden. Fehlercode: ${CLIENT_ACTION_ERROR_CODE}. Bitte die Seite neu laden und erneut versuchen.`,
    };
  }
}
