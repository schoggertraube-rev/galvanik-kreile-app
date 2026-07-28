"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

type TimeBookingInput = {
  auftrag_id: string;
  employee_id: string;
  station_kuerzel: string;
};

type CaptureInput = Record<string, unknown>;

export type CaptureActionResult = {
  ok: boolean;
  error: string;
  message?: string;
  success?: boolean;
  order?: {
    id?: string;
    orderNumber?: string;
    isQuote?: boolean;
    source?: string;
  };
};

function captureUnavailable(): never {
  if (!isFoundationAreaEnabled("Zeit-, Material- und Vorlagenerfassung")) {
    return foundationUnavailableAction("Zeit-, Material- und Vorlagenerfassung");
  }
  return foundationUnavailableAction("Zeit-, Material- und Vorlagenerfassung");
}

export async function startZeit(input: TimeBookingInput): Promise<CaptureActionResult> {
  void input;
  return captureUnavailable();
}

export async function stopZeit(input: CaptureInput): Promise<CaptureActionResult> {
  void input;
  return captureUnavailable();
}

export async function erfasseZeitDirekt(input: CaptureInput): Promise<CaptureActionResult> {
  void input;
  return captureUnavailable();
}

export async function erfasseVerbrauch(input: CaptureInput): Promise<CaptureActionResult> {
  void input;
  return captureUnavailable();
}

export async function uebernehmeVorlage(input: CaptureInput): Promise<CaptureActionResult> {
  void input;
  return captureUnavailable();
}

export async function createCustomerFromErfassung(input: CaptureInput): Promise<CaptureActionResult> {
  void input;
  return captureUnavailable();
}

export async function createOrderFromErfassung(input: CaptureInput): Promise<CaptureActionResult> {
  void input;
  return captureUnavailable();
}
