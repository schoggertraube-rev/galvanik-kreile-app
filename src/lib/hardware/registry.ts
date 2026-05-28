// src/lib/hardware/registry.ts
// Geräteregister — verwaltet HardwareDevices per localStorage
import type { HardwareDevice } from "@/types/hardware";

const STORAGE_KEY = "kreile_hardware_devices";

function load(): HardwareDevice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultDevices();
  } catch {
    return getDefaultDevices();
  }
}

function save(devices: HardwareDevice[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch {
    // ignore
  }
}

function getDefaultDevices(): HardwareDevice[] {
  return [
    {
      id: "dev-label-01",
      kind: "label_printer",
      vendor: "Zebra",
      model: "ZD220",
      connection: "usb",
      stationLabel: "Wareneingang",
      isDefaultFor: "label_order",
      isActive: true,
      capabilities: ["zpl", "auto_cut"],
    },
    {
      id: "dev-a4-01",
      kind: "a4_printer",
      vendor: "HP",
      model: "LaserJet M209",
      connection: "wlan",
      stationLabel: "Büro",
      isDefaultFor: "invoice",
      isActive: true,
      capabilities: ["a4", "duplex"],
    },
  ];
}

export const hardwareRegistry = {
  getAll: () => load(),
  getById: (id: string) => load().find((d) => d.id === id),
  getDefault: (forJobType: string) =>
    load().find((d) => d.isDefaultFor === forJobType && d.isActive),
  add: (device: HardwareDevice) => {
    const devices = load();
    devices.push(device);
    save(devices);
  },
  update: (device: HardwareDevice) => {
    const devices = load();
    const idx = devices.findIndex((d) => d.id === device.id);
    if (idx >= 0) {
      devices[idx] = device;
      save(devices);
    }
  },
  remove: (id: string) => {
    save(load().filter((d) => d.id !== id));
  },
};
