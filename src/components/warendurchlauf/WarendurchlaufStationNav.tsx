"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";

/* ═══════════════════════════════════════════════════
   Warendurchlauf Station Nav — Bild-basiert, sticky
   ═══════════════════════════════════════════════════ */

const STATIONS = [
  {
    id: "wareneingang",
    name: "Wareneingang",
    path: "/warendurchlauf/wareneingang",
    image: "/warendurchlauf/station-wareneingang.png",
    alt: "Wareneingang — Paketstapel",
    chips: [
      { label: "2 neu", color: "#c0392b", bg: "rgba(192,57,43,.1)" },
      { label: "5 warten", color: "#d4850a", bg: "rgba(212,133,10,.1)" },
      { label: "11 \u2713", color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
    ],
  },
  {
    id: "galvanik",
    name: "Galvanik",
    path: "/warendurchlauf/galvanik",
    image: "/warendurchlauf/station-galvanik.png",
    alt: "Galvanik — Kreile-Gebäude",
    chips: [
      { label: "3 krit.", color: "#c0392b", bg: "rgba(192,57,43,.1)" },
      { label: "5 bald", color: "#d4850a", bg: "rgba(212,133,10,.1)" },
      { label: "18 \u2713", color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
    ],
  },
  {
    id: "warenausgang",
    name: "Warenausgang",
    path: "/warendurchlauf/warenausgang",
    image: "/warendurchlauf/station-warenausgang.png",
    alt: "Warenausgang — Kreile-Transporter",
    chips: [
      { label: "3 bereit", color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
      { label: "4 weg", color: "#d4850a", bg: "rgba(212,133,10,.1)" },
    ],
  },
];

interface WarendurchlaufStationNavProps {
  /** Which station is currently active (auto-detected from pathname if not provided) */
  activeStation?: "wareneingang" | "galvanik" | "warenausgang";
  /** Compact mode for narrow views */
  compact?: boolean;
}

function NavContent({ activeStation, compact }: WarendurchlaufStationNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getIsActive = (station: typeof STATIONS[0]) => {
    // Explicit override
    if (activeStation) return station.id === activeStation;
    // Auto-detect from pathname
    return pathname === station.path || (station.path !== "/" && pathname.startsWith(station.path));
  };

  return (
    <div className="w-full pt-6 pb-2">
      <nav className="w-full px-5 md:px-8 lg:px-12 xl:px-16 mx-auto flex items-center justify-around gap-2 overflow-x-auto scrollbar-hide">
        {STATIONS.map((station, i) => {
          const isActive = getIsActive(station);

          return (
            <React.Fragment key={station.id}>
              <Link
                href={station.path}
                className={`group flex flex-col items-center gap-3 cursor-pointer transition-all shrink-0 px-2 py-2 rounded-2xl ${
                  isActive ? "opacity-100" : "opacity-80 hover:opacity-100"
                } hover:-translate-y-1`}
              >
                {/* Circle with image */}
                <div
                  className={`rounded-full overflow-hidden flex items-center justify-center transition-all bg-white ${
                    compact 
                      ? "w-16 h-16" 
                      : "w-24 h-24 md:w-[120px] md:h-[120px] lg:w-[140px] lg:h-[140px]"
                  }`}
                  style={{
                    border: isActive
                      ? "4px solid #1a6b38"
                      : "4px solid transparent",
                    transform: isActive ? "scale(1)" : "scale(0.95)",
                  }}
                >
                  <Image
                    src={station.image}
                    alt={station.alt}
                    width={130}
                    height={130}
                    className="object-cover"
                  />
                </div>

                {/* Name */}
                <span
                  className={`text-sm md:text-base font-bold transition-colors ${
                    isActive ? "text-[#1a1a1a]" : "text-[#9e9689]"
                  }`}
                >
                  {station.name}
                </span>

                {/* Chips */}
                {!compact && (
                  <div className="flex gap-1 flex-wrap justify-center">
                    {station.chips.map((chip) => (
                      <span
                        key={chip.label}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm"
                        style={{
                          background: chip.bg,
                          color: chip.color,
                          fontFamily: "monospace",
                        }}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}
              </Link>

              {/* Arrow between stations */}
              {i < STATIONS.length - 1 && (
                <div className="hidden md:flex items-center shrink-0 mb-12">
                  <div className="w-10 lg:w-20 h-[2px] bg-[#d8d0c4] relative">
                    <span className="absolute right-[-2px] top-[-4px] border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-[#d8d0c4]" />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Demo badge */}
        <div className="hidden xl:flex items-center shrink-0 ml-4">
          <span
            className="text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-[#fef3e2] text-[#c8922a] border border-[#c8922a]/20"
          >
            Demo-Modus
          </span>
        </div>
      </nav>
    </div>
  );
}

export function WarendurchlaufStationNav(props: WarendurchlaufStationNavProps) {
  return (
    <Suspense
      fallback={
        <div className="h-[180px] w-full bg-[#ede8de] animate-pulse" />
      }
    >
      <NavContent {...props} />
    </Suspense>
  );
}
