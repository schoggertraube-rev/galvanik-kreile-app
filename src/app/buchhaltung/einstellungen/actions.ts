"use server";

import { db } from "@/db";
import { bhAuditLog, bhEinstellungen, steuerprofil } from "@/db/schema_buchhaltung";
import {
  FINANCE_SETTINGS_ID,
  parseFinanceSettingsInput,
  resolveOcrRuntimeStatus,
  type FinanceLedger,
  type FinanceSettingsReceipt,
  type FinanceSettingsSnapshot,
} from "@/lib/buchhaltung/settingsContract";
import { requireFinanceAdmin, requireFinanceRead } from "@/lib/server/financeAuthorization";
import { eq } from "drizzle-orm";

function ledger(value: string | null): FinanceLedger {
  if (value !== "SKR03" && value !== "SKR04") {
    throw new Error("FINANCE_PROFILE_INVALID_LEDGER");
  }
  return value;
}

function confidence(value: string | null): number {
  const parsed = Number(value ?? 85);
  if (!Number.isInteger(parsed) || parsed < 50 || parsed > 99) {
    throw new Error("FINANCE_SETTINGS_INVALID_CONFIDENCE");
  }
  return parsed;
}

export async function getFinanceSettingsAction(): Promise<FinanceSettingsSnapshot> {
  const actor = await requireFinanceRead();
  const [profiles, settingsRows] = await Promise.all([
    db.select().from(steuerprofil).where(eq(steuerprofil.aktiv, true)).limit(2),
    db.select().from(bhEinstellungen).where(eq(bhEinstellungen.id, FINANCE_SETTINGS_ID)).limit(1),
  ]);

  if (profiles.length === 0) throw new Error("FINANCE_PROFILE_NOT_CONFIGURED");
  if (profiles.length > 1) throw new Error("FINANCE_PROFILE_AMBIGUOUS");

  const profile = profiles[0];
  const settings = settingsRows[0];
  const profileLedger = ledger(profile.sachkontenrahmen);
  const settingsLedger = settings?.standardKontenrahmen
    ? ledger(settings.standardKontenrahmen)
    : profileLedger;
  if (settings && settingsLedger !== profileLedger) {
    throw new Error("FINANCE_SETTINGS_LEDGER_MISMATCH");
  }

  return {
    profileId: profile.id,
    standardKontenrahmen: settingsLedger,
    ocrConfidenceSchwelle: confidence(settings?.ocrConfidenceSchwelle ?? null),
    beraterNr: profile.beraterNr?.trim() || null,
    mandantenNr: profile.mandantenNr?.trim() || null,
    persisted: Boolean(settings),
    editable: actor.role === "admin" || actor.role === "developer",
    updatedAt: settings?.aktualisiertAm?.toISOString() ?? null,
    ocr: resolveOcrRuntimeStatus(process.env),
  };
}

export async function updateFinanceSettingsAction(value: unknown): Promise<FinanceSettingsReceipt> {
  const actor = await requireFinanceAdmin();
  const input = parseFinanceSettingsInput(value);

  const receipt = await db.transaction(async (tx) => {
    const profiles = await tx
      .select()
      .from(steuerprofil)
      .where(eq(steuerprofil.aktiv, true))
      .limit(2)
      .for("update");
    if (profiles.length === 0) throw new Error("FINANCE_PROFILE_NOT_CONFIGURED");
    if (profiles.length > 1) throw new Error("FINANCE_PROFILE_AMBIGUOUS");

    const profile = profiles[0];
    const [previousSettings] = await tx
      .select()
      .from(bhEinstellungen)
      .where(eq(bhEinstellungen.id, FINANCE_SETTINGS_ID))
      .limit(1)
      .for("update");

    const now = new Date();
    const [savedSettings] = await tx
      .insert(bhEinstellungen)
      .values({
        id: FINANCE_SETTINGS_ID,
        standardKontenrahmen: input.standardKontenrahmen,
        ocrConfidenceSchwelle: String(input.ocrConfidenceSchwelle),
        aktualisiertAm: now,
      })
      .onConflictDoUpdate({
        target: bhEinstellungen.id,
        set: {
          standardKontenrahmen: input.standardKontenrahmen,
          ocrConfidenceSchwelle: String(input.ocrConfidenceSchwelle),
          aktualisiertAm: now,
        },
      })
      .returning();
    const [savedProfile] = await tx
      .update(steuerprofil)
      .set({
        sachkontenrahmen: input.standardKontenrahmen,
        beraterNr: input.beraterNr,
        mandantenNr: input.mandantenNr,
      })
      .where(eq(steuerprofil.id, profile.id))
      .returning();
    if (!savedSettings || !savedProfile) throw new Error("WRITE_RECEIPT_MISSING");

    const before = {
      standardKontenrahmen: previousSettings?.standardKontenrahmen ?? profile.sachkontenrahmen,
      ocrConfidenceSchwelle: confidence(previousSettings?.ocrConfidenceSchwelle ?? null),
      beraterNr: profile.beraterNr?.trim() || null,
      mandantenNr: profile.mandantenNr?.trim() || null,
    };
    const after = {
      standardKontenrahmen: ledger(savedSettings.standardKontenrahmen),
      ocrConfidenceSchwelle: confidence(savedSettings.ocrConfidenceSchwelle),
      beraterNr: savedProfile.beraterNr?.trim() || null,
      mandantenNr: savedProfile.mandantenNr?.trim() || null,
    };
    const [audit] = await tx
      .insert(bhAuditLog)
      .values({
        benutzer: actor.userId,
        entitaet: "finance_settings",
        entitaetId: profile.id,
        aktion: "updated",
        vorher: before,
        nachher: after,
      })
      .returning({ id: bhAuditLog.id });
    if (!audit) throw new Error("AUDIT_RECEIPT_MISSING");

    return {
      ...after,
      profileId: savedProfile.id,
      persisted: true,
      editable: true,
      updatedAt: savedSettings.aktualisiertAm.toISOString(),
      auditId: audit.id,
    };
  });

  return {
    ...receipt,
    ocr: resolveOcrRuntimeStatus(process.env),
  };
}
