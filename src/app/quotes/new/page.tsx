"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Package, FileText, CheckCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";

type WizardStep = "customer" | "details" | "text" | "summary";

export default function NewQuotePage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("customer");
  
  // State for the new inquiry
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [partCount, setPartCount] = useState<number>(1);
  const [material, setMaterial] = useState("Stahlblech");
  const [rustLevel, setRustLevel] = useState<"Leicht" | "Mittel" | "Stark" | "Sehr stark">("Leicht");
  const [dirtLevel, setDirtLevel] = useState<"Sauber" | "Leicht" | "Stark">("Leicht");
  const [description, setDescription] = useState("");

  const steps: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: "customer", label: "Kunde", icon: <User className="w-4 h-4" /> },
    { id: "details", label: "Bauteile", icon: <Package className="w-4 h-4" /> },
    { id: "text", label: "Text", icon: <FileText className="w-4 h-4" /> },
    { id: "summary", label: "Prüfung", icon: <CheckCircle className="w-4 h-4" /> },
  ];

  const handleSave = async () => {
    await inquiriesRepository.create({
      customerName: customerName || "Unbekannter Anrufer",
      customerId: customerId || "",
      subject: subject || "Neue Anfrage",
      description: description || "Keine Beschreibung hinterlegt.",
      partCount,
      material,
      rustLevel,
      dirtLevel
    });
    router.push("/quotes");
  };

  return (
    <div className="min-h-screen bg-transparent font-sans pb-16">
      {/* Topbar */}
      <div className="bg-white border-b border-neutral-gray-300 py-4 px-4 md:px-8 mb-6 flex items-center justify-between shadow-xs sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/quotes" className="p-2 bg-bg-app-soft hover:bg-neutral-gray-100 text-text-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-serif text-navy-900">Anfrage erfassen</h1>
            <p className="text-xs font-semibold text-text-muted">Mitarbeiter-Erfassungsbogen</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-8 space-y-8">
        
        {/* Progress Bar */}
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-neutral-gray-100 -z-10 rounded-full"></div>
          {steps.map((s, i) => {
            const isActive = s.id === step;
            const isPast = steps.findIndex(st => st.id === step) > i;
            return (
              <div key={s.id} className="flex flex-col items-center gap-2 bg-bg-app-soft px-2">
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isActive ? "bg-navy-900 border-navy-700 text-white shadow-md scale-110" :
                  isPast ? "bg-success-green-soft0 border-success-green text-white" :
                  "bg-white border-gold-600 text-text-muted"
                }`}>
                  {isPast ? <CheckCircle className="w-5 h-5" /> : s.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? "text-navy-900" : isPast ? "text-success-green" : "text-text-muted"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Wizard Forms */}
        <Card className="border-2 border-neutral-gray-300 shadow-sm rounded-3xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            
            {step === "customer" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <h2 className="text-xl font-black font-serif text-navy-900">1. Wer fragt an?</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Kundenname / Firma</label>
                    <input 
                      type="text" 
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Z.B. Garage Müller oder Max Mustermann" 
                      className="w-full p-4 bg-bg-app-soft border-2 border-neutral-gray-300 rounded-xl focus:border-navy-700 focus:ring-0 text-navy-900 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Kundennummer (Optional)</label>
                    <input 
                      type="text" 
                      value={customerId}
                      onChange={e => setCustomerId(e.target.value)}
                      placeholder="Z.B. K-00123" 
                      className="w-full p-4 bg-bg-app-soft border-2 border-neutral-gray-300 rounded-xl focus:border-navy-700 focus:ring-0 text-navy-900 font-bold"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={() => setStep("details")} className="bg-navy-900 hover:bg-navy-700 text-white rounded-xl h-12 px-6 font-bold">
                    Weiter zu Bauteile <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === "details" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <h2 className="text-xl font-black font-serif text-navy-900">2. Worum geht es?</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Titel / Betreff</label>
                    <input 
                      type="text" 
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Z.B. Stoßstange Verchromen" 
                      className="w-full p-4 bg-bg-app-soft border-2 border-neutral-gray-300 rounded-xl focus:border-navy-700 focus:ring-0 text-navy-900 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Anzahl Teile</label>
                      <input 
                        type="number" 
                        min="1"
                        value={partCount}
                        onChange={e => setPartCount(parseInt(e.target.value) || 1)}
                        className="w-full p-4 bg-bg-app-soft border-2 border-neutral-gray-300 rounded-xl focus:border-navy-700 focus:ring-0 text-navy-900 font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Material</label>
                      <select 
                        value={material}
                        onChange={e => setMaterial(e.target.value)}
                        className="w-full p-4 bg-bg-app-soft border-2 border-neutral-gray-300 rounded-xl focus:border-navy-700 focus:ring-0 text-navy-900 font-bold appearance-none"
                      >
                        <option value="Stahlblech">Stahlblech</option>
                        <option value="Messing / Kupfer">Messing / Kupfer</option>
                        <option value="Aluminium">Aluminium</option>
                        <option value="Zinkdruckguss">Zinkdruckguss</option>
                        <option value="Unbekannt">Unbekannt</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Rost-Grad</label>
                      <select 
                        value={rustLevel}
                        onChange={e => setRustLevel(e.target.value as "Leicht" | "Mittel" | "Stark" | "Sehr stark")}
                        className="w-full p-4 bg-bg-app-soft border-2 border-neutral-gray-300 rounded-xl focus:border-navy-700 focus:ring-0 text-navy-900 font-bold appearance-none"
                      >
                        <option value="Leicht">Leicht</option>
                        <option value="Mittel">Mittel</option>
                        <option value="Stark">Stark</option>
                        <option value="Sehr stark">Sehr stark</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Schmutz / Lack</label>
                      <select 
                        value={dirtLevel}
                        onChange={e => setDirtLevel(e.target.value as "Sauber" | "Leicht" | "Stark")}
                        className="w-full p-4 bg-bg-app-soft border-2 border-neutral-gray-300 rounded-xl focus:border-navy-700 focus:ring-0 text-navy-900 font-bold appearance-none"
                      >
                        <option value="Sauber">Sauber / Blank</option>
                        <option value="Leicht">Leicht verschmutzt</option>
                        <option value="Stark">Stark (alter Lack, Öl)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between pt-4 border-t border-neutral-gray-100">
                  <Button variant="ghost" onClick={() => setStep("customer")} className="text-text-muted font-bold">
                    <ChevronLeft className="w-4 h-4 mr-2" /> Zurück
                  </Button>
                  <Button onClick={() => setStep("text")} className="bg-navy-900 hover:bg-navy-700 text-white rounded-xl h-12 px-6 font-bold">
                    Weiter zu Beschreibung <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === "text" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <h2 className="text-xl font-black font-serif text-navy-900">3. Kundenwunsch / Text</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Notizen & Beschreibung</label>
                    <textarea 
                      rows={5}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Was genau wünscht der Kunde? Welche Besonderheiten gibt es?" 
                      className="w-full p-4 bg-bg-app-soft border-2 border-neutral-gray-300 rounded-xl focus:border-navy-700 focus:ring-0 text-navy-900 font-bold resize-none"
                    />
                  </div>
                  
                  <div className="p-5 border-2 border-dashed border-neutral-gray-300 rounded-xl text-center space-y-2 bg-bg-app-soft">
                    <p className="text-sm font-bold text-text-muted">Fotos hochladen (Optional)</p>
                    <p className="text-xs text-text-muted">Das Anfügen von Fotos ist in V1.0 noch deaktiviert.</p>
                  </div>
                </div>
                <div className="flex justify-between pt-4 border-t border-neutral-gray-100">
                  <Button variant="ghost" onClick={() => setStep("details")} className="text-text-muted font-bold">
                    <ChevronLeft className="w-4 h-4 mr-2" /> Zurück
                  </Button>
                  <Button onClick={() => setStep("summary")} className="bg-navy-900 hover:bg-navy-700 text-white rounded-xl h-12 px-6 font-bold">
                    Weiter zur Prüfung <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === "summary" && (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <h2 className="text-xl font-black font-serif text-navy-900">4. Zusammenfassung</h2>
                
                <div className="bg-bg-app-soft border border-neutral-gray-300 rounded-2xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Kunde</p>
                      <p className="font-bold text-navy-900">{customerName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Betreff</p>
                      <p className="font-bold text-navy-900">{subject || "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-gray-300">
                    <div>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Material & Teile</p>
                      <p className="font-bold text-navy-900">{partCount}x {material}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Zustand</p>
                      <p className="font-bold text-navy-900">Rost: {rustLevel} | Schmutz: {dirtLevel}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-neutral-gray-300">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Beschreibung</p>
                    <p className="font-semibold text-text-muted text-sm mt-1">{description || "Keine Beschreibung"}</p>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-neutral-gray-100">
                  <Button variant="ghost" onClick={() => setStep("text")} className="text-text-muted font-bold">
                    <ChevronLeft className="w-4 h-4 mr-2" /> Ändern
                  </Button>
                  <Button onClick={handleSave} className="bg-success-green hover:bg-success-green-soft0 text-white rounded-xl h-12 px-8 font-black shadow-lg shadow-emerald-200">
                    <CheckCircle className="w-5 h-5 mr-2" /> Anfrage speichern
                  </Button>
                </div>
              </div>
            )}
            
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
