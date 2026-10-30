"use client";

import { useRouter } from "next/navigation";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePageView } from "@/hooks/usePageView";
import { useOverlayStore } from "@/lib/overlayStore";
import {
  WerkstattView,
  type WorkshopViewModel,
} from "@/modules/werkstatt/public";

/** App composition adapter: owns legacy app hooks and injects narrow Werkstatt ports. */
export function WerkstattAppAdapter({
  view,
}: {
  view: WorkshopViewModel;
}) {
  usePageView();
  const router = useRouter();
  const openOrder = useOverlayStore((state) => state.openOrder);

  return (
    <WerkstattView
      view={view}
      onRetry={() => router.refresh()}
      ports={{
        onOpenOrder: openOrder,
        onOpenGoodsOut: openOrder,
        onOpenWip: () => router.push("/warendurchlauf/galvanik"),
        onScanOrder: () => requestGlobalCreate("DIRECT_INTAKE"),
        onCreateOrder: () => requestGlobalCreate("DIRECT_INTAKE"),
      }}
    />
  );
}
