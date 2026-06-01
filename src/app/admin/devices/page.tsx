import { requireAdminOrDeveloper } from "@/lib/auth/permissions";
import { AdminDevicesClient } from "./AdminDevicesClient";

export default async function AdminDevicesPage() {
  await requireAdminOrDeveloper();
  return <AdminDevicesClient />;
}
