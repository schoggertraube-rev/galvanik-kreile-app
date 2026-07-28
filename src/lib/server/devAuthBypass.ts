/**
 * A bypass can only exist in an explicitly opted-in local development process.
 * Preview and production must reject the cookie even when a browser carries it
 * forward from an old test session.
 */
export function allowsDevelopmentAuthBypass(input: {
  nodeEnv: string | undefined;
  explicitFlag: string | undefined;
  cookieValue: string | undefined;
}): boolean {
  return (
    input.nodeEnv === "development" &&
    input.explicitFlag === "true" &&
    input.cookieValue === "true"
  );
}

/**
 * Missing public Supabase variables are never an implicit local authentication
 * bypass. The proxy can continue without those variables only after the full,
 * explicitly opted-in development bypass has been verified.
 */
export function resolveProxyAuthEnvironment(input: {
  nodeEnv: string | undefined;
  explicitFlag: string | undefined;
  cookieValue: string | undefined;
  supabaseUrl: string | undefined;
  supabaseKey: string | undefined;
}): "development_bypass" | "misconfigured" | "configured" {
  if (allowsDevelopmentAuthBypass(input)) return "development_bypass";
  if (!input.supabaseUrl || !input.supabaseKey) return "misconfigured";
  return "configured";
}
