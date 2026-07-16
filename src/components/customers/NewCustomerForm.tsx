"use client";

import { useState, useEffect, useRef } from "react";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customersRepository } from "@/lib/repositories/customersRepository";
import { createCustomerDb } from "@/app/actions/customers.actions";
import { Loader } from "@googlemaps/js-api-loader";
import { Building2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import Image from "next/image";

interface NewCustomerFormProps {
  onClose: () => void;
  customerId?: string | null; // If provided, load existing customer
  previewUrl?: string; // Initial image base64 from OCR
  onSave?: (customerId: string) => void;
  inline?: boolean; // If true, renders without the modal/drawer wrapper
}

export function NewCustomerForm({ onClose, customerId, previewUrl, onSave, inline = false }: NewCustomerFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  
  // Form State
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  
  // Images
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  
  const streetInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialize
  useEffect(() => {
    if (customerId) {
      customersRepository.getById(customerId).then(data => {
        if (data) {
          setName(data.name || "");
          setCompanyName(data.companyName || "");
          setStreet(data.address || "");
          setZipCode(data.zipCode || "");
          setCity(data.city || "");
          setPhone(data.phone || "");
          setEmail(data.email || "");
          setNotes(data.notes || "");
          setImageUrls(data.imageUrls || []);
          setCustomerNumber(data.customerNumber || "");
        }
      });
    }
    
    // Autofocus
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  }, [customerId]);

  // Initialize Google Maps Places Autocomplete
  useEffect(() => {
    const initAutocomplete = async () => {
      if (!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY) {
        console.warn("No Google Places API key found.");
        return;
      }
      
      const loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
        version: "weekly",
        libraries: ["places"],
      });

      try {
        // @ts-expect-error - Type definition for loader might be outdated but importLibrary exists at runtime
        const { Autocomplete } = await loader.importLibrary("places");
        if (streetInputRef.current) {
          const autocomplete = new Autocomplete(streetInputRef.current, {
            fields: ["address_components", "geometry", "name"],
            types: ["address"],
            componentRestrictions: { country: ["de", "at", "ch"] }, // Restrict to DACH region optionally
          });

          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.address_components) return;

            let streetName = "";
            let streetNumber = "";
            let postCode = "";
            let locality = "";

            for (const component of place.address_components) {
              const types = component.types;
              if (types.includes("route")) streetName = component.long_name;
              if (types.includes("street_number")) streetNumber = component.long_name;
              if (types.includes("postal_code")) postCode = component.long_name;
              if (types.includes("locality")) locality = component.long_name;
            }

            setStreet(`${streetName} ${streetNumber}`.trim());
            if (postCode) setZipCode(postCode);
            if (locality) setCity(locality);
          });
        }
      } catch (err) {
        console.error("Failed to load Google Maps Places API", err);
      }
    };

    initAutocomplete();
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      setErrors({});
      let savedId = customerId;
      if (customerId) {
        await customersRepository.updateCustomer(customerId, {
          name,
          companyName,
          address: street,
          zipCode,
          city,
          phone,
          email,
          notes,
        });
      } else {
        const res = await createCustomerDb({
          name,
          companyName,
          type: companyName ? "business" : "private",
          address: street,
          zipCode,
          city,
          phone,
          email,
          notes,
          source: "manual",
        });
        if (!res.ok) {
          setErrors({ submit: [res.message || "Unbekannter Fehler"] });
          setLoading(false);
          return;
        } else if (res.data) {
          savedId = res.data.id;
          setCustomerNumber(res.data.customerNumber);
        }
      }

      if (onSave && savedId) {
        onSave(savedId);
        // We still let the parent handle the visual if it wants, 
        // but if it's inline or we want to show it, we can just close.
        // Actually, if onSave is passed, let parent handle it or show success here:
        setSuccess(true);
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setErrors({ submit: [err instanceof Error ? err.message : "Kunde konnte nicht gespeichert werden."] });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const successContent = (
      <div className="flex flex-col h-[400px] max-w-[500px] mx-auto bg-white rounded-2xl relative justify-center items-center p-8 text-center border border-neutral-gray-100">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif text-navy-900 mb-2">Kunde gespeichert!</h2>
        <p className="text-gray-600 mb-8">
          Der Kunde <strong>{name}</strong> wurde erfolgreich gespeichert.
        </p>
        <Button
          onClick={onClose}
          className="w-full max-w-xs h-12 bg-navy-900 text-white font-bold rounded-lg hover:bg-navy-800 transition-all"
        >
          Schließen
        </Button>
      </div>
    );

    if (inline) return successContent;
    return (
      <ResponsiveDetailDrawer isOpen={true} onClose={onClose} title="Erfolg" centered={true}>
        {successContent}
      </ResponsiveDetailDrawer>
    );
  }

  const content = (
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        
        {/* Left Column: Form */}
        <div className="flex-1 flex flex-col gap-6">
          <p className="text-xs text-text-muted font-bold -mt-2 mb-2">
            Kundennummer: <span className="font-mono text-navy-900 bg-neutral-gray-100 px-2 py-0.5 rounded border">{customerNumber || "wird serverseitig vergeben"}</span>
          </p>
          {errors.submit && <p className="rounded-xl border border-danger-red/30 bg-danger-red/10 p-3 text-sm font-bold text-danger-red">{errors.submit[0]}</p>}

          {/* Body */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-900">Name *</label>
                <Input 
                  ref={nameInputRef}
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Max Mustermann"
                  className={`font-medium ${errors.name ? "border-danger-red focus-visible:ring-danger-red" : ""}`}
                />
                {errors.name && <p className="text-danger-red text-[10px] font-bold">{errors.name[0]}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-900">Firma (optional)</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-gray-400" />
                  <Input 
                    value={companyName} 
                    onChange={e => setCompanyName(e.target.value)} 
                    placeholder="Muster GmbH"
                    className="pl-9 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-bg-app-soft/30 p-4 rounded-xl border border-neutral-gray-100">
              <h3 className="text-xs font-black text-navy-900 uppercase tracking-wider">Adresse</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-navy-900">Straße & Hausnummer</label>
                  <Input 
                    ref={streetInputRef}
                    value={street} 
                    onChange={e => setStreet(e.target.value)} 
                    placeholder="Musterstraße 1"
                    className="font-medium"
                  />
                  {!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ? (
                    <p className="text-[10px] text-danger-red font-bold flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      Google Maps Autocomplete deaktiviert (API Key fehlt in .env)
                    </p>
                  ) : (
                    <p className="text-[10px] text-text-muted mt-1">Unterstützt Google Maps Autocomplete beim Tippen</p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 space-y-2">
                    <label className="text-xs font-bold text-navy-900">PLZ</label>
                    <Input 
                      value={zipCode} 
                      onChange={e => setZipCode(e.target.value)} 
                      placeholder="12345"
                      className="font-medium"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-bold text-navy-900">Stadt</label>
                    <Input 
                      value={city} 
                      onChange={e => setCity(e.target.value)} 
                      placeholder="Musterstadt"
                      className="font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-900">Telefon</label>
                <Input 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="+49 123 456789"
                  className={`font-medium ${errors.phone ? "border-danger-red focus-visible:ring-danger-red" : ""}`}
                />
                {errors.phone && <p className="text-danger-red text-[10px] font-bold">{errors.phone[0]}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-900">E-Mail</label>
                <Input 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="max@beispiel.de"
                  type="email"
                  className={`font-medium ${errors.email ? "border-danger-red focus-visible:ring-danger-red" : ""}`}
                />
                {errors.email && <p className="text-danger-red text-[10px] font-bold">{errors.email[0]}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-navy-900">Notiz</label>
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Besondere Hinweise..."
                className="w-full text-sm p-3 border border-neutral-gray-300 rounded-lg min-h-[80px] font-medium resize-none focus:outline-none focus:border-navy-700"
              />
            </div>
            
            {/* Existing media is read-only until a durable server upload workflow is available. */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-navy-900">Bilder & Dokumente</label>
              <p className="text-xs text-text-muted">Neue Kundendateien werden in diesem Formular derzeit nicht gespeichert. Der frühere Browser-Direktupload ist deaktiviert.</p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {imageUrls.map((url, idx) => (
                    <div key={`existing-${idx}`} className="relative shrink-0">
                      <Image 
                        src={url} 
                        alt="Gespeicherte Kundendatei"
                        width={64} 
                        height={64} 
                        className="w-16 h-16 object-cover rounded-xl border border-neutral-gray-200"
                      />
                    </div>
                  ))}
                  {previewUrl && !imageUrls.length && (
                    <div className="relative shrink-0">
                      <Image 
                        src={previewUrl} 
                        alt="Nicht gespeicherte Scan-Vorschau"
                        width={64} 
                        height={64} 
                        className="w-16 h-16 object-cover rounded-xl border border-neutral-gray-200"
                      />
                      <span className="mt-1 block text-[9px] font-bold text-amber-700">nur Vorschau</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="pt-4 mt-2 border-t border-neutral-gray-100 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading} className="font-bold h-12 px-6">
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={loading || !name} className="bg-navy-900 hover:bg-navy-800 text-white font-bold h-12 px-8 min-w-[140px]">
              {loading ? "Speichert..." : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Follow-up actions are deliberately not simulated here. */}
        <div className="w-full lg:w-[300px] flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-black font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">
              Aktionen
            </h3>
            
            <p className="text-xs text-text-muted leading-relaxed">
              Erst den Kunden serverseitig speichern. Aufträge werden anschließend über die echte Auftragserfassung angelegt; dieses Formular simuliert keine Folgeaktion.
            </p>
          </div>
        </div>
      </div>
  );

  if (inline) {
    return content;
  }

  return (
    <ResponsiveDetailDrawer 
      isOpen={true} 
      onClose={onClose}
      title={customerId ? "Kunde bearbeiten" : "Neuen Kunden anlegen"}
      centered={true}
    >
      {content}
    </ResponsiveDetailDrawer>
  );
}
