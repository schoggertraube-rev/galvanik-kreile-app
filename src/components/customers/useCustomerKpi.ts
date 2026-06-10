import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface CustomerKpi {
  customer_id: string;
  kunde: string;
  classification: string;
  kunde_seit: string;
  umsatz_ltv: number;
  gewinn_ltv: number;
  offene_posten: number;
  aktive_auftraege: number;
  puenktlichkeit_pct: number | null;
  reklamationen: number;
}

export function useCustomerKpi(customerId: string | null) {
  const [data, setData] = useState<CustomerKpi | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!customerId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    async function fetchKpi() {
      try {
        const { data: res, error: supabaseError } = await supabase
          .from('v_analyse_kunden_kpi')
          .select('*')
          .eq('customer_id', customerId)
          .single();

        if (supabaseError) throw supabaseError;
        
        if (isMounted) {
          setData(res as CustomerKpi);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(err);
          setError(err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchKpi();

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  return { data, isLoading, error };
}
