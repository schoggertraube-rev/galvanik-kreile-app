"use client";

import { useEffect, useState } from 'react';
import { getCustomerCard, type LegacyCustomerCardRecord } from '@/features/customers/customer-card/customerCard.actions';

type CustomerKpi = {
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
};

type CustomerCard = LegacyCustomerCardRecord & {
  id: string;
  name: string;
  classification?: string;
  createdAt?: string;
  kpi?: CustomerKpi;
};

function isCustomerCard(value: LegacyCustomerCardRecord | undefined): value is CustomerCard {
  return typeof value?.id === 'string' && typeof value.name === 'string';
}

type CustomerDataState = {
  customerId: string | null;
  data: CustomerCard | null;
  error: string | null;
  isLoading: boolean;
};

export function useCustomerData(customerId: string | null) {
  const [state, setState] = useState<CustomerDataState>({
    customerId: null,
    data: null,
    error: null,
    isLoading: false,
  });

  useEffect(() => {
    if (!customerId) return;

    let active = true;

    void Promise.resolve().then(async () => {
      const res = await getCustomerCard(customerId);
      if (!active) return;
      if (res.ok && isCustomerCard(res.data)) {
        setState({ customerId, data: res.data, error: null, isLoading: false });
      } else {
        setState({ customerId, data: null, error: res.error || 'Kein Kundenkartenvertrag vorhanden', isLoading: false });
      }
    }).catch((error: unknown) => {
      if (active) {
        setState({
          customerId,
          data: null,
          error: error instanceof Error ? error.message : 'Fehler beim Laden',
          isLoading: false,
        });
      }
    });

    return () => {
      active = false;
    };
  }, [customerId]);

  const requestChanged = customerId !== state.customerId;
  if (!customerId) {
    return { data: null, isLoading: false, error: null };
  }
  return {
    data: requestChanged ? null : state.data,
    isLoading: requestChanged || state.isLoading,
    error: requestChanged ? null : state.error,
  };
}
