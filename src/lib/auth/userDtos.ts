import { getProductIdentity } from "./authorizationContract";

export type StartUserDto = {
  loginHandle: string;
  identity: "rolf" | "phillip";
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

export function toStartUserDto(
  user: StartUserSource,
  loginHandle: string,
): StartUserDto | null {
  const productIdentity = getProductIdentity(user.id);
  if (
    !productIdentity
    || (productIdentity.name !== "Rolf" && productIdentity.name !== "Phillip")
    || (productIdentity.name === "Rolf" && user.role !== "meister")
    || (productIdentity.name === "Phillip" && user.role !== "werkstatt")
  ) {
    return null;
  }

  return {
    loginHandle,
    identity: productIdentity.name === "Rolf" ? "rolf" : "phillip",
  };
}

export function toAdminUserDto(user: AdminUserDto): AdminUserDto {
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
