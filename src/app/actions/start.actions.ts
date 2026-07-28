"use server";

export async function getTodayTopPriority() {
  return {
    taskText: null,
    success: false,
    reason: "NOT_CONFIGURED",
  };
}

export async function getFeierabendEvents() {
  return {
    event: null,
    success: false,
    reason: "NOT_CONFIGURED",
  };
}

export async function notifyAdminPinReset(userId: string, userName: string) {
  void userId;
  void userName;
  return { success: false, reason: "NOT_CONFIGURED" };
}
