import { redirect } from "next/navigation";
import { getCustomersPageCustomers } from "@/app/actions/customers.actions";
import { CustomersPageClient } from "@/app/customers/CustomersPageClient";

export default async function CustomersPage() {
  const result = await getCustomersPageCustomers();

  if (!result.ok) {
    if (result.error === "UNAUTHORIZED") {
      redirect("/start?reason=session_expired");
    }
    throw new Error(result.message || "Fehler beim Laden der Kunden");
  }

  return <CustomersPageClient initialCustomers={result.data} />;
}
