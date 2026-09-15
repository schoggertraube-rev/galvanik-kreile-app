import { redirect } from "next/navigation";

/** The only supported accounting entry stays the real invoice list. */
export function AccountingEntry(): never {
  redirect("/buchhaltung/rechnungen");
}
