"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getCurrentTimeOfDay, getCurrentWeather, getWareneingangVolumeState, getStationIcon, StationId, TimeOfDay, WeatherStatus, VolumeState } from "@/lib/warendurchlaufIconResolver";

/* ═══════════════════════════════════════════════════
   Warendurchlauf Station Nav — Bild-basiert, sticky
   ═══════════════════════════════════════════════════ */

const STATIONS = [
  {
    id: "wareneingang" as StationId,
    name: "Wareneingang",
    path: "/warendurchlauf/wareneingang",
    alt: "Wareneingang — Paketstapel",
    chips: [
      { label: "2 neu", color: "#c0392b", bg: "rgba(192,57,43,.1)", isCritical: true },
      { label: "5 warten", color: "#d4850a", bg: "rgba(212,133,10,.1)" },
      { label: "11 ✓", color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
    ],
    trend: { values: [3, 4, 2, 7, 5, 8, 4], label: "+18 % zur Vorwoche", color: "#1e7e45" }
  },
  {
    id: "galvanik" as StationId,
    name: "Galvanik",
    path: "/warendurchlauf/galvanik",
    alt: "Galvanik — Kreile-Gebäude",
    chips: [
      { label: "3 krit.", color: "#c0392b", bg: "rgba(192,57,43,.1)", isCritical: true },
      { label: "5 bald", color: "#d4850a", bg: "rgba(212,133,10,.1)" },
      { label: "18 ✓", color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
    ],
  },
  {
    id: "warenausgang" as StationId,
    name: "Warenausgang",
    path: "/warendurchlauf/warenausgang",
    alt: "Warenausgang — Kreile-Transporter",
    chips: [
      { label: "3 bereit", color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
      { label: "4 weg", color: "#d4850a", bg: "rgba(212,133,10,.1)" },
    ],
    trend: { values: [5, 2, 8, 4, 3, 6, 7], label: "-5 % zur Vorwoche", color: "#d4850a" }
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
  
  const [timeOfDay, setTimeOfDay] = React.useState<TimeOfDay>("noon");
  const [weather, setWeather] = React.useState<WeatherStatus>("normal");
  const [volume, setVolume] = React.useState<VolumeState>("normal");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setTimeOfDay(getCurrentTimeOfDay());
      setWeather(getCurrentWeather());
      setVolume(getWareneingangVolumeState());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
                  className={`rounded-full overflow-hidden flex items-center justify-center transition-transform duration-300 bg-white ${
                    compact 
                      ? "w-16 h-16" 
                      : "w-24 h-24 md:w-[120px] md:h-[120px] lg:w-[140px] lg:h-[140px]"
                  }`}
                  style={{
                    border: isActive
                      ? "4px solid #1a6b38"
                      : "4px solid transparent",
                    transform: isActive ? "scale(1.15)" : "scale(0.95)",
                    transformOrigin: "center bottom",
                  }}
                >
                  <Image
                    src={getStationIcon(station.id, timeOfDay, weather, volume)}
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
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm ${chip.isCritical ? 'critical-pulse' : ''}`}
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

                {/* Trend Bars */}
                {!compact && station.trend && (
                  <div className="mt-2 flex flex-col items-center gap-1 group-hover:opacity-100 opacity-80 transition-opacity">
                    <div className="flex items-end gap-0.5 h-4">
                      {station.trend.values.map((v, idx) => (
                        <div 
                          key={idx} 
                          className="w-1.5 rounded-t-sm"
                          style={{ 
                            height: `${Math.max(10, (v / Math.max(...station.trend!.values)) * 100)}%`, 
                            backgroundColor: station.trend!.color,
                            opacity: idx === station.trend!.values.length - 1 ? 1 : 0.4
                          }} 
                        />
                      ))}
                    </div>
                    <span className="text-[9px] text-[#9e9689] font-medium" title="Aus vorhandenen Testaufträgen berechnet (Demo-Auswertung)">
                      {station.trend.label}
                    </span>
                  </div>
                )}
              </Link>

              {/* Arrow between stations */}
              {i < STATIONS.length - 1 && (
                <div className="hidden md:flex items-center shrink-0 mb-12">
                  <div className="w-10 lg:w-20 h-[2px] bg-[#d8d0c4] relative">
                    <span className="absolute right-[-2px] top-[-4px] border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-8 border-l-[#d8d0c4]" />
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
