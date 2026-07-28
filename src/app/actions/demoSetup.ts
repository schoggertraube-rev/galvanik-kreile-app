"use server";

import { foundationUnavailableAction } from "@/lib/server/foundationGate";

/** Demo seeding is never an unauthenticated product capability. */
export async function initializeDemoIfNeeded() {
  return foundationUnavailableAction("Demo-Initialisierung");
}
