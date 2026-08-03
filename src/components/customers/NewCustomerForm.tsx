"use client";

import { useState, useEffect, useRef } from "react";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customersRepository } from "@/lib/repositories/customersRepository";
import { Customer } from "@/lib/types/customer";
import { createClient } from "@/lib/supabase/client";
import { createCustomerDb } from "@/app/actions/customers.actions";
import { Loader } from "@googlemaps/js-api-loader";
import { Building2, Save, Upload, FilePlus2, Copy, AlertTriangle, Camera, X, CheckCircle2 } from "lucide-react";
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
  const [customer, setCustomer] = useState<Customer | null>(null);
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
  const [files, setFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  
  const streetInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialize
  useEffect(() => {
    if (customerId) {
      customersRepository.getById(customerId).then(data => {
        if (data) {
          setCustomer(data);
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
    } else {
      // Auto-generate new customer number
      const year = new Date().getFullYear();
      const randomId = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      setCustomerNumber(`K-${year}-${randomId}`);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type === "image/jpeg" || file.type === "image/png"
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setErrors({});
      const supabase = createClient();
      
      // 1. Upload new files
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("customer-images")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Error uploading image:", uploadError);
          // Even if one fails, we continue with others
          continue;
        }

        const { data } = supabase.storage.from("customer-images").getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
      
      // Also upload previewUrl if provided
      if (previewUrl && previewUrl.startsWith("data:")) {
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        const fileName = `customer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
        const { data, error } = await supabase.storage.from("customer-images").upload(fileName, blob);
        if (!error && data) {
          const { data: publicUrlData } = supabase.storage.from("customer-images").getPublicUrl(fileName);
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }

      const allImageUrls = [...imageUrls, ...uploadedUrls];

      // 2. Save customer
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
          imageUrls: allImageUrls,
        });
      } else {
        const res = await createCustomerDb({
          name: name,
          companyName,
          type: companyName ? "business" : "private",
          address: street,
          zipCode,
          city,
          phone,
          email,
          notes,
          imageUrls: allImageUrls,
        });
        if (!res.ok) {
          setErrors({ submit: [res.message || "Unbekannter Fehler"] });
          setLoading(false);
          return;
        } else if (res.data) {
          savedId = res.data.id;
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
      console.error("Failed to save customer", {
        message: (err as Error).message || err,
        details: (err as { details?: unknown }).details,
        fullError: err
      });
      alert(`Fehler beim Speichern: ${(err as Error)?.message || "Unbekannter Fehler. Bitte überprüfen Sie Ihre Internetverbindung."}`);
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
            Kundennummer: <span className="font-mono text-navy-900 bg-neutral-gray-100 px-2 py-0.5 rounded border">{customerNumber}</span>
          </p>

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
            
            {/* Bilder Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-navy-900">Bilder & Dokumente (JPG/PNG)</label>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="cursor-pointer bg-white border-2 border-dashed border-neutral-gray-300 hover:border-navy-900 hover:bg-bg-app-soft transition-all rounded-xl p-4 flex flex-col items-center justify-center min-w-[120px]">
                  <Camera className="w-5 h-5 text-navy-900 mb-2" />
                  <span className="text-[10px] font-bold text-navy-900 text-center">Kamera<br/>starten</span>
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png" 
                    capture="environment"
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </label>

                <label className="cursor-pointer bg-white border-2 border-dashed border-neutral-gray-300 hover:border-navy-900 hover:bg-bg-app-soft transition-all rounded-xl p-4 flex flex-col items-center justify-center min-w-[120px]">
                  <Upload className="w-5 h-5 text-navy-900 mb-2" />
                  <span className="text-[10px] font-bold text-navy-900 text-center">Datei<br/>hochladen</span>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/jpeg, image/png" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </label>
                
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {imageUrls.map((url, idx) => (
                    <div key={`existing-${idx}`} className="relative shrink-0 group">
                      <Image 
                        src={url} 
                        alt="Customer file" 
                        width={64} 
                        height={64} 
                        className="w-16 h-16 object-cover rounded-xl border border-neutral-gray-200"
                      />
                      <button 
                        onClick={() => removeExistingImage(idx)}
                        className="absolute -top-2 -right-2 bg-danger-red text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {previewUrl && !imageUrls.length && !files.length && (
                    <div className="relative shrink-0 group">
                      <Image 
                        src={previewUrl} 
                        alt="Scanned Preview" 
                        width={64} 
                        height={64} 
                        className="w-16 h-16 object-cover rounded-xl border border-neutral-gray-200"
                      />
                    </div>
                  )}
                  {files.map((file, idx) => (
                    <div key={`new-${idx}`} className="relative shrink-0 group">
                      <Image 
                        src={URL.createObjectURL(file)} 
                        alt="Customer file preview" 
                        width={64} 
                        height={64} 
                        className="w-16 h-16 object-cover rounded-xl border border-neutral-gray-200"
                      />
                      <button 
                        onClick={() => removeFile(idx)}
                        className="absolute -top-2 -right-2 bg-danger-red text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
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

        {/* Right Column: Actions */}
        <div className="w-full lg:w-[300px] flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-black font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">
              Aktionen
            </h3>
            
            <Button className="w-full justify-start h-12 bg-white border border-neutral-gray-200 hover:bg-bg-app-soft text-navy-900 font-bold shadow-sm">
              <FilePlus2 className="w-4 h-4 mr-3 text-gold-600" />
              Auftrag anlegen
            </Button>

            {customerId && customer?.orders && customer.orders.length > 0 && (
              <Button className="w-full justify-start h-12 bg-white border border-neutral-gray-200 hover:bg-bg-app-soft text-navy-900 font-bold shadow-sm">
                <Copy className="w-4 h-4 mr-3 text-gold-600" />
                Letzten Auftrag duplizieren
              </Button>
            )}
            
            <p className="text-[10px] text-text-muted leading-relaxed mt-4">
              Wenn Sie sofort einen Auftrag anlegen möchten, können Sie die Schaltflächen hier nutzen. Der Kunde wird vorab automatisch gespeichert.
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
