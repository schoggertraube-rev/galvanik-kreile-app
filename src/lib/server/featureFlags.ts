import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { eq } from "drizzle-orm";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function parseFlagValue(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return undefined;
}

async function readFeatureFlagRow(flagName: string): Promise<boolean | undefined> {
  try {
    const rows = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.name, flagName))
      .limit(1);

    return rows[0]?.enabled ?? undefined;
  } catch (error) {
    console.error("feature flag lookup failed:", {
      flagName,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return undefined;
  }
}

/**
 * Serverseitige Flag-Aufloesung mit env-Vorrang und DB-Fallback.
 */
export async function isServerFeatureEnabled(
  flagName: string,
  defaultValue = false,
): Promise<boolean> {
  const envValue = parseFlagValue(process.env[flagName]);
  if (envValue !== undefined) {
    return envValue;
  }

  const dbValue = await readFeatureFlagRow(flagName);
  return dbValue ?? defaultValue;
}
