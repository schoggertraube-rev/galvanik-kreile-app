import { requireAdminOrDeveloper } from "@/lib/auth/permissions";
import { AdminImportClient } from "./AdminImportClient";

export default async function AdminImportPage() {
  await requireAdminOrDeveloper();
  return <AdminImportClient />;
}
