import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface GlobalSearchResult {
  typ: 'auftrag' | 'kunde' | 'teil' | 'kpi';
  id: string;
  label: string;
  sublabel: string;
}

export function useGlobalSearch(query: string) {
  const [data, setData] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setData([]);
      return;
    }
    
    let isMounted = true;
    const fetchSearch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: result, error: fetchError } = await supabase
          .rpc('search_global', { query });
          
        if (fetchError) throw fetchError;
        if (isMounted) setData(result as GlobalSearchResult[]);
      } catch (err: unknown) {
        if (isMounted) setError(err);
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
