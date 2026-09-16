"use server";

import { searchTenantAction } from "@/app/actions/search.actions";
import type { SearchTenantResult } from "@/modules/suche/public";

/**
 * Compatibility name for dormant imports. The only implementation and
 * authorization boundary is the canonical tenant-bound Lane-0 action.
 */
export async function globalSearchAction(term: string): Promise<SearchTenantResult> {
  return searchTenantAction(term);
}
