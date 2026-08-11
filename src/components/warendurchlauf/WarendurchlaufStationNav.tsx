"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getCurrentTimeOfDay, getCurrentWeather, getWareneingangVolumeState, getStationIcon, StationId, TimeOfDay, WeatherStatus, VolumeState } from "@/lib/warendurchlaufIconResolver";

import { ordersRepository, Order } from "@/lib/repositories/ordersRepository";

/* ═══════════════════════════════════════════════════
   Warendurchlauf Station Nav — Bild-basiert, sticky
   ═══════════════════════════════════════════════════ */

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
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [dataState, setDataState] = React.useState<"loading" | "loaded" | "unavailable">("loading");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setTimeOfDay(getCurrentTimeOfDay());
      setWeather(getCurrentWeather());
      setVolume(getWareneingangVolumeState());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    let active = true;
    ordersRepository.getAll()
      .then((result) => {
        if (!active) return;
        setOrders(result);
        setDataState("loaded");
      })
      .catch(() => {
        if (!active) return;
        setOrders([]);
        setDataState("unavailable");
      });
    return () => { active = false; };
  }, []);

  // Berechnungen für Diagramme und Chips
  const weOrders = orders.filter(o => o.station === "wareneingang" || o.currentStationId === "wareneingang" || o.statusText?.toLowerCase().includes("annahme"));
  const weNeu = weOrders.filter(o => o.status === "ready" || o.statusText?.toLowerCase().includes("neu")).length;
  const weWarten = weOrders.filter(o => o.status === "in_progress").length;
  const weDone = weOrders.filter(o => o.status === "done" || o.statusText?.toLowerCase().includes("geprüft")).length;

  const galvOrders = orders.filter(o => o.station === "beschichtung" || o.station === "galvanik" || o.currentStationId === "beschichtung" || o.currentStationId === "galvanik" || o.statusText?.toLowerCase().includes("bad") || o.statusText?.toLowerCase().includes("qs"));
  const galvKrit = galvOrders.filter(o => o.risk === "red" || o.risk === "orange").length;
  const galvBald = galvOrders.filter(o => o.risk === "yellow" || o.status === "ready").length;
  const galvDone = galvOrders.filter(o => o.status === "done" || o.statusText?.toLowerCase().includes("fertig") || o.statusText?.toLowerCase().includes("qs")).length;

  const waOrders = orders.filter(o => o.station === "warenausgang" || o.currentStationId === "warenausgang" || o.statusText?.toLowerCase().includes("versand") || o.statusText?.toLowerCase().includes("abhol"));
  const waBereit = waOrders.filter(o => o.status === "ready" || o.statusText?.toLowerCase().includes("bereit")).length;
  const waWeg = waOrders.filter(o => o.status === "done" || o.statusText?.toLowerCase().includes("abgeholt") || o.statusText?.toLowerCase().includes("versendet")).length;

  const getLast7DaysTrend = (filteredOrders: Order[]) => {
    const trend = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    filteredOrders.forEach(o => {
      const d = o.intakeDate || o.rawIntakeDate;
      if (!d || Number.isNaN(new Date(d).getTime())) return;
      const diffTime = Math.abs(now.getTime() - new Date(d).getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        trend[6 - diffDays]++;
      }
    });
    return trend;
  };
  const trendFor = (stationOrders: Order[]) => {
    if (stationOrders.length === 0) return { values: [], label: "Keine Aufträge", color: "#64748b" };
    const values = getLast7DaysTrend(stationOrders);
    return values.some(value => value > 0) ? { values, label: `${stationOrders.length} Gesamt (7T)`, color: "#1e7e45" } : { values: [], label: "Nicht erfasst", color: "#64748b" };
  };

  const STATIONS = [
    {
      id: "wareneingang" as StationId,
      name: "Wareneingang",
      path: "/warendurchlauf/wareneingang",
      alt: "Wareneingang — Paketstapel",
      chips: [
        { label: `${weNeu} neu`, color: "#c0392b", bg: "rgba(192,57,43,.1)", isCritical: weNeu > 0 },
        { label: `${weWarten} warten`, color: "#d4850a", bg: "rgba(212,133,10,.1)" },
        { label: `${weDone} ✓`, color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
      ],
      trend: trendFor(weOrders)
    },
    {
      id: "galvanik" as StationId,
      name: "Galvanik",
      path: "/warendurchlauf/galvanik",
      alt: "Galvanik — Kreile-Gebäude",
      chips: [
        { label: `${galvKrit} krit.`, color: "#c0392b", bg: "rgba(192,57,43,.1)", isCritical: galvKrit > 0 },
        { label: `${galvBald} bald`, color: "#d4850a", bg: "rgba(212,133,10,.1)" },
        { label: `${galvDone} ✓`, color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
      ],
      trend: trendFor(galvOrders)
    },
    {
      id: "warenausgang" as StationId,
      name: "Warenausgang",
      path: "/warendurchlauf/warenausgang",
      alt: "Warenausgang — Kreile-Transporter",
      chips: [
        { label: `${waBereit} bereit`, color: "#1e7e45", bg: "rgba(30,126,69,.1)" },
        { label: `${waWeg} weg`, color: "#d4850a", bg: "rgba(212,133,10,.1)" },
      ],
      trend: trendFor(waOrders)
    },
  ];

  const getIsActive = (station: typeof STATIONS[0]) => {
    // Explicit override
    if (activeStation) return station.id === activeStation;
    // Auto-detect from pathname
    return pathname === station.path || (station.path !== "/" && pathname.startsWith(station.path));
  };

  return (
    <div className="w-full pt-6 pb-2 relative z-[105]">
      {dataState === "loading" && <p className="text-center text-xs text-[#9e9689]">Stationsdaten werden geladen...</p>}
      {dataState === "unavailable" && <p className="text-center text-xs text-[#9e9689]">NOT_AVAILABLE: Stationsdaten konnten nicht geladen werden.</p>}
      <nav className="w-full px-5 md:px-8 lg:px-12 xl:px-16 mx-auto flex items-center justify-around gap-2">
        {STATIONS.map((station, i) => {
          const isActive = getIsActive(station);

          return (
            <React.Fragment key={station.id}>
              <Link
                href={station.path}
                className={`group flex flex-col items-center gap-3 cursor-pointer transition-all duration-300 shrink-0 px-2 py-2 rounded-2xl relative ${isActive ? "opacity-100 z-20 -translate-y-6 md:-translate-y-10 lg:-translate-y-12" : "opacity-80 hover:opacity-100 z-10 hover:-translate-y-1"
                  }`}
              >
                {/* Circle with image */}
                <div
                  className={`rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 bg-white shadow-sm ${compact
                      ? "w-[76px] h-[76px]"
                      : "w-[115px] h-[115px] md:w-[144px] md:h-[144px] lg:w-[168px] lg:h-[168px]"
                    } ${isActive ? "relative ring-4 ring-[#1a6b38] ring-opacity-100" : ""}`}
                  style={{
                    border: isActive
                      ? "none"
                      : "4px solid transparent",
                    transform: isActive ? "scale(1.05)" : "scale(0.95)",
                    transformOrigin: "center bottom",
                  }}
                >
                  <Image
                    src={getStationIcon(station.id, timeOfDay, weather, volume)}
                    alt={station.alt}
                    width={180}
                    height={180}
                    className="object-cover w-full h-full"
                  />
                </div>

                {/* Name */}
                <span
                  className={`text-sm md:text-base font-bold transition-colors ${isActive ? "text-[#1a1a1a]" : "text-[#9e9689]"
                    }`}
                >
                  {station.name}
                </span>

                {/* Chips */}
                {!compact && dataState === "loaded" && (
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
                {!compact && dataState === "loaded" && station.trend && (
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
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <div className="hidden xl:flex items-center shrink-0 ml-4">
            <span
              className="text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-[#fef3e2] text-[#c8922a] border border-[#c8922a]/20"
            >
              Demo-Modus
            </span>
          </div>
        )}
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
