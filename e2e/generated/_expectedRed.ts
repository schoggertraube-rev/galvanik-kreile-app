type ExpectedRed = { paket: string; grund: string };

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
    warn("EXPECTED_RED", id, red.paket, red.grund, error);
    return;
  }
  warn("XPASS: Rot-Liste bereinigen", id, red.paket, red.grund);
}
