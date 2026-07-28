/**
 * Temporary fail-closed boundary for product areas whose server-side contract
 * has not yet passed the tenant, role, receipt and storage proof gates.
 */
export function foundationUnavailableResponse(area: string): Response {
  return Response.json(
    {
      error: "NOT_CONFIGURED",
      message: `${area} ist bis zum geprüften Fundamentvertrag nicht verfügbar.`,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Deliberately returns false until a named area has passed its data, tenant,
 * authorization and receipt checks. Keeping this as a function (rather than
 * an inline literal) lets TypeScript continue checking legacy code while the
 * runtime boundary remains fail-closed.
 */
export function isFoundationAreaEnabled(_area: string): boolean {
  return false;
}

export function foundationUnavailableAction(area: string): never {
  throw new Error(`NOT_CONFIGURED: ${area} ist bis zum geprüften Fundamentvertrag nicht verfügbar.`);
}
