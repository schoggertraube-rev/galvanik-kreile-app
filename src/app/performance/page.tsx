import React from 'react';
import { PerformanceCockpitClient } from './PerformanceCockpitClient';
import { getPerformanceKPIsAction } from './actions';

export default async function PerformanceCockpitPage() {
  const result = await getPerformanceKPIsAction();
  const perfData = result.ok && result.data ? result.data : {
    totalRevenue: 0, totalOrders: 0, completedOrders: 0, reklas: 0, activeWarnings: 0, durchlaufzeit: 0
  };

  return (
    <PerformanceCockpitClient perfData={perfData} />
  );
}
