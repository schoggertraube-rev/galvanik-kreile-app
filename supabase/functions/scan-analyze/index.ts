import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"
import { corsHeaders, handleCors, requireServiceRole } from "../_shared/security.ts"
import { loadStorageFile, validateBase64 } from "../_shared/storageFetch.ts"

serve(async (req) => {
  const cors = corsHeaders(req)
  const preflight = handleCors(req)
  if (preflight) return preflight
  const unauthorized = requireServiceRole(req)
  if (unauthorized) return unauthorized

  try {
    const { scan_upload_id, file_url, base64_data, mime_type } = await req.json()

    if (!file_url && !base64_data) {
      throw new Error("Missing 'file_url' or 'base64_data' in request body.")
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable.")
    }

    let b64 = base64_data;
    let mime = mime_type || "image/jpeg";

    if (file_url && !b64) {
      const file = await loadStorageFile(file_url)
      b64 = encode(file.bytes)
      mime = file.mime
    } else if (b64) {
      validateBase64(b64, mime)
    }

    const systemPrompt = `Du bist ein OCR und Erkennungssystem für eine Galvanik. Analysiere das Dokument/Bild.
Schritt 1: Bestimme den Typ (lieferschein, visitenkarte, beleg, etikett, qr, teil, unbekannt).
Schritt 2: Extrahiere strukturierte Daten basierend auf dem Typ.

Antworte ausschließlich im JSON Format nach folgendem Schema:
{
  "detected_type": "lieferschein | visitenkarte | beleg | etikett | qr | teil | unbekannt",
  "detection_confidence": 0.0 bis 1.0,
  "extracted_data": {
    "customer": {
      "name": "string oder null",
      "companyName": "string oder null",
      "address": "string oder null",
      "phone": "string oder null",
      "email": "string oder null"
    },
    "items": [
      {
        "name": "string",
        "quantity": number,
        "material": "string oder null",
        "surfaceRequested": "string oder null"
      }
    ],
    "order": {
      "orderNumber": "Fremde Auftragsnummer oder null",
      "title": "Titel aus Dokument oder null"
    }
  }
}`

    const payload: any = {
      contents: [
        { 
          role: "user", 
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: mime === "application/pdf" ? "application/pdf" : mime,
                data: b64
              }
            }
          ] 
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} ${errorText}`)
    }

    const aiData = await response.json()
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!content) {
      throw new Error("No content returned from Gemini")
    }

    let result
    try {
      result = JSON.parse(content);
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
         result = JSON.parse(match[0]);
      } else {
         throw new Error("AI returned invalid JSON format")
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...cors, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
