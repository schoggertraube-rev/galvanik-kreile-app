import React from 'react';
import { PerformanceCockpitClient } from './PerformanceCockpitClient';
import { getAnalyseOverview } from '@/features/analyse/analyse.actions';

export default async function PerformanceCockpitPage() {
  const result = await getAnalyseOverview("Monat");
  const perfData = result.data || [];

  return (
    <PerformanceCockpitClient overviews={perfData} />
  );
}
