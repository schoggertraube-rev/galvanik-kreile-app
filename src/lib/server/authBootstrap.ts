import { readAppSession, type AppSession } from "@/lib/server/appSession";
import { getProductIdentity } from "@/lib/auth/authorizationContract";

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
    const identity = getProductIdentity(result.session.userId);
    if (!identity) {
      return {
        status: "error",
        message: "Sitzungsfehler: Kein eindeutiges Produktprofil konfiguriert",
      };
    }
    return {
      status: "authenticated",
      session: {
        ...result.session,
        displayName: identity.name,
      },
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
