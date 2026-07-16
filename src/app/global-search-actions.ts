"use server";

import { globalSearch } from "@/app/actions/search.actions";

export async function globalSearchAction(term: unknown) {
  return globalSearch(term);
}
