import "server-only";

import type {
  AppRole,
  PermissionKey,
  ProductIdentity,
} from "@/lib/auth/authorizationContract";
import { resolveProductActorAuthorization } from "@/lib/server/productActorReadiness";

export type AuthBootstrapUser = {
  role: AppRole;
  displayName: ProductIdentity["name"];
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
 * Sitzung, DB-Rolle und alle drei Produktprofile; interne IDs verlassen den
 * Server dabei nicht. Rolle, Anzeigename und Faehigkeiten stammen aus genau
 * einer Aufloesung und werden deshalb atomar ausgeliefert.
 */
export async function getAuthBootstrapState(): Promise<AuthBootstrapState> {
  const result = await resolveProductActorAuthorization();

  if (result.ok) {
    return {
      status: "authenticated",
      user: {
        role: result.data.authorization.role,
        displayName: result.data.actor.identity.name,
        // Kopie: die geteilte Vertragstabelle bleibt unveraenderlich.
        permissions: [...result.data.authorization.permissions],
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
    supportReference: result.supportReference,
  };
}
