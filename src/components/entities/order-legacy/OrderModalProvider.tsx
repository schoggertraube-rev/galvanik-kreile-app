"use client";

import React, { ReactNode } from "react";
import { useOverlayStore } from "@/lib/overlayStore";

export function useOrderModal() {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const closeOrder = useOverlayStore((state) => state.pop);
  
  return { openOrder, closeOrder };
}

export function OrderModalProvider({ children }: { children: ReactNode }) {
  // The UI is now handled by OrderOverlay which should be placed at the root layout.
  // We just pass through children to not break the app tree.
  return <>{children}</>;
}
