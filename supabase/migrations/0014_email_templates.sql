-- Email Templates Migration

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS email_greeting text DEFAULT 'Sehr geehrte Damen und Herren,',
  ADD COLUMN IF NOT EXISTS email_pickup_info text DEFAULT 'Ihr Auftrag ist fertig und kann abgeholt werden.',
  ADD COLUMN IF NOT EXISTS email_payment_info text DEFAULT 'Bitte ueberweisen Sie den Rechnungsbetrag unter Angabe der Auftragsnummer.',
  ADD COLUMN IF NOT EXISTS email_agb_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_footer text DEFAULT 'Mit freundlichen Gruessen, Ihr Team von Galvanik Kreile',
  ADD COLUMN IF NOT EXISTS email_additional_notes text DEFAULT ''
