"use client";

import { useState, useEffect } from 'react';
import { getCustomerCard } from '@/features/customers/customer-card/customerCard.actions';

type ActionData<T> = T extends { data: infer Data } ? Data : never;

export type CustomerCardData = ActionData<Awaited<ReturnType<typeof getCustomerCard>>>;

export function useCustomerData(customerId: string | null) {
  const [data, setData] = useState<CustomerCardData | null | undefined>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setData(null);
    setError(null);
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
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Fehler beim Laden');
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
