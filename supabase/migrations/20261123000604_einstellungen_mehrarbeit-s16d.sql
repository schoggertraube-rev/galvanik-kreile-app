ALTER TABLE public.company_settings
  ADD COLUMN mehrarbeit_spielraum_basispunkte integer NOT NULL DEFAULT 1000,
  ADD COLUMN mehrarbeit_stopp_basispunkte integer NOT NULL DEFAULT 3000,
  ADD COLUMN mehrarbeit_schritt_minuten integer NOT NULL DEFAULT 5,
  ADD COLUMN mehrarbeit_max_minuten_je_taetigkeit integer NOT NULL DEFAULT 120,
  ADD CONSTRAINT company_settings_mehrarbeit_rahmen_chk CHECK (
    mehrarbeit_spielraum_basispunkte >= 0
    AND mehrarbeit_stopp_basispunkte > mehrarbeit_spielraum_basispunkte
    AND mehrarbeit_stopp_basispunkte <= 10000
  ),
  ADD CONSTRAINT company_settings_mehrarbeit_dauer_chk CHECK (
    mehrarbeit_schritt_minuten > 0 AND mehrarbeit_max_minuten_je_taetigkeit >= mehrarbeit_schritt_minuten
    AND mehrarbeit_max_minuten_je_taetigkeit % NULLIF(mehrarbeit_schritt_minuten, 0) = 0
  );

-- Derselbe Vorlagenstandard gilt für Bestandsmandanten und künftige Firmendatensätze.
CREATE FUNCTION private.s16d_mehrarbeit_mailstandard()
RETURNS TABLE (name text, betreff text, html text, nachricht text, variablen jsonb)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT 'Mehrarbeit · Freigabe',
  'Mehrarbeit zu Ihrem Auftrag {Auftragsnummer}: Freigabe über {Betrag}',
  '<p>Guten Tag, bei Ihrem Auftrag {Auftragsnummer} ist Mehrarbeit angefallen: {Begründung}</p><p>Der Aufwand beträgt {Betrag}. Bisher sind {Grenze} freigegeben. Bitte teilen Sie uns mit, ob Sie den Aufwand freigeben, beim bisherigen Rahmen bleiben oder die Mehrarbeit abbrechen möchten.</p><p>Freundliche Grüße<br>{Absender}</p>',
  E'Guten Tag, bei Ihrem Auftrag {Auftragsnummer} ist Mehrarbeit angefallen: {Begründung}\n\nDer Aufwand beträgt {Betrag}. Bisher sind {Grenze} freigegeben. Bitte teilen Sie uns mit, ob Sie den Aufwand freigeben, beim bisherigen Rahmen bleiben oder die Mehrarbeit abbrechen möchten.\n\nFreundliche Grüße\n{Absender}',
  '["Auftragsnummer","Betrag","Grenze","Begründung","Absender"]'::jsonb
$$;

INSERT INTO public.email_templates (tenant_id,template_key,name,subject_template,
  body_html_template,body_text_template,variables)
SELECT mandant.tenant_id,mandant.tenant_id||':mehrarbeit_freigabe',vorlage.*
FROM (SELECT DISTINCT tenant_id FROM public.company_settings) mandant
CROSS JOIN private.s16d_mehrarbeit_mailstandard() vorlage
ON CONFLICT (template_key) DO NOTHING;

CREATE FUNCTION private.s16d_mehrarbeit_vorlage_bei_firmenanlage()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.email_templates (tenant_id,template_key,name,subject_template,
    body_html_template,body_text_template,variables)
  SELECT NEW.tenant_id,NEW.tenant_id||':mehrarbeit_freigabe',vorlage.*
  FROM private.s16d_mehrarbeit_mailstandard() vorlage
  ON CONFLICT (template_key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER company_settings_mehrarbeit_vorlage
AFTER INSERT ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION private.s16d_mehrarbeit_vorlage_bei_firmenanlage();
