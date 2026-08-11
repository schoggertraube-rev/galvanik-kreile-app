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

export const companySettingsRepository = {
  async getSettings(): Promise<CompanySettings> {
    throw new Error("NOT_AVAILABLE: Firmendaten-Anzeige benötigt einen tenant- und capability-geprüften W3-Read-Vertrag.");
  },

  async updateSettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    void settings;
    throw new Error("NOT_AVAILABLE: Sichere Firmendatenänderung benötigt den W3-Command-Vertrag.");
  },
};
