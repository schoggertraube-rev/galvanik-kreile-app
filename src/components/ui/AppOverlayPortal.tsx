"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "@/hooks/useHydrated";

export function AppOverlayPortal({
  children,
}: {
  children: React.ReactNode;
}) {
  const mounted = useHydrated();

  useEffect(() => {
    // Overlay open -> body scroll hidden
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(children, document.body);
}
