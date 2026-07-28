"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

interface Props {
  isDevOrAdmin: boolean;
  qsData?: readonly unknown[];
}

/**
 * Kept as an import-compatible boundary for historical callers. The old
 * dashboard invented QS counts and operational warnings from demo state.
 */
export function KontrolleDashboardClient(props: Props) {
  void props;

  return (
    <FoundationUnavailable
      title="Qualitätskontrolle ist noch nicht freigegeben"
      reason="Für QS fehlen ein geprüfter Daten-, Rollen- und Evidenzvertrag."
    />
  );
}
