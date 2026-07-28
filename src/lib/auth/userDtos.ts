export type StartUserDto = {
  loginSelector: string;
  initials: string;
  loginKind: "office" | "workshop";
};

export type StartUserSource = {
  selector: string;
  fullName: string;
  role: string;
};

export type AdminUserDto = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  location: string | null;
  language: string | null;
};

export type AdminUserSource = AdminUserDto & {
  pinHash?: string | null;
};

export function deriveUserInitials(fullName: string): string {
  const normalized = fullName.trim();
  if (!normalized) return "?";

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
}

export function toStartUserDto(user: StartUserSource): StartUserDto {
  return {
    loginSelector: user.selector,
    initials: deriveUserInitials(user.fullName),
    loginKind: user.role === "buero" || user.role === "office" ? "office" : "workshop",
  };
}

export function toAdminUserDto(user: AdminUserSource): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
    location: user.location,
    language: user.language,
  };
}
