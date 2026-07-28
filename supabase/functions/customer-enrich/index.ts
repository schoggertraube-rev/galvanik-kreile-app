import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, company_name, city } = await req.json()

    if (!name && !company_name) {
      throw new Error("Missing 'name' or 'company_name' in request body.")
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable.")
    }

    const systemPrompt = `Du bist ein Recherche-Assistent. Finde öffentliche Kontaktdaten für folgende Firma/Person:
Firma/Person: ${company_name || name}
Name: ${name || ""}
Stadt: ${city || "Unbekannt"}

Antworte ausschließlich im JSON Format nach folgendem Schema, ohne Markdown Code-Blöcke:
{
  "email": "gefundene email oder null",
  "phone": "gefundene telefonnummer oder null",
  "address": "gefundene adresse oder null",
  "website": "gefundene website oder null",
  "confidence": 0.0 bis 1.0 (wie sicher bist du, dass dies die korrekte Firma ist?)
}`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] }
        ],
        tools: [
          { googleSearch: {} }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} ${errorText}`)
    }

    const aiData = await response.json()
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!content) {
      throw new Error("No text content returned from Gemini")
    }

    let result
    try {
      result = JSON.parse(content);
    } catch {
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
