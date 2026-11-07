type ExpectedRed = { paket: string; grund: string; erwarteterWert?: string; tatsaechlicherWertEnthaelt?: string };

function isNamedTextDifference(error: unknown, red: ExpectedRed): boolean {
  if (!red.erwarteterWert && !red.tatsaechlicherWertEnthaelt) return true;
  if (!red.erwarteterWert || !red.tatsaechlicherWertEnthaelt || !(error instanceof Error)) return false;
  const matcher = (error as Error & { matcherResult?: { expected?: unknown; actual?: unknown } }).matcherResult;
  if (matcher) return matcher.expected === red.erwarteterWert
    && typeof matcher.actual === "string" && matcher.actual.includes(red.tatsaechlicherWertEnthaelt);
  const message = error.message.replace(/\u001b\[[0-9;]*m/g, "");
  return message.includes(red.erwarteterWert) && message.includes(red.tatsaechlicherWertEnthaelt);
}

export async function runWithExpectedRed(
  id: string | undefined,
  red: ExpectedRed | undefined,
  run: () => Promise<void>,
  warn: (...args: unknown[]) => void = console.warn,
): Promise<void> {
  if (!red) return run();
  try {
    await run();
  } catch (error) {
    if (!isNamedTextDifference(error, red)) throw error;
    warn("EXPECTED_RED", id, red.paket, red.grund, error);
    return;
  }
  warn("XPASS: Rot-Liste bereinigen", id, red.paket, red.grund);
}
