"use client";

import { useState, useEffect } from 'react';
import { getCustomerCard } from '@/features/customers/customer-card/customerCard.actions';

export function useCustomerData(customerId: string | null) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    async function fetchData() {
      try {
        const res = await getCustomerCard(customerId as string);
        if (isMounted) {
          if (res.ok) {
            setData(res.data);
            setError(null);
          } else {
            setError(res.error || 'Fehler beim Laden');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  return { data, isLoading, error };
}
