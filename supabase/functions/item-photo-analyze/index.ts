import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_url, base64_data, mime_type } = await req.json()

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
      const fileRes = await fetch(file_url);
      if (!fileRes.ok) throw new Error("Failed to fetch file from file_url");
      const arrayBuffer = await fileRes.arrayBuffer();
      b64 = encode(arrayBuffer);
      mime = fileRes.headers.get("content-type") || mime;
    }

    const systemPrompt = `Analysiere das folgende Foto eines Teils für eine Galvanik.
Erkenne das Grundmaterial, sichtbare Schäden (z.B. Pittings, Kratzer, Rost) und Maßangaben (falls ein Lineal sichtbar ist).

Antworte ausschließlich im JSON Format nach folgendem Schema:
{
  "material": "Gefundenes Material (z.B. Messing, Zinkdruckguss, Stahl) oder null",
  "schaeden": "Beschreibung der Schäden oder null",
  "masse": "Gefundene Maßangaben oder null",
  "confidence": 0.0 bis 1.0
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
