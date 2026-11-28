// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, nativeFetch, sql, withSession } from '../../e2e/ablauf/replayHarness';
import { finishIntakeFileAction, getIntakeCaptureAction, prepareIntakeFileAction } from '@/app/actions/eingang.actions';
import { createAdminClient } from '@/lib/supabase/admin';

it('speichert ausschließlich ausdrücklich gelesene Geldfelder am gesicherten Dokument', async () => {
  await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',true)`;
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,lager_regelversion,ki_sicherheitsschwelle)
    VALUES (${randomUUID()},${tenant},'TEST I3 Geldfelder',0,'TEST-I3',0.95)`;
  const anker = [
    ['Skonto %', '2 %', 'zahlung.skonto_prozent'],
    ['Skonto bis', '30.11.2026', 'zahlung.skonto_bis'],
    ['Fällig am', '04.12.2026', 'zahlung.faellig_am'],
    ['IBAN', 'TEST-IBAN', 'zahlung.iban'],
    ['Zahlungsbedingungen', 'TEST innerhalb 14 Tagen', 'zahlung.bedingungen'],
    ['Avisbetrag', '123,45 EUR', 'avis.betrag'],
    ['Avisdatum', '26.11.2026', 'avis.datum'],
    ['Avisreferenz', 'TEST-AVIS', 'avis.referenz'],
    ['Quittungsdatum', '25.11.2026', 'quittung.datum'],
    ['Quittungsaussteller', 'TEST Beleg GmbH', 'quittung.aussteller'],
    ['Quittungsbetrag', '98,76 EUR', 'quittung.betrag'],
    ['Bewirtungsanlass', 'TEST Werkstattgespräch', 'quittung.zweck'],
    ['Bewirtungsteilnehmer', 'TEST A, TEST B', 'quittung.teilnehmer'],
  ];
  const origin = 'https://i3-geld.example.invalid';
  const rohdaten = JSON.stringify({ status: 'succeeded', analyzeResult: {
    modelId: 'prebuilt-layout', content: 'TEST Freitext: Avisbetrag 999,00 EUR', pages: [{ pageNumber: 1 }],
    keyValuePairs: anker.map(([label,value]) => ({ key: { content: label }, value: { content: value }, confidence: 0.9 })),
  } });
  vi.stubEnv('AZURE_DOCINTEL_ENDPOINT', origin);
  vi.stubEnv('AZURE_DOCINTEL_KEY', 'TEST-I3-Anbietergrenze');
  const provider = vi.spyOn(globalThis,'fetch').mockImplementation(async (input,init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== origin) return nativeFetch(input,init);
    if (init?.method === 'POST') return new Response(null,{ status: 202, headers: {
      'operation-location': origin + '/documentintelligence/documentModels/prebuilt-layout/analyzeResults/TEST-GELD',
    } });
    return new Response(rohdaten);
  });
  try {
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=','base64');
    const itemId = randomUUID(), fileId = randomUUID(), sha256 = createHash('sha256').update(bytes).digest('hex');
    const upload = await withSession(full,() => prepareIntakeFileAction({itemId,fileId,name:'TEST_I3_Geld.png',mime:'image/png',bytes:bytes.length,sha256}));
    if (upload.code !== 'OK' || !upload.upload) throw Error('TEST_I3_GELD_UPLOAD');
    const storage = createAdminClient().storage.from(upload.upload.bucket);
    expect((await storage.uploadToSignedUrl(upload.upload.path,upload.upload.token,bytes,{contentType:'image/png'})).error).toBeNull();
    expect(await withSession(full,() => finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});

    const [quelle] = await sql`SELECT erkennung_roh_pfad AS pfad FROM public.intake_file WHERE tenant_id=${tenant} AND id=${fileId}::uuid`;
    const raw = await storage.download(quelle.pfad);
    expect(raw.error).toBeNull();
    expect(await raw.data?.text()).toBe(rohdaten);
    const gespeichert = await sql`SELECT feld,wert,fundstelle FROM public.intake_suggestion
      WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND split_part(feld,'.',1) IN ('zahlung','avis','quittung') AND status='offen'`;
    expect(gespeichert).toHaveLength(anker.length);
    expect(gespeichert).toEqual(expect.arrayContaining(anker.map(([,wert,feld]) => ({feld,wert,fundstelle:expect.objectContaining({page:1})}))));
    const antwort = await withSession(full,() => getIntakeCaptureAction(itemId));
    if (antwort.code !== 'OK') throw Error('TEST_I3_GELD_LESEN');
    expect(antwort.capture.suggestions?.filter(({field}) => /^(zahlung|avis|quittung)\./u.test(field))).toEqual([]);
  } finally {
    provider.mockRestore();
    vi.unstubAllEnvs();
  }
});
