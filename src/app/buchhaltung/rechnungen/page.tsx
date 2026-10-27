import { InvoicesAppAdapter } from "./InvoicesAppAdapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvoicesPage() {
  return <InvoicesAppAdapter />;
}
