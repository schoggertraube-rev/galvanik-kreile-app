"use client";

import { useState, useEffect } from "react";
import { getCompanySettings, updateCompanySettings } from "@/app/actions/company.actions";
import type { CompanySettings } from "@/lib/repositories/companySettingsRepository";
import { Loader2, Save, Upload, Building2, Mail } from "lucide-react";

export function CompanySettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CompanySettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const settings = await getCompanySettings();
        setFormData(settings);
        setLoadError(null);
      } catch (e) {
        console.error("Failed to load company settings", e);
        setLoadError("Firmendaten konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    
    setSaving(true);
    try {
      const saved = await updateCompanySettings(formData);
      setFormData(saved);
      alert("Firmendaten erfolgreich gespeichert.");
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("Fehler beim Speichern der Firmendaten.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  if (loadError || !formData) {
    return <p className="rounded-xl border border-danger-red bg-accent-orange-soft p-4 text-sm font-bold text-danger-red">{loadError || "Firmendaten sind nicht verfügbar."}</p>;
  }

  const logoUrl = formData.logoUrl;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto pb-12">
      {!formData.configured && (
        <p className="rounded-xl border border-warning-yellow bg-warning-yellow/10 p-4 text-sm font-bold text-navy-900">
          Firmendaten sind noch nicht konfiguriert. Dokumente und E-Mails werden bis zum ersten erfolgreichen Speichern nicht erzeugt.
        </p>
      )}
      <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-gray-100 flex items-center justify-between bg-bg-app-soft">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-navy-900" />
            <div>
              <h2 className="text-lg font-bold text-navy-900">Firmendaten & Stammdaten</h2>
              <p className="text-sm text-text-muted">
                Diese Daten werden auf Lieferscheinen, Laufkarten und in E-Mails verwendet.
              </p>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 bg-navy-900 hover:bg-navy-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Speichern
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Logo Section */}
          <div className="md:col-span-2 flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-neutral-gray-50 p-6 rounded-2xl border border-neutral-gray-100">
            <div className="w-32 h-32 bg-white rounded-xl border border-neutral-gray-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm p-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Firmenlogo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-text-muted">Kein Logo</span>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-sm font-bold text-navy-900 mb-1">Logo URL</label>
                <input 
                  name="logoUrl"
                  value={formData.logoUrl}
                  onChange={handleChange}
                  className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-navy-500 transition-colors" 
                  placeholder="/assets/logo/... oder https://..."
                />
              </div>
              <button 
                type="button" 
                disabled
                className="flex items-center gap-2 bg-white border-2 border-neutral-gray-200 text-text-muted px-4 py-2 rounded-xl text-xs font-bold opacity-70"
              >
                <Upload className="w-4 h-4" />
                Logo-Upload noch nicht angebunden
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-navy-900 border-b border-neutral-gray-100 pb-2">Allgemein</h3>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Firmenname</label>
              <input name="companyName" value={formData.companyName} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Slogan / Tagline</label>
              <input name="tagline" value={formData.tagline} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">USt-IdNr.</label>
              <input name="taxId" value={formData.taxId} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-navy-900 border-b border-neutral-gray-100 pb-2">Adresse</h3>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Straße & Hausnummer</label>
              <input name="street" value={formData.street} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">PLZ</label>
                <input name="zip" value={formData.zip} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Stadt</label>
                <input name="city" value={formData.city} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Land</label>
              <input name="country" value={formData.country} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-navy-900 border-b border-neutral-gray-100 pb-2">Kontakt</h3>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Telefon</label>
              <input name="phone" value={formData.phone} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">E-Mail</label>
              <input name="email" value={formData.email} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Webseite</label>
              <input name="website" value={formData.website} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-navy-900 border-b border-neutral-gray-100 pb-2">Bankverbindung</h3>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Bank Name</label>
              <input name="bankName" value={formData.bankName} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">IBAN</label>
              <input name="iban" value={formData.iban} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">BIC</label>
              <input name="bic" value={formData.bic} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none font-mono" />
            </div>
          </div>
          
          <div className="md:col-span-2 space-y-6 mt-8">
            <h3 className="font-bold text-navy-900 border-b border-neutral-gray-100 pb-2 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              E-Mail-Vorlagen (Versand)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Anrede</label>
                  <input name="emailGreeting" value={formData.emailGreeting || ""} onChange={handleChange} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Abholhinweis</label>
                  <textarea name="emailPickupInfo" value={formData.emailPickupInfo || ""} onChange={handleChange} rows={2} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Zahlungshinweis</label>
                  <textarea name="emailPaymentInfo" value={formData.emailPaymentInfo || ""} onChange={handleChange} rows={2} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">AGB-Text</label>
                  <textarea name="emailAgbText" value={formData.emailAgbText || ""} onChange={handleChange} rows={2} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Zusätzliche Hinweise</label>
                  <textarea name="emailAdditionalNotes" value={formData.emailAdditionalNotes || ""} onChange={handleChange} rows={2} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">Signatur / Footer</label>
                  <textarea name="emailFooter" value={formData.emailFooter || ""} onChange={handleChange} rows={3} className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm focus:border-navy-500 focus:outline-none" />
                </div>
              </div>
              
              <div className="bg-neutral-gray-50 p-6 rounded-2xl border border-neutral-gray-200">
                <h4 className="text-sm font-bold text-navy-900 mb-4 uppercase tracking-wider">Live Vorschau</h4>
                <div className="bg-white p-6 rounded-xl border border-neutral-gray-200 text-sm text-gray-800 space-y-4 shadow-sm">
                  <p>{formData.emailGreeting || "Sehr geehrte Damen und Herren,"}</p>
                  <p>{formData.emailPickupInfo || "Ihr Auftrag ist fertig und kann abgeholt werden."}</p>
                  <div className="bg-gray-50 border-l-4 border-navy-900 p-3 my-4">
                    <strong>Auftragsdetails:</strong><br/>
                    Auftragsnummer: A-202600-0001<br/>
                    Artikel: 1x Musterteil
                  </div>
                  {formData.emailPaymentInfo && <p>{formData.emailPaymentInfo}</p>}
                  {formData.emailAdditionalNotes && <p>{formData.emailAdditionalNotes}</p>}
                  <p className="whitespace-pre-wrap mt-6">{formData.emailFooter || "Mit freundlichen Grüßen,\nIhr Team"}</p>
                  <hr className="my-4 border-gray-200" />
                  <div className="text-xs text-gray-500">
                    <strong>{formData.companyName}</strong><br/>
                    {formData.street}, {formData.zip} {formData.city}<br/>
                    {formData.website}<br/><br/>
                    {formData.emailAgbText}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </form>
  );
}
