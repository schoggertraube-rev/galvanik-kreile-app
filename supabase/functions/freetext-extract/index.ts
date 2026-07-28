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
    const { text } = await req.json()

    if (!text) {
      throw new Error("Missing 'text' in request body.")
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable.")
    }

    const systemPrompt = `Extrahiere Auftragsdaten aus dem folgenden Freitext. 
Antworte ausschließlich im JSON Format nach folgendem Schema, ohne Markdown Code-Blöcke:
{
  "customer": {
    "name": "string oder null",
    "companyName": "string oder null",
    "email": "string oder null",
    "phone": "string oder null",
    "address": "string oder null",
    "city": "string oder null"
  },
  "items": [
    {
      "name": "string (z.B. Stoßstange)",
      "material": "string (z.B. Stahl)",
      "surfaceRequested": "string (z.B. Verchromen)",
      "quantity": number,
      "conditionNote": "string oder null"
    }
  ],
  "order": {
    "title": "Kurztitel für den Auftrag (z.B. 'Stoßstange verchromen')",
    "priority": "normal oder express",
    "promisedDueDateText": "Terminwunsch als Text oder null"
  },
  "behaviorNote": {
    "text": "Besondere Vorlieben, Verhaltensweisen des Kunden oder null"
  }
}

Freitext:
${text}`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] }
        ],
        generationConfig: {
          temperature: 0.1,
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
