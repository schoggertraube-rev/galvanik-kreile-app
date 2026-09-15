"use client";

import { StartScreenClient } from "@/components/start/StartScreenClient";
import type { ProductStartProfile } from "@/modules/fundament/public";

/** Narrow app seam: UI event bindings stay app-side; the public contract stays browser-safe. */
export function StartAppAdapter({
  users,
  loginUnavailable,
}: {
  users: ProductStartProfile[];
  loginUnavailable: boolean;
}) {
  return <StartScreenClient users={users} loginUnavailable={loginUnavailable} />;
}
