import { readAppSession, type AppSession } from "@/lib/server/appSession";

export type AuthBootstrapState =
  | { status: "authenticated"; session: AppSession }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

/**
 * Serverseitiger Bootstrap für den kanonischen Benutzerzustand.
 * Liest ausschließlich die App-Session ohne Fallbacks auf Local Storage oder UI-Platzhalter ("?").
 */
export async function getAuthBootstrapState(): Promise<AuthBootstrapState> {
  const result = await readAppSession();

  if (result.ok) {
    return {
      status: "authenticated",
      session: result.session,
    };
  }

  // Bei NO_COOKIE gehen wir von unauthenticated aus.
  if (result.reason === "NO_COOKIE") {
    return { status: "unauthenticated" };
  }

  // Alle anderen Fehler (EXPIRED, MALFORMED, INVALID_SIGNATURE, INVALID_TENANT)
  // sind echte Fehlerzustände, die der Client entsprechend verarbeiten kann.
  return {
    status: "error",
    message: `Sitzungsfehler: ${result.reason}`,
  };
}
