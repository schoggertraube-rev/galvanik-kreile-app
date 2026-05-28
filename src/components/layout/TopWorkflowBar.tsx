"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Package, FlaskConical, Truck, ArrowRight } from 'lucide-react';

const STATIONS = [
  { name: 'Wareneingang', path: '/warendurchlauf', icon: Package },
  { name: 'Galvanik', path: '/station/beschichtung', icon: FlaskConical },
  { name: 'Warenausgang', path: '/station/warenausgang', icon: Truck },
];

function TopWorkflowBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="w-full bg-gradient-to-r from-bg-app to-surface-tinted border-b border-neutral-gray-100 py-4 px-4 flex justify-center relative overflow-hidden shrink-0 shadow-sm z-10">
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

      <nav className="flex items-center gap-4 md:gap-8 relative z-10">
        {STATIONS.map((station, i) => {
          const isWareneingangActive = station.name === 'Wareneingang' && (
            pathname === '/orders/new' || 
            pathname === '/warendurchlauf' ||
            (searchParams?.get('station') === 'wareneingang')
          );
          const isActive = pathname === station.path || 
                           (station.path !== '/' && pathname.startsWith(station.path)) ||
                           isWareneingangActive;
          
          const Icon = station.icon;
          
          return (
            <React.Fragment key={station.path}>
              <Link
                href={station.path}
                className={`relative w-28 md:w-40 bg-white rounded-2xl border ${
                  isActive ? "border-accent-orange shadow-md scale-102 ring-1 ring-accent-orange/30" : "border-neutral-gray-100 shadow-sm"
                } p-3 md:p-4 flex flex-col items-center justify-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer`}
              >
                <span className="text-[10px] md:text-xs font-bold text-text-muted leading-none tracking-wider uppercase">{station.name}</span>
                <Icon className={`w-8 h-8 md:w-10 md:h-10 ${isActive ? "text-accent-orange" : "text-navy-700"}`} />
              </Link>
              {i < STATIONS.length - 1 && (
                <ArrowRight className="w-5 h-5 md:w-7 md:h-7 text-accent-orange shrink-0" strokeWidth={2.5} />
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
