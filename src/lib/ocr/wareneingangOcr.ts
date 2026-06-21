import { KlippaProvider } from './KlippaProvider';
import { extractDocumentData, OcrResult } from './geminiOcr';

export async function extractWareneingang(
  base64Image: string,
  supabasePublicUrl?: string
): Promise<OcrResult & { provider: 'klippa' | 'gemini' | 'fallback' }> {

  const hasKlippa = !!process.env.KLIPPA_API_KEY;

  if (hasKlippa && supabasePublicUrl) {
    try {
      const klippa = new KlippaProvider();
      const result = await klippa.extractBeleg(supabasePublicUrl);

      return {
        customerName: result.lieferant ?? undefined,
        articleDescription: result.rohtext ?? undefined,
        rawText: result.rohtext ?? '',
        confidence: result.confidence,
        provider: 'klippa'
      };
    } catch (e) {
      console.warn('Klippa fehlgeschlagen, Fallback auf Gemini:', e);
    }
  }

  const geminiResult = await extractDocumentData(base64Image);
  return { ...geminiResult, provider: hasKlippa ? 'fallback' : 'gemini' };
}
