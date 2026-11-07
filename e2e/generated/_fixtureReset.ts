/** Retry only an aborted fixture-cleanup transaction on the isolated replay DB. */
export async function retryFixtureResetDeadlock<T>(reset: () => Promise<T>, warn: (...args: unknown[]) => void = console.warn): Promise<T> {
  try {
    return await reset();
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "40P01") throw error;
    warn("FLOW_REPLAY_FIXTURE_RESET_DEADLOCK_RETRY_ONCE");
    return reset();
  }
}
