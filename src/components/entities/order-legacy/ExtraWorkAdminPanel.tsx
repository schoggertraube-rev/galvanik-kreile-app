"use client";

import { useRef, useState } from "react";
import {
  configureExtraWorkCatalogPositionAction,
  getExtraWorkCatalogReceiptAction,
  getExtraWorkMasterDataAction,
  getExtraWorkRateReceiptAction,
  setExtraWorkHourlyRateAction,
} from "@/app/actions/orders.actions";
import type { ExtraWorkMasterData } from "@/lib/server/orderCardRead";

type Props = {
  masterData: ExtraWorkMasterData;
  onConfirmed: (masterData: ExtraWorkMasterData) => void;
};

type CatalogEntry = ExtraWorkMasterData["catalog"][number];

function CatalogEditor({ entry, onConfirmed }: {
  entry: CatalogEntry;
  onConfirmed: (masterData: ExtraWorkMasterData) => void;
}) {
  const [name, setName] = useState(entry.name);
  const [minutes, setMinutes] = useState(String(entry.standardMinutes));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestRef = useRef<{ key: string; clientEventId: string } | null>(null);

  async function save(active: boolean) {
    const normalizedName = name.trim();
    const parsedMinutes = Number(minutes);
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setMessage("Name muss zwischen 2 und 100 Zeichen lang sein.");
      return;
    }
    if (!Number.isSafeInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
      setMessage("Standardzeit muss zwischen 1 und 1440 Minuten liegen.");
      return;
    }
    const key = JSON.stringify({ version: entry.version, normalizedName, parsedMinutes, active });
    if (requestRef.current?.key !== key) {
      requestRef.current = { key, clientEventId: globalThis.crypto.randomUUID() };
    }
    const clientEventId = requestRef.current.clientEventId;
    setPending(true);
    setMessage(null);
    try {
      const command = await configureExtraWorkCatalogPositionAction({
        positionId: entry.id,
        expectedVersion: entry.version,
        name: normalizedName,
        standardMinutes: parsedMinutes,
        active,
        clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      const [receipt, master] = await Promise.all([
        getExtraWorkCatalogReceiptAction({ positionId: entry.id, clientEventId }),
        getExtraWorkMasterDataAction(),
      ]);
      const persisted = master.code === "OK"
        ? master.data.catalog.find((candidate) => candidate.id === entry.id)
        : undefined;
      if (
        receipt.code !== "OK"
        || !receipt.data
        || receipt.data.eventId !== command.receipt.eventId
        || receipt.data.correlationId !== command.receipt.correlationId
        || receipt.data.aggregateVersion !== command.receipt.aggregateVersion
        || master.code !== "OK"
        || persisted?.version !== command.receipt.aggregateVersion
        || persisted.name !== command.receipt.name
        || persisted.standardMinutes !== command.receipt.standardMinutes
        || persisted.active !== command.receipt.active
      ) {
        setMessage("Katalogänderung wurde nicht bestätigt; neu laden.");
        return;
      }
      requestRef.current = null;
      onConfirmed(master.data);
      setMessage("Katalogänderung bestätigt.");
    } catch {
      setMessage("Katalogänderung ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="grid gap-2 rounded-lg border border-neutral-gray-200 p-3 md:grid-cols-[1fr_110px_auto] md:items-end">
      <label className="text-xs font-semibold text-text-muted">
        Position
        <input value={name} disabled={pending} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 px-3 text-sm text-navy-900" />
      </label>
      <label className="text-xs font-semibold text-text-muted">
        Standard-Min.
        <input type="number" min={1} max={1440} value={minutes} disabled={pending} onChange={(event) => setMinutes(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 px-3 text-sm text-navy-900" />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => void save(entry.active)} className="min-h-10 rounded-lg bg-navy-900 px-3 text-xs font-semibold text-white disabled:opacity-50">Speichern</button>
        <button type="button" disabled={pending} onClick={() => void save(!entry.active)} className="min-h-10 rounded-lg border border-neutral-gray-200 px-3 text-xs font-semibold text-navy-900 disabled:opacity-50">{entry.active ? "Deaktivieren" : "Aktivieren"}</button>
      </div>
      {message ? <p className="text-xs text-text-muted md:col-span-3" role="status">{message}</p> : null}
    </li>
  );
}

export function ExtraWorkAdminPanel({ masterData, onConfirmed }: Props) {
  const [open, setOpen] = useState(false);
  const [rateEuro, setRateEuro] = useState(
    masterData.currentRate ? (masterData.currentRate.hourlyRateCents / 100).toFixed(2) : "",
  );
  const [newName, setNewName] = useState("");
  const [newMinutes, setNewMinutes] = useState("30");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestRef = useRef<{ key: string; id: string; clientEventId: string } | null>(null);

  async function saveRate() {
    const normalized = rateEuro.trim().replace(",", ".");
    const cents = Math.round(Number(normalized) * 100);
    if (!Number.isSafeInteger(cents) || cents < 1 || cents > 1_000_000) {
      setMessage("Stundensatz muss zwischen 0,01 und 10.000,00 EUR liegen.");
      return;
    }
    const expectedVersion = masterData.currentRate?.version ?? 0;
    const key = `rate:${expectedVersion}:${cents}`;
    if (requestRef.current?.key !== key) {
      requestRef.current = { key, id: globalThis.crypto.randomUUID(), clientEventId: globalThis.crypto.randomUUID() };
    }
    const request = requestRef.current;
    setPending(true);
    setMessage(null);
    try {
      const command = await setExtraWorkHourlyRateAction({
        rateId: request.id,
        expectedVersion,
        hourlyRateCents: cents,
        clientEventId: request.clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      const [receipt, master] = await Promise.all([
        getExtraWorkRateReceiptAction({ rateId: request.id, clientEventId: request.clientEventId }),
        getExtraWorkMasterDataAction(),
      ]);
      if (
        receipt.code !== "OK"
        || !receipt.data
        || receipt.data.eventId !== command.receipt.eventId
        || receipt.data.correlationId !== command.receipt.correlationId
        || master.code !== "OK"
        || master.data.currentRate?.id !== command.receipt.rateId
        || master.data.currentRate.hourlyRateCents !== command.receipt.hourlyRateCents
        || master.data.currentRate.version !== command.receipt.aggregateVersion
      ) {
        setMessage("Stundensatz wurde nicht bestätigt; neu laden.");
        return;
      }
      requestRef.current = null;
      onConfirmed(master.data);
      setMessage("Stundensatz bestätigt.");
    } catch {
      setMessage("Stundensatz ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  async function createPosition() {
    const name = newName.trim();
    const minutes = Number(newMinutes);
    if (name.length < 2 || name.length > 100 || !Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440) {
      setMessage("Neue Position benötigt Name (2–100 Zeichen) und 1–1440 Minuten.");
      return;
    }
    const key = `catalog:0:${name}:${minutes}`;
    if (requestRef.current?.key !== key) {
      requestRef.current = { key, id: globalThis.crypto.randomUUID(), clientEventId: globalThis.crypto.randomUUID() };
    }
    const request = requestRef.current;
    setPending(true);
    setMessage(null);
    try {
      const command = await configureExtraWorkCatalogPositionAction({
        positionId: request.id,
        expectedVersion: 0,
        name,
        standardMinutes: minutes,
        active: true,
        clientEventId: request.clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      const [receipt, master] = await Promise.all([
        getExtraWorkCatalogReceiptAction({ positionId: request.id, clientEventId: request.clientEventId }),
        getExtraWorkMasterDataAction(),
      ]);
      const persisted = master.code === "OK"
        ? master.data.catalog.find((candidate) => candidate.id === request.id)
        : undefined;
      if (
        receipt.code !== "OK"
        || !receipt.data
        || receipt.data.eventId !== command.receipt.eventId
        || master.code !== "OK"
        || persisted?.version !== 1
        || persisted.name !== name
        || persisted.standardMinutes !== minutes
      ) {
        setMessage("Katalogposition wurde nicht bestätigt; neu laden.");
        return;
      }
      requestRef.current = null;
      setNewName("");
      onConfirmed(master.data);
      setMessage("Katalogposition bestätigt.");
    } catch {
      setMessage("Katalogposition ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-gray-200 bg-white p-4" data-testid="extra-work-admin-panel">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-10 w-full items-center justify-between text-left text-sm font-semibold text-navy-900">
        Mehrarbeits-Stammdaten (Admin)
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="mt-4 space-y-5">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <label className="text-xs font-semibold text-text-muted">
              Stundensatz in EUR
              <input inputMode="decimal" value={rateEuro} disabled={pending} onChange={(event) => setRateEuro(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 px-3 text-sm text-navy-900" />
            </label>
            <button type="button" disabled={pending} onClick={() => void saveRate()} className="min-h-10 rounded-lg bg-navy-900 px-4 text-xs font-semibold text-white disabled:opacity-50">Satz speichern</button>
          </div>
          <ul className="space-y-2">
            {masterData.catalog.map((entry) => <CatalogEditor key={entry.id} entry={entry} onConfirmed={onConfirmed} />)}
          </ul>
          <div className="grid gap-2 rounded-lg border border-dashed border-neutral-gray-300 p-3 md:grid-cols-[1fr_110px_auto] md:items-end" data-testid="extra-work-catalog-create">
            <label className="text-xs font-semibold text-text-muted">Neue Position<input value={newName} disabled={pending} onChange={(event) => setNewName(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 px-3 text-sm text-navy-900" /></label>
            <label className="text-xs font-semibold text-text-muted">Standard-Min.<input type="number" min={1} max={1440} value={newMinutes} disabled={pending} onChange={(event) => setNewMinutes(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 px-3 text-sm text-navy-900" /></label>
            <button type="button" disabled={pending} onClick={() => void createPosition()} className="min-h-10 rounded-lg bg-navy-900 px-4 text-xs font-semibold text-white disabled:opacity-50">Anlegen</button>
          </div>
          {message ? <p className="text-xs text-text-muted" role="status">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
