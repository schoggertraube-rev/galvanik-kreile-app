import { resolveFeatures } from "../resolveFeatures";
import { FeatureKey, DataReadiness } from "../types";

describe("resolveFeatures", () => {
  const allReady: Record<FeatureKey, DataReadiness> = {
    performance_score: "bereit",
    engpass_heatmap: "bereit",
    wochenziel_streaks: "bereit",
    finanzcontrolling: "bereit",
    vorperiode_vergleich: "bereit",
    monatsbericht_pdf: "bereit",
    datev_export: "bereit",
    steuerberater_paket: "bereit",
    materialverbrauch_report: "bereit",
    reklamations_dossier: "bereit",
    umsatz_forecast: "bereit",
    buchhaltung_belege: "bereit",
    buchhaltung_export: "bereit",
    buchhaltung_ustva: "bereit",
    buchhaltung_erechnung: "bereit",
    bank_anbindung: "bereit",
    elster_direkt: "bereit",
    zahlungsdienstleister: "bereit",
  };

  const allBuilding: Record<FeatureKey, DataReadiness> = {
    performance_score: "in_aufbau",
    engpass_heatmap: "in_aufbau",
    wochenziel_streaks: "in_aufbau",
    finanzcontrolling: "in_aufbau",
    vorperiode_vergleich: "in_aufbau",
    monatsbericht_pdf: "in_aufbau",
    datev_export: "in_aufbau",
    steuerberater_paket: "in_aufbau",
    materialverbrauch_report: "in_aufbau",
    reklamations_dossier: "in_aufbau",
    umsatz_forecast: "in_aufbau",
    buchhaltung_belege: "in_aufbau",
    buchhaltung_export: "in_aufbau",
    buchhaltung_ustva: "in_aufbau",
    buchhaltung_erechnung: "in_aufbau",
    bank_anbindung: "in_aufbau",
    elster_direkt: "in_aufbau",
    zahlungsdienstleister: "in_aufbau",
  };

  it("basis sperrt alles (lockReason 'plan')", () => {
    const result = resolveFeatures("basis", allReady);
    expect(result.performance_score.available).toBe(false);
    expect(result.performance_score.lockReason).toBe("plan");
  });

  it("pro mit readiness 'bereit' gibt available true", () => {
    const result = resolveFeatures("pro", allReady);
    expect(result.performance_score.available).toBe(true);
    expect(result.performance_score.lockReason).toBeNull();
  });

  it("pro mit readiness 'in_aufbau' gibt available false + lockReason 'datenreife'", () => {
    const result = resolveFeatures("pro", allBuilding);
    expect(result.performance_score.available).toBe(false);
    expect(result.performance_score.lockReason).toBe("datenreife");
  });

  it("Override aktiviert Feature trotz basis-Plan", () => {
    const result = resolveFeatures("basis", allReady, [
      { featureKey: "engpass_heatmap", enabled: true }
    ]);
    expect(result.engpass_heatmap.available).toBe(true);
    expect(result.engpass_heatmap.lockReason).toBeNull();
    // Andere Features weiterhin gesperrt
    expect(result.performance_score.available).toBe(false);
  });

  it("Override kann Datenreife NICHT überschreiben", () => {
    // Basis Plan + Override = Plan ist OK, aber Datenreife ist "in_aufbau"
    const result = resolveFeatures("basis", allBuilding, [
      { featureKey: "engpass_heatmap", enabled: true }
    ]);
    expect(result.engpass_heatmap.available).toBe(false);
    expect(result.engpass_heatmap.lockReason).toBe("datenreife");
  });
});
