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
