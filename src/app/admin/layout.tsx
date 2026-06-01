import { requireAdminOrDeveloper } from "@/lib/auth/permissions";
import { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Only admins or developers can access any /admin routes
  await requireAdminOrDeveloper();

  return (
    <>
      {children}
    </>
  );
}
