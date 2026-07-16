"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Package, FlaskConical, Truck, ArrowRight, Eraser, Layers, ShieldCheck } from 'lucide-react';
import {
  ORDER_STATIONS,
  ORDER_STATION_LABELS,
  type OrderStation,
} from '@/lib/orders/orderMutationContract';

const STATION_ROUTES: Record<OrderStation, string> = {
  wareneingang: '/warendurchlauf/wareneingang',
  entmetallisierung: '/orders?station=entmetallisierung',
  schleiferei: '/orders?station=schleiferei',
  galvanik: '/warendurchlauf/galvanik',
  qualitaetssicherung: '/orders?station=qualitaetssicherung',
  warenausgang: '/warendurchlauf/warenausgang',
};

const STATION_ICONS: Record<OrderStation, typeof Package> = {
  wareneingang: Package,
  entmetallisierung: Eraser,
  schleiferei: Layers,
  galvanik: FlaskConical,
  qualitaetssicherung: ShieldCheck,
  warenausgang: Truck,
};

const STATIONS = ORDER_STATIONS.map((key) => ({
  key,
  name: ORDER_STATION_LABELS[key],
  path: STATION_ROUTES[key],
  icon: STATION_ICONS[key],
}));

function TopWorkflowBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="sticky top-0 z-50 w-full bg-bg-app/90 backdrop-blur-md py-4 px-4 flex justify-center overflow-hidden shrink-0">
      {/* SVG Decorative Dot Grid on the Top-Right */}
      <div className="absolute right-0 top-0 h-full w-1/3 opacity-8 pointer-events-none">
        <svg width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotPattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="2" fill="#E8943C" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotPattern)" />
        </svg>
      </div>

      <nav className="flex items-center justify-start md:justify-between w-full gap-2 md:gap-4 relative z-10 max-w-full overflow-x-auto snap-x scroll-smooth pb-2 md:pb-0 scrollbar-hide">
        {STATIONS.map((station, i) => {
          const isWareneingangActive = station.name === 'Wareneingang' && (
            pathname === '/orders/new' || 
            pathname === '/warendurchlauf/neu' ||
            (searchParams?.get('station') === 'wareneingang')
          );
          const routePath = station.path.split('?')[0];
          const stationQueryActive = routePath === '/orders' && searchParams?.get('station') === station.key;
          const isActive = pathname === routePath && (routePath !== '/orders' || stationQueryActive) ||
                           (routePath !== '/orders' && pathname.startsWith(routePath + '/')) ||
                           isWareneingangActive;
          
          const Icon = station.icon;
          
          return (
            <React.Fragment key={station.key}>
              <Link
                href={station.path}
                className={`relative shrink-0 snap-center min-w-[120px] md:min-w-[100px] flex-1 max-w-md bg-white rounded-2xl border ${
                  isActive ? "border-accent-orange shadow-md ring-1 ring-accent-orange/30 md:scale-105" : "border-neutral-gray-100 shadow-sm"
                } p-3 md:p-4 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] md:hover:scale-105 transition-all duration-300 cursor-pointer active:scale-95`}
              >
                <span className="text-[10px] md:text-xs font-bold text-text-muted leading-none tracking-wider uppercase">{station.name}</span>
                <Icon className={`w-8 h-8 md:w-10 md:h-10 ${isActive ? "text-accent-orange" : "text-navy-700"}`} />
              </Link>
              {i < STATIONS.length - 1 && (
                <ArrowRight className="hidden md:flex w-5 h-5 md:w-7 md:h-7 text-accent-orange shrink-0" strokeWidth={2.5} />
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
}

export function TopWorkflowBar() {
  return (
    <Suspense fallback={<div className="h-14 bg-white border-b border-neutral-gray-100 w-full animate-pulse" />}>
      <TopWorkflowBarContent />
    </Suspense>
  );
}
