"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { createKostenpostenAction } from "@/app/buchhaltung/actions";

export function KostenForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [bezeichnung, setBezeichnung] = useState("");
  const [art, setArt] = useState<"fix" | "variabel">("fix");
  const [kategorie, setKategorie] = useState("");
  const [betrag, setBetrag] = useState("");
  const [intervall, setIntervall] = useState<"einmalig" | "monatlich" | "jaehrlich">("monatlich");
  const [giltAb, setGiltAb] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!bezeichnung || !betrag || !art || !intervall) {
      return setError("Bitte füllen Sie alle Pflichtfelder aus.");
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("bezeichnung", bezeichnung);
        fd.append("art", art);
        if (kategorie) fd.append("kategorie", kategorie);
        fd.append("betrag", betrag);
        fd.append("intervall", intervall);
        if (giltAb) fd.append("giltAb", giltAb);

        await createKostenpostenAction(fd);
        router.push("/buchhaltung/kosten");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Fehler beim Speichern des Kostenpostens.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 max-w-4xl">
      {error && (
        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-semibold mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Bezeichnung *</label>
          <input
            type="text"
            value={bezeichnung}
            onChange={e => setBezeichnung(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
            required
            placeholder="z.B. Miete Halle 1"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Betrag (€) *</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={betrag}
            onChange={e => setBetrag(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
            required
            placeholder="0,00"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Art *</label>
          <select
            value={art}
            onChange={e => setArt(e.target.value as "fix" | "variabel")}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            <option value="fix">Fixkosten</option>
            <option value="variabel">Variable Kosten</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Intervall *</label>
          <select
            value={intervall}
            onChange={e => setIntervall(e.target.value as "einmalig" | "monatlich" | "jaehrlich")}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            <option value="einmalig">Einmalig</option>
            <option value="monatlich">Monatlich</option>
            <option value="jaehrlich">Jährlich</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Kategorie</label>
          <select
            value={kategorie}
            onChange={e => setKategorie(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            <option value="">(Keine)</option>
            <option value="marketing">Marketing</option>
            <option value="instandhaltung">Instandhaltung</option>
            <option value="büro">Büro</option>
            <option value="fahrzeuge">Fahrzeuge</option>
            <option value="personal">Personal</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Gilt Ab</label>
          <input
            type="date"
            value={giltAb}
            onChange={e => setGiltAb(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-neutral-100 pt-6">
        <div className="flex-1" />
        
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-navy-900 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-navy-800 transition-colors disabled:opacity-50"
        >
          {isPending ? "Speichert..." : (
            <>
              <Save className="w-4 h-4" /> Speichern
            </>
          )}
        </button>
      </div>
    </form>
  );
}
