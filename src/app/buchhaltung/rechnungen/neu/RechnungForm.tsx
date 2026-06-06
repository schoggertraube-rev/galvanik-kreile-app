"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Send } from "lucide-react";
import { createRechnungAction } from "@/app/buchhaltung/actions";
import { AusgangsrechnungPosition } from "@/lib/buchhaltung/types";

export function RechnungForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [nummer, setNummer] = useState("RE-2026-001");
  const [kundeId, setKundeId] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().substring(0, 10));
  
  const in14Days = new Date();
  in14Days.setDate(in14Days.getDate() + 14);
  const [faelligAm, setFaelligAm] = useState(in14Days.toISOString().substring(0, 10));

  const [ustSatz, setUstSatz] = useState(19);
  const [bemerkung, setBemerkung] = useState("");
  const [leadId, setLeadId] = useState("");
  const [isDemo, setIsDemo] = useState(false);

  const [positionen, setPositionen] = useState<AusgangsrechnungPosition[]>([
    { beschreibung: "", menge: 1, einzelpreisNetto: 0 }
  ]);

  const nettoSum = positionen.reduce((sum, pos) => sum + pos.menge * pos.einzelpreisNetto, 0);
  const ustBetrag = nettoSum * (ustSatz / 100);
  const bruttoSum = nettoSum + ustBetrag;

  const handleAddPosition = () => {
    setPositionen([...positionen, { beschreibung: "", menge: 1, einzelpreisNetto: 0 }]);
  };

  const handleRemovePosition = (index: number) => {
    if (positionen.length > 1) {
      setPositionen(positionen.filter((_, i) => i !== index));
    }
  };

  const handleChangePosition = (index: number, field: keyof AusgangsrechnungPosition, value: any) => {
    const newPos = [...positionen];
    newPos[index] = { ...newPos[index], [field]: value };
    setPositionen(newPos);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nummer) return setError("Rechnungsnummer fehlt.");
    if (!kundeId) return setError("Kunde fehlt.");
    if (!datum) return setError("Rechnungsdatum fehlt.");
    if (!faelligAm) return setError("Fälligkeitsdatum fehlt.");
    
    if (new Date(faelligAm) < new Date(datum)) {
      return setError("Fälligkeitsdatum muss nach oder auf dem Rechnungsdatum liegen.");
    }
    
    if (new Date(datum) > new Date()) {
      return setError("Rechnungsdatum darf nicht in der Zukunft liegen.");
    }

    if (positionen.length === 0) return setError("Mindestens eine Position erforderlich.");
    
    for (const p of positionen) {
      if (p.beschreibung.length < 2) return setError("Positionsbeschreibung muss min. 2 Zeichen lang sein.");
      if (p.menge <= 0) return setError("Menge muss größer 0 sein.");
      if (p.einzelpreisNetto <= 0) return setError("Einzelpreis muss größer 0 sein.");
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("nummer", nummer);
        fd.append("kundeId", kundeId);
        fd.append("datum", datum);
        fd.append("faelligAm", faelligAm);
        fd.append("ustSatz", ustSatz.toString());
        if (bemerkung) fd.append("bemerkung", bemerkung);
        if (leadId) fd.append("leadId", leadId);
        fd.append("isDemo", isDemo.toString());

        await createRechnungAction(fd, positionen);
        router.push("/buchhaltung/rechnungen");
      } catch (err: any) {
        setError(err.message || "Fehler beim Speichern der Rechnung.");
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
          <label className="block text-xs font-bold text-neutral-500 mb-2">Rechnungsnummer *</label>
          <input
            type="text"
            value={nummer}
            onChange={e => setNummer(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Kunde (ID) *</label>
          <input
            type="text"
            value={kundeId}
            onChange={e => setKundeId(e.target.value)}
            placeholder="z.B. KUNDEN-ID-123"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Rechnungsdatum *</label>
          <input
            type="date"
            value={datum}
            onChange={e => setDatum(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Fälligkeitsdatum *</label>
          <input
            type="date"
            value={faelligAm}
            onChange={e => setFaelligAm(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">USt-Satz *</label>
          <select
            value={ustSatz}
            onChange={e => setUstSatz(Number(e.target.value))}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            <option value={19}>19 %</option>
            <option value={7}>7 %</option>
            <option value={0}>0 %</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-2">Lead-Quelle (optional)</label>
          <input
            type="text"
            value={leadId}
            onChange={e => setLeadId(e.target.value)}
            placeholder="Lead-ID"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
          />
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1e1b18]">Positionen</h3>
          <button
            type="button"
            onClick={handleAddPosition}
            className="flex items-center gap-1.5 text-xs font-bold text-navy-900 bg-navy-50 px-3 py-1.5 rounded-lg hover:bg-navy-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Position hinzufügen
          </button>
        </div>

        <div className="border border-neutral-100 rounded-2xl overflow-hidden bg-neutral-50/50">
          <div className="grid grid-cols-[1fr_100px_120px_40px] gap-4 p-4 border-b border-neutral-100 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            <div>Beschreibung</div>
            <div>Menge</div>
            <div>Einzelpreis (Netto)</div>
            <div></div>
          </div>
          {positionen.map((pos, index) => (
            <div key={index} className="grid grid-cols-[1fr_100px_120px_40px] gap-4 p-4 items-center border-b border-neutral-100 last:border-0">
              <input
                type="text"
                value={pos.beschreibung}
                onChange={e => handleChangePosition(index, "beschreibung", e.target.value)}
                placeholder="Beschreibung..."
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
                required
                minLength={2}
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={pos.menge}
                onChange={e => handleChangePosition(index, "menge", Number(e.target.value))}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
                required
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={pos.einzelpreisNetto}
                onChange={e => handleChangePosition(index, "einzelpreisNetto", Number(e.target.value))}
                className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900"
                required
              />
              <button
                type="button"
                onClick={() => handleRemovePosition(index)}
                disabled={positionen.length === 1}
                className="p-2 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
        <div className="flex-1">
          <label className="block text-xs font-bold text-neutral-500 mb-2">Bemerkung</label>
          <textarea
            value={bemerkung}
            onChange={e => setBemerkung(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900 resize-none"
            placeholder="Optionale Bemerkung zur Rechnung..."
          />
        </div>
        
        <div className="w-full md:w-64 bg-neutral-50 rounded-2xl p-5 border border-neutral-100 flex flex-col gap-3">
          <div className="flex justify-between items-center text-sm font-semibold text-neutral-500">
            <span>Netto</span>
            <span>{nettoSum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between items-center text-sm font-semibold text-neutral-500">
            <span>USt. ({ustSatz}%)</span>
            <span>{ustBetrag.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="w-full h-px bg-neutral-200 my-1" />
          <div className="flex justify-between items-center text-lg font-extrabold text-[#1e1b18]">
            <span>Brutto</span>
            <span>{bruttoSum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-neutral-100 pt-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isDemo}
            onChange={e => setIsDemo(e.target.checked)}
            className="w-4 h-4 text-navy-900 border-neutral-300 rounded focus:ring-navy-900"
          />
          <span className="text-xs font-semibold text-neutral-500">Demo-Eintrag</span>
        </label>
        
        <div className="flex-1" />
        
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-navy-900 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-navy-800 transition-colors disabled:opacity-50"
        >
          {isPending ? "Speichert..." : (
            <>
              <Save className="w-4 h-4" /> Rechnung speichern
            </>
          )}
        </button>
      </div>
    </form>
  );
}
