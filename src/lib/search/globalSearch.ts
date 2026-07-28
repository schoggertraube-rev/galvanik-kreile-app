/**
 * Browser-side table searching is deliberately unavailable.  A future global
 * search must be a tenant-scoped server query with an auditable result source.
 */
export async function globalSearch(_query: string): Promise<never> {
  throw new Error("NOT_CONFIGURED: Globale Suche benötigt einen geprüften Serververtrag.");
}
