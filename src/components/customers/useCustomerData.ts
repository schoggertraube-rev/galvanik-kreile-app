"use client";

import { useState, useEffect } from 'react';
import { getCustomerCard } from '@/features/customers/customer-card/customerCard.actions';

type ActionData<T> = T extends { data: infer Data } ? Data : never;

export type CustomerCardData = ActionData<Awaited<ReturnType<typeof getCustomerCard>>>;

interface CustomerRequestSnapshot {
  customerId: string;
  data: CustomerCardData | null | undefined;
  error: string | null;
}

export function useCustomerData(customerId: string | null) {
  const [snapshot, setSnapshot] = useState<CustomerRequestSnapshot | null>(null);
  const matchingSnapshot = snapshot?.customerId === customerId ? snapshot : null;
  const data = matchingSnapshot?.data ?? null;
  const isLoading = customerId !== null && matchingSnapshot === null;
  const error = matchingSnapshot?.error ?? null;

  useEffect(() => {
    if (!customerId) return;

    let isMounted = true;

    void getCustomerCard(customerId)
      .then((res) => {
        if (!isMounted) return;
        setSnapshot({
          customerId,
          data: res.ok ? res.data : null,
          error: res.ok ? null : res.error || 'Fehler beim Laden',
        });
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setSnapshot({
          customerId,
          data: null,
          error: err instanceof Error ? err.message : 'Fehler beim Laden',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  return { data, isLoading, error };
}
