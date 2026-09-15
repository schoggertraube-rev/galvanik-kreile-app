import { AccountingEntry } from "@/modules/accounting/public";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AccountingPage() {
  return <AccountingEntry />;
}
