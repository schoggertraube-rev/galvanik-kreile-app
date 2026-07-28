export type TimeOfDay = "morning" | "noon" | "evening";
export type WeatherStatus = "normal" | "rain";
export type VolumeState = "low" | "normal" | "high";
export type StationId = "wareneingang" | "galvanik" | "warenausgang";

/**
 * Holt die aktuelle Tageszeit anhand der lokalen Browserzeit.
 */
export function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  // 05:00 - 10:59 -> morning
  if (hour >= 5 && hour < 11) return "morning";
  // 11:00 - 16:59 -> noon
  if (hour >= 11 && hour < 17) return "noon";
  // 17:00 - 22:59 -> evening, nachts (23-04) ebenfalls evening
  return "evening";
}

/**
 * Ermittelt den aktuellen Wetterstatus (sicher ohne API, mit optionalem LocalStorage-Override).
 */
export function getCurrentWeather(): WeatherStatus {
  if (typeof window !== "undefined") {
    try {
      const override = localStorage.getItem("kreile_weather_mode");
      if (override === "rain" || override === "normal") {
        return override;
      }
    } catch {
      // ignore
    }
  }
  return "normal";
}

/**
 * Ermittelt das Volumen für den Wareneingang (für spätere Metriken vorbereitet).
 */
export function getWareneingangVolumeState(): VolumeState {
  // TODO: Hier später historische Daten oder Live-Zahlen einbinden.
  // Aktuell adaptiver Fallback: normal
  return "normal";
}

/**
 * Sichere Logik zur Ermittlung des korrekten Icons pro Station inkl. strikter Fallbacks.
 */
export function getStationIcon(
  station: StationId,
  timeOfDay: TimeOfDay,
  weather: WeatherStatus,
  volumeState: VolumeState
): string {
void volumeState;
  const basePath = "/warendurchlauf";
  
  if (station === "galvanik") {
    // Check if the specific variant exists (we copied them to public/)
    const specificPath = `${basePath}/station-galvanik-${timeOfDay}-${weather}.png`;
    // We assume the known copied files are present. If an unknown combination is asked, it falls back
    // However, since we copied exactly all combinations of (morning/noon/evening) x (normal/rain) for galvanik,
    // they will always exist.
    // If not, we could add a runtime check or just return the specificPath because we mapped it perfectly.
    // Let's just return the specific path for Galvanik since we know all 6 exist.
    return specificPath;
  }

  // Warenausgang & Wareneingang have no variants yet -> fallback to default
  if (station === "warenausgang") {
    return `${basePath}/station-warenausgang.png`;
  }

  if (station === "wareneingang") {
    // Prepare volume integration for later:
    // e.g. `${basePath}/station-wareneingang-${volumeState}.png`
    return `${basePath}/station-wareneingang.png`;
  }

  // Absolute fallback
  return `${basePath}/station-${station}.png`;
}
