"use client";

import { useState, useEffect } from "react";
import { getCompanySettings, updateCompanySettings } from "@/app/actions/company.actions";
import { CompanySettings } from "@/lib/repositories/companySettingsRepository";
import { Loader2, Save, Upload, Building2 } from "lucide-react";

export function CompanySettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CompanySettings | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const settings = await getCompanySettings();
        setFormData(settings);
      } catch (e) {
        console.error("Failed to load company settings", e);
        alert("Firmendaten konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    
    setSaving(true);
    try {
      await updateCompanySettings(formData);
      alert("Firmendaten erfolgreich gespeichert.");
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("Fehler beim Speichern der Firmendaten.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = () => {
    alert("Upload-Funktion für Logo (Supabase Storage) noch nicht implementiert.\nLogo-URL kann im Textfeld angepasst werden.");
  };

  if (loading || !formData) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  const logoUrl = formData.logoUrl;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto pb-12">
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
                onClick={handleLogoUpload}
                className="flex items-center gap-2 bg-white border-2 border-neutral-gray-200 hover:bg-neutral-gray-100 text-navy-900 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                <Upload className="w-4 h-4" />
                Logo hochladen (Storage)
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
          
        </div>
      </div>
    </form>
  );
}
