"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackUiEvent } from "@/lib/tracking/tracking";

/**
 * Call this hook inside any page component to automatically fire a
 * 'page_view' tracking event every time the route changes.
 */
export function usePageView() {
  const pathname = usePathname();

  useEffect(() => {
    trackUiEvent("page_view", { route: pathname });
  }, [pathname]);
}
