"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function AppOverlayPortal({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
