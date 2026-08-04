import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useKiInsight(kachel: string, daten: Record<string, number | string | null>) {
  const [data, setData] = useState<{ beobachtung: string; achtung?: string; empfehlung: string } | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const datenKey = JSON.stringify(daten);

  useEffect(() => {
    let isMounted = true;
    const fetchInsight = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke('kpi-insight', {
          body: { kachel, daten },
        });
        if (fetchError) throw fetchError;
        if (isMounted) setData(result as any);
      } catch (err: unknown) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    // Only fetch once when the component mounts with these dependencies
    fetchInsight();
    
    return () => { isMounted = false; };
  }, [kachel, datenKey]);

  return { data, isLoading, error };
}
