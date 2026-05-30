import { createClient } from "@/lib/supabase/client";
import { OfflineManager } from "@/lib/offline/OfflineManager";

export interface CompanySettings {
  id?: string;
  tenantId?: string;
  companyName: string;
  tagline: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  bic: string;
  bankName: string;
  taxId: string;
  logoUrl: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: "Kreile Galvanik GmbH",
  tagline: "Meisterbetrieb für Oberflächentechnik",
  street: "Musterstraße 123",
  zip: "12345",
  city: "Musterstadt",
  country: "Deutschland",
  phone: "01234 / 567 89",
  email: "info@kreile.de",
  website: "www.kreile.de",
  iban: "DE12 3456 7890 1234 5678 90",
  bic: "MUSTERBIC123",
  bankName: "Musterbank",
  taxId: "DE123456789",
  logoUrl: "/assets/logo/kreile-wordmark-skyline.svg",
};

export const companySettingsRepository = {
  async getSettings(): Promise<CompanySettings> {
    try {
      if (OfflineManager.isOffline()) {
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("kreile_company_settings");
          if (saved) return JSON.parse(saved);
        }
        return DEFAULT_SETTINGS;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("id", "default")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Supabase companySettingsRepository.getSettings error:", error);
      }

      const settings = data ? {
        id: data.id,
        tenantId: data.tenant_id,
        companyName: data.company_name,
        tagline: data.tagline,
        street: data.street,
        zip: data.zip,
        city: data.city,
        country: data.country,
        phone: data.phone,
        email: data.email,
        website: data.website,
        iban: data.iban,
        bic: data.bic,
        bankName: data.bank_name,
        taxId: data.tax_id,
        logoUrl: data.logo_url
      } : DEFAULT_SETTINGS;

      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_company_settings", JSON.stringify(settings));
      }
      return settings;
    } catch (e) {
      console.error("Failed to load company settings", e);
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("kreile_company_settings");
        if (saved) return JSON.parse(saved);
      }
      return DEFAULT_SETTINGS;
    }
  },

  async updateSettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    if (OfflineManager.isOffline()) {
      throw new Error("Cannot update company settings while offline.");
    }

    const current = await this.getSettings();
    const merged = { ...current, ...settings };

    const dbPayload = {
      id: "default",
      tenant_id: "galvanik-kreile",
      company_name: merged.companyName,
      tagline: merged.tagline,
      street: merged.street,
      zip: merged.zip,
      city: merged.city,
      country: merged.country,
      phone: merged.phone,
      email: merged.email,
      website: merged.website,
      iban: merged.iban,
      bic: merged.bic,
      bank_name: merged.bankName,
      tax_id: merged.taxId,
      logo_url: merged.logoUrl,
      updated_at: new Date().toISOString()
    };

    const supabase = createClient();
    const { error } = await supabase
      .from("company_settings")
      .upsert(dbPayload, { onConflict: "id" });

    if (error) {
      console.error("Supabase companySettingsRepository.updateSettings error:", error.message, error.details, error.hint);
      throw error;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_company_settings", JSON.stringify(merged));
    }
    return merged;
  }
};
