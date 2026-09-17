"use client";

import { StartScreenClient } from "@/components/start/StartScreenClient";
import type { ProductStartProfile } from "@/modules/fundament/public";

/** Narrow app seam: UI event bindings stay app-side; the public contract stays browser-safe. */
export function StartAppAdapter({
  users,
  loginUnavailable,
  supportReference,
}: {
  users: ProductStartProfile[];
  loginUnavailable: boolean;
  supportReference?: string;
}) {
  return (
    <StartScreenClient
      users={users}
      loginUnavailable={loginUnavailable}
      supportReference={supportReference}
    />
  );
}
