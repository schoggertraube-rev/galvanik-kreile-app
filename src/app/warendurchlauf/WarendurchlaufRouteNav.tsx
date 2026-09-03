"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { WarendurchlaufStationNav } from "@/components/warendurchlauf/WarendurchlaufStationNav";

export function WarendurchlaufRouteNav() {
  const segment = useSelectedLayoutSegment();

  if (segment === null) return null;

  return <WarendurchlaufStationNav />;
}
