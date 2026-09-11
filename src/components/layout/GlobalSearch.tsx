"use client";

import { searchTenantAction } from "@/app/actions/search.actions";
import { useOverlayStore } from "@/lib/overlayStore";
import { SearchDialog, type SearchHit } from "@/modules/suche/public";

type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const openCustomer = useOverlayStore((state) => state.openCustomer);

  const selectHit = (hit: SearchHit) => {
    if (hit.type === "ORDER") openOrder(hit.id);
    else openCustomer(hit.id);
  };

  return (
    <SearchDialog
      onOpenChange={onOpenChange}
      onSelect={selectHit}
      open={open}
      search={searchTenantAction}
    />
  );
}
