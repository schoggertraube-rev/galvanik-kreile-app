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
  emailGreeting: string;
  emailPickupInfo: string;
  emailPaymentInfo: string;
  emailAgbText: string;
  emailFooter: string;
  emailAdditionalNotes: string;
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
  emailGreeting: "Sehr geehrte Damen und Herren,",
  emailPickupInfo: "Ihr Auftrag ist fertig und kann abgeholt werden.",
  emailPaymentInfo: "Bitte ueberweisen Sie den Rechnungsbetrag unter Angabe der Auftragsnummer.",
  emailAgbText: "",
  emailFooter: "Mit freundlichen Gruessen, Ihr Team von Galvanik Kreile",
  emailAdditionalNotes: "",
};

// This browser repository returns realistic-looking placeholder company and
// banking data on failure. That must never become a product-facing truth.
function isCompanySettingsContractEnabled(): boolean {
  return false;
}

export const companySettingsRepository = {
  async getSettings(): Promise<CompanySettings> {
    if (!isCompanySettingsContractEnabled()) {
      throw new Error("NOT_CONFIGURED: Firmeneinstellungen sind bis zum geprüften Fundamentvertrag nicht verfügbar.");
    }
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
        logoUrl: data.logo_url,
        emailGreeting: data.email_greeting,
        emailPickupInfo: data.email_pickup_info,
        emailPaymentInfo: data.email_payment_info,
        emailAgbText: data.email_agb_text,
        emailFooter: data.email_footer,
        emailAdditionalNotes: data.email_additional_notes
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
    if (!isCompanySettingsContractEnabled()) {
      throw new Error("NOT_CONFIGURED: Firmeneinstellungen sind bis zum geprüften Fundamentvertrag nicht verfügbar.");
    }
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
      email_greeting: merged.emailGreeting,
      email_pickup_info: merged.emailPickupInfo,
      email_payment_info: merged.emailPaymentInfo,
      email_agb_text: merged.emailAgbText,
      email_footer: merged.emailFooter,
      email_additional_notes: merged.emailAdditionalNotes,
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
