"use server";

import { resolveAuthorization } from "@/lib/server/authorization";
import { saveTodayPreferences, saveTodayReminder, type TodayLayoutItem } from "@/lib/server/todayDashboard";

async function auth() {
  const result = await resolveAuthorization();
  if (!result.ok) return { ok: false as const, result: { code: result.reason === "AUTHORIZATION_UNAVAILABLE" ? "UNAVAILABLE" as const : "UNAUTHENTICATED" as const, message: "Sitzung oder Berechtigung ist nicht verfügbar." } };
  if (!result.data.permissions.includes("perm_view_leitstand")) return { ok: false as const, result: { code: "FORBIDDEN" as const, message: "Der Tag ist für dieses Profil nicht freigegeben." } };
  return { ok: true as const, data: result.data };
}

export async function saveTodayPreferencesAction(layout: TodayLayoutItem[]) {
  const authorization = await auth();
  if (!authorization.ok) return authorization.result;
  try { return await saveTodayPreferences(authorization.data, layout); }
  catch { return { code: "UNAVAILABLE" as const, message: "Die Feldauswahl konnte nicht sicher gespeichert werden." }; }
}

export async function saveTodayReminderAction(input: { itemKey: string; mode: "afternoon" | "tomorrow" | "after_due"; dueDate?: string }) {
  const authorization = await auth();
  if (!authorization.ok) return authorization.result;
  try { return await saveTodayReminder(authorization.data, input); }
  catch { return { code: "UNAVAILABLE" as const, message: "Die Erinnerung konnte nicht sicher gespeichert werden." }; }
}
