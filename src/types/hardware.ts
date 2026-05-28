// src/types/hardware.ts
// Hardware-Bridge — Druckgeräte, Scanner, Terminal

export type HardwareDeviceKind =
  | "receipt_printer"
  | "label_printer"
  | "a4_printer"
  | "barcode_scanner"
  | "qr_scanner"
  | "payment_terminal"
  | "scale"
  | "camera_external";

export type HardwareDevice = {
  id: string;
  kind: HardwareDeviceKind;
  vendor?: string;
  model?: string;
  connection: "usb" | "bluetooth" | "lan" | "wlan" | "cloud_api";
  identifier?: string;
  stationLabel?: string;
  isDefaultFor?: string;
  isActive: boolean;
  lastSeenAt?: string;
  capabilities?: string[];
};

export type PrintJobType =
  | "invoice"
  | "delivery_note"
  | "label_item"
  | "label_order"
  | "receipt_payment";

export type PrintJob = {
  id: string;
  deviceId: string;
  jobType: PrintJobType;
  payload: Record<string, unknown>;
  status: "queued" | "printing" | "success" | "failed";
  attempts: number;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
};
