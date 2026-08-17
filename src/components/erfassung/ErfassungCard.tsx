"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

interface ErfassungCardProps {
  orderId: string;
  tenantId?: string;
}

export function ErfassungCard({ orderId, tenantId }: ErfassungCardProps) {
  void orderId;
  void tenantId;
  return <FoundationUnavailable />;
}
