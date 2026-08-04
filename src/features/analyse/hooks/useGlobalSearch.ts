import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface GlobalSearchResult {
  typ: 'auftrag' | 'kunde' | 'teil' | 'kpi';
  id: string;
  label: string;
  sublabel: string;
}

interface SearchRequestSnapshot {
  query: string;
  data: GlobalSearchResult[];
  error: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseGlobalSearchResult(value: unknown): GlobalSearchResult | null {
  if (!isRecord(value)) return null;

  if (
    (value.typ !== 'auftrag' && value.typ !== 'kunde' && value.typ !== 'teil' && value.typ !== 'kpi')
    || typeof value.id !== 'string'
    || typeof value.label !== 'string'
  ) return null;
  if (value.sublabel !== null && typeof value.sublabel !== 'string') return null;

  return {
    typ: value.typ,
    id: value.id,
    label: value.label,
    sublabel: typeof value.sublabel === 'string' ? value.sublabel : '',
  };
}

function parseGlobalSearchResults(value: unknown): GlobalSearchResult[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<GlobalSearchResult[]>((results, entry) => {
    const result = parseGlobalSearchResult(entry);
    if (result) results.push(result);
    return results;
  }, []);
}

export function useGlobalSearch(query: string) {
  const [snapshot, setSnapshot] = useState<SearchRequestSnapshot | null>(null);
  const canSearch = query.length >= 2;
  const matchingSnapshot = snapshot?.query === query ? snapshot : null;
  const data = canSearch ? matchingSnapshot?.data ?? [] : [];
  const isLoading = canSearch && matchingSnapshot === null;
  const error = canSearch ? matchingSnapshot?.error ?? null : null;

  useEffect(() => {
    if (!canSearch) return;
    
    let isMounted = true;
    void (async () => {
      try {
        const { data: result, error: fetchError } = await supabase.rpc('search_global', { query });
        if (!isMounted) return;
        if (fetchError) {
          setSnapshot({ query, data: [], error: fetchError });
          return;
        }
        setSnapshot({ query, data: parseGlobalSearchResults(result), error: null });
      } catch (fetchError: unknown) {
        if (!isMounted) return;
        setSnapshot({ query, data: [], error: fetchError });
      }
    })();
    
    return () => {
      isMounted = false;
    };
  }, [canSearch, query]);

  return { data, isLoading, error };
}
