"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useClientReady } from "@/hooks/useClientReady";

export function AppOverlayPortal({
  children,
}: {
  children: React.ReactNode;
}) {
  const mounted = useClientReady();

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
