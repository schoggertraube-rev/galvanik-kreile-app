// src/lib/search/globalSearch.ts

import { globalSearch as globalSearchAction } from '@/app/actions/search.actions';

/**
 * Perform a global search across orders and items.
 * Returns an array of result objects with type, id, label and sub.
 */
export async function globalSearch(query: string) {
  const response = await globalSearchAction(query);
  if (!response.ok) throw new Error(response.error || 'Suche fehlgeschlagen');
  return (response.results || []).map((result) => ({
    type: result.type,
    id: result.id,
    label: result.title,
    sub: result.subtitle,
    url: result.url,
  }));
}
