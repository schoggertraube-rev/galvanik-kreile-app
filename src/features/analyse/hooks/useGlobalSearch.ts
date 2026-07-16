import { useState, useEffect } from 'react';
import { globalSearch } from '@/app/actions/search.actions';

export interface GlobalSearchResult {
  typ: 'auftrag' | 'kunde' | 'teil' | 'kpi';
  id: string;
  label: string;
  sublabel: string;
}

export function useGlobalSearch(query: string) {
  const [data, setData] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      const timer = setTimeout(() => {
        setData([]);
        setError(null);
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    
    let isMounted = true;
    const fetchSearch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await globalSearch(query);
        if (!result.ok) throw new Error(result.error || 'Suche fehlgeschlagen');
        const mapped = (result.results || []).flatMap((entry): GlobalSearchResult[] => {
          if (entry.type === 'order') return [{ typ: 'auftrag', id: entry.id, label: entry.title, sublabel: entry.subtitle }];
          if (entry.type === 'customer') return [{ typ: 'kunde', id: entry.id, label: entry.title, sublabel: entry.subtitle }];
          if (entry.type === 'item') return [{ typ: 'teil', id: entry.id, label: entry.title, sublabel: entry.subtitle }];
          return [];
        });
        if (isMounted) setData(mapped);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err : new Error('Suche fehlgeschlagen'));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    fetchSearch();
    
    return () => {
      isMounted = false;
    };
  }, [query]);

  return { data, isLoading, error };
}
