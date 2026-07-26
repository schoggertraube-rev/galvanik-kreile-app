import React from 'react';
import { PerformanceCockpitClient } from './PerformanceCockpitClient';
import { getAnalyseOverview } from '@/features/analyse/analyse.actions';
import {
  parseAnalysePeriod,
  parseAnalyseTile,
} from '@/lib/analyse/routes';

type PageProps = {
  searchParams: Promise<{
    tile?: string | string[];
    period?: string | string[];
  }>;
};

export default async function PerformanceCockpitPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const initialPeriod = parseAnalysePeriod(query.period);
  const initialDrillTile = parseAnalyseTile(query.tile);
  const result = await getAnalyseOverview(initialPeriod);

  return (
    <PerformanceCockpitClient
      initialOverviews={result.data}
      initialError={result.error?.message}
      initialLoadedAt={new Date().toISOString()}
      initialPeriod={initialPeriod}
      initialDrillTile={initialDrillTile}
    />
  );
}
