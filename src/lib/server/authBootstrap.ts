import {
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";

export type AuthBootstrapState =
  | { status: "authenticated"; session: AuthorizationSnapshot }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

/**
 * Serverseitiger Bootstrap fuer den kanonischen Benutzerzustand.
 * Loest die Autorisierung einmal serverseitig auf und seeded den Client-Context
 * ohne Local-Storage-Fallbacks oder Navigation-Roundtrips.
 */
export async function getAuthBootstrapState(): Promise<AuthBootstrapState> {
  const result = await resolveAuthorization();

  if (result.ok) {
    return {
      status: "authenticated",
      session: result.data,
    };
  }

  if (result.reason === "NO_SESSION") {
    return { status: "unauthenticated" };
  }

  return {
    status: "error",
    message: result.message,
  };
}
