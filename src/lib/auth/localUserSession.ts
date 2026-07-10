export const LOCAL_USER_SESSION_EVENT = "local-user-session-changed";

export type LocalUserSession = {
  role: string;
  initials: string;
};

export function readLocalUserSession(): LocalUserSession | null {
  if (typeof window === "undefined") return null;
  const initials = localStorage.getItem("kreile_user_initials");
  const role = localStorage.getItem("kreile_user_role");
  if (!initials) return null;
  return {
    initials,
    role: role || "",
  };
}

export function writeLocalUserSession(session: LocalUserSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("kreile_user_role", session.role);
  localStorage.setItem("kreile_user_initials", session.initials);
  window.dispatchEvent(new Event(LOCAL_USER_SESSION_EVENT));
}

export function clearLocalUserSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("kreile_user_role");
  localStorage.removeItem("kreile_user_initials");
  window.dispatchEvent(new Event(LOCAL_USER_SESSION_EVENT));
}
