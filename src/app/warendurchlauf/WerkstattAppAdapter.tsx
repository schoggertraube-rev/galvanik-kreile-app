"use client";

import { useRouter } from "next/navigation";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { usePageView } from "@/hooks/usePageView";
import { useOverlayStore } from "@/lib/overlayStore";
import {
  WerkstattView,
  type PhillipWerkstattViewModel,
} from "@/modules/werkstatt/public";

/** App composition adapter: owns legacy app hooks and injects narrow Werkstatt ports. */
export function WerkstattAppAdapter({
  view,
}: {
  view: PhillipWerkstattViewModel;
}) {
  usePageView();
  const router = useRouter();
  const { openErfassung } = useErfassung();
  const openOrder = useOverlayStore((state) => state.openOrder);

  return (
    <WerkstattView
      view={view}
      ports={{
        onOpenOrder: openOrder,
        onOpenGoodsOut: openOrder,
        onOpenWip: () => router.push("/warendurchlauf/galvanik"),
        onScanOrder: () => openErfassung({ mode: "scan" }),
        onCreateOrder: () => openErfassung({
          mode: "order",
          intent: "create_order",
          source: "shortcut",
          returnTo: "/warendurchlauf",
        }),
      }}
    />
  );
}
