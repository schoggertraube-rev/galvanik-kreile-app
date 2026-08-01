export type StartUserDto = {
  id: string;
  initials: string;
  role: string;
  fullName: string;
};

export type StartUserSource = {
  id: string;
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
  pinStatus: AdminPinStatus;
};

export type AdminPinStatus =
  | "ready"
  | "needs_rotation"
  | "missing"
  | "not_applicable";

export type AdminUserSource = AdminUserDto;

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
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    initials: deriveUserInitials(user.fullName),
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
    pinStatus: user.pinStatus,
  };
}
