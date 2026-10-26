"use client";

import { searchTenantAction } from "@/app/actions/search.actions";
import { useRouter } from "next/navigation";
import { useOverlayStore } from "@/lib/overlayStore";
import { SearchDialog, type SearchHit } from "@/modules/suche/public";

type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const openOrder = useOverlayStore((state) => state.openOrder);
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const openInvoice = useOverlayStore((state) => state.openInvoice);

  const selectHit = (hit: SearchHit) => {
    if (hit.type === "ORDER") openOrder(hit.id);
    else if (hit.type === "CUSTOMER") openCustomer(hit.id);
    else if (hit.type === "INVOICE") openInvoice(hit.id);
    else router.push(hit.href);
  };

  return <SearchDialog onOpenChange={onOpenChange} onSelect={selectHit} open={open} search={searchTenantAction} />;
}
