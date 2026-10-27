import "server-only";

import type {
  AppRole,
  PermissionKey,
} from "@/lib/auth/authorizationContract";
import { resolveAuthorization } from "@/lib/server/authorization";

export type AuthBootstrapUser = {
  role: AppRole;
  displayName: string;
  /**
   * Dieselbe serverseitig aufgeloeste Faehigkeitsliste wie in
   * `getAuthorizationSnapshotAction`. Sie ist bereits clientsichtbar und
   * ersetzt lediglich den redundanten Mount-Nachschlag; sie ist keine
   * zweite Berechtigungswahrheit.
   */
  permissions: readonly PermissionKey[];
};

export type AuthBootstrapState =
  | { status: "authenticated"; user: AuthBootstrapUser }
  | { status: "unauthenticated" }
  | { status: "error"; message: string; supportReference?: string };

/**
 * Browser-minimaler Bootstrap. Derselbe serverseitige Chokepoint validiert
 * Sitzung, aktive DB-Nutzerzeile und Rolle; interne IDs verlassen den
 * Server dabei nicht. Rolle, Anzeigename und Faehigkeiten stammen aus genau
 * einer Aufloesung und werden deshalb atomar ausgeliefert.
 */
export async function getAuthBootstrapState(): Promise<AuthBootstrapState> {
  const result = await resolveAuthorization();

  if (result.ok) {
    return {
      status: "authenticated",
      user: {
        role: result.data.role,
        displayName: result.data.displayName,
        // Kopie: die geteilte Vertragstabelle bleibt unveraenderlich.
        permissions: [...result.data.permissions],
      },
    };
  }

  if (result.reason === "NO_SESSION") {
    return { status: "unauthenticated" };
  }

  if (result.reason === "INVALID_SESSION") {
    return {
      status: "error",
      message: "Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.",
    };
  }

  return {
    status: "error",
    message: "Der Produktzugang ist momentan nicht sicher verfügbar.",
  };
}
