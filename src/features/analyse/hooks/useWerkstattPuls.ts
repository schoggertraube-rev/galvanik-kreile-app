import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

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
}

export function useWerkstattPuls() {
  const [data, setData] = useState<WerkstattPulsData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
            .select('wert')
            .eq('kpi_key', 'termintreue')
            .eq('periode', 'woche')
            .order('periode_start', { ascending: false })
            .limit(52)
        ]);

        const vorjahrTrend = kpiSnapshots.data && kpiSnapshots.data.length === 52 
          ? kpiSnapshots.data[51].wert 
          : null;

        if (isMounted) {
          setData({
            termintreue: termintreue.data || { puenktlich: 0, nenner: 0, termintreue_pct: null, ohne_zusagetermin: 0 },
            durchlauf: durchlauf.data || { avg_tage: 0, n: 0 },
            stationen: stationen.data || [],
            wochenziel: wochenziel.data || { fertig_diese_woche: 0 },
            engpass: engpass.data || [],
            snapshotTrend: vorjahrTrend !== null ? { vorjahr: Number(vorjahrTrend) } : undefined
          });
        }
      } catch (err: any) {
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
