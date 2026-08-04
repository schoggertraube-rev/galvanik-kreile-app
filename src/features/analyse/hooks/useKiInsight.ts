import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

type KiInsight = {
  beobachtung: string;
  achtung?: string;
  empfehlung: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKiInsight(value: unknown): value is KiInsight {
  if (!isRecord(value)) {
    return false;
  }

  const { beobachtung, achtung, empfehlung } = value;
  return typeof beobachtung === "string"
    && typeof empfehlung === "string"
    && (achtung === undefined || typeof achtung === "string");
}

export function useKiInsight(kachel: string, daten: Record<string, number | string | null>) {
  const [data, setData] = useState<KiInsight | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

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
        if (!isKiInsight(result)) throw new Error("Ungültige Antwort des KPI-Insight-Dienstes");
        if (isMounted) setData(result);
      } catch (err: unknown) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    fetchInsight();
    
    return () => { isMounted = false; };
  }, [kachel, daten]);

  return { data, isLoading, error };
}
