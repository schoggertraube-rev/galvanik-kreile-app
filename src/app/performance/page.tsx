import React from 'react';
import { PerformanceCockpitClient } from './PerformanceCockpitClient';
import { getAnalyseOverview } from '@/features/analyse/analyse.actions';

export default async function PerformanceCockpitPage() {
  const result = await getAnalyseOverview("Monat");

  return (
    <PerformanceCockpitClient
      initialOverviews={result.data}
      initialError={result.error?.message}
      initialLoadedAt={new Date().toISOString()}
    />
  );
}
