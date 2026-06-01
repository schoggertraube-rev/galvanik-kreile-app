import { requireRole } from "@/lib/auth/roles";
import { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Only developers can access any /admin routes
  await requireRole(["developer"]);

  return (
    <>
      {children}
    </>
  );
}
