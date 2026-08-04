import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

type LegacyWeekDateFormatOptions = Intl.DateTimeFormatOptions & {
  week?: 'numeric';
};

export interface WerkstattPulsData {
  termintreue: {
    puenktlich: number;
    nenner: number;
    termintreue_pct: number | null;
    ohne_zusagetermin: number;
  };
  durchlauf: {
    avg_tage: number;
    n: number;
  };
  stationen: Array<{
    station: string;
    avg_tage: number;
    n: number;
    teile_aktuell: number;
  }>;
  wochenziel: {
    fertig_diese_woche: number;
  };
  engpass: Array<{
    station: string;
    teile_wartend: number;
  }>;
  snapshotTrend?: {
    vorjahr: number;
  };
  snapshots: Array<{ kw: string; wert: number | null; vorjahr?: number | null }>;
}

export function useWerkstattPuls() {
  const [data, setData] = useState<WerkstattPulsData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [termintreue, durchlauf, stationen, wochenziel, engpass, kpiSnapshots] = await Promise.all([
          supabase.from('v_analyse_termintreue').select('*').single(),
          supabase.from('v_analyse_durchlaufzeit').select('*').single(),
          supabase.from('v_analyse_station_durchlauf').select('*'),
          supabase.from('v_analyse_wochenziel').select('*').single(),
          supabase.from('v_analyse_engpass').select('*'),
          supabase.from('kpi_snapshots')
            .select('wert, periode_start')
            .eq('kpi_key', 'termintreue')
            .eq('periode', 'woche')
            .order('periode_start', { ascending: false })
            .limit(52)
        ]);

        const vorjahrTrend = kpiSnapshots.data && kpiSnapshots.data.length === 52 
          ? kpiSnapshots.data[51].wert 
          : null;

        const chartSnapshots = (kpiSnapshots.data || [])
          .slice(0, 12)
          .reverse()
          .map(s => {
            const dateFormatOptions: LegacyWeekDateFormatOptions = { week: 'numeric' };

            return {
              kw: 'KW ' + new Date(s.periode_start).toLocaleDateString('de-DE', dateFormatOptions), // Fallback formatting for demo
              wert: s.wert ? Number(s.wert) : null,
              vorjahr: null // Would need a self-join for true last year
            };
          });

        if (isMounted) {
          setData({
            termintreue: termintreue.data || { puenktlich: 0, nenner: 0, termintreue_pct: null, ohne_zusagetermin: 0 },
            durchlauf: durchlauf.data || { avg_tage: 0, n: 0 },
            stationen: stationen.data || [],
            wochenziel: wochenziel.data || { fertig_diese_woche: 0 },
            engpass: engpass.data || [],
            snapshotTrend: vorjahrTrend !== null ? { vorjahr: Number(vorjahrTrend) } : undefined,
            snapshots: chartSnapshots
          });
        }
      } catch (err: unknown) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  return { data, isLoading, error };
}
