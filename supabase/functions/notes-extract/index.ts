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

    const systemPrompt = `Extrahiere aus dieser Telefonnotiz strukturierte Auftragsdaten und Verhaltenshinweise.
Antworte ausschließlich im JSON Format nach folgendem Schema:
{
  "customer": {
    "name": "string oder null",
    "companyName": "string oder null",
    "phone": "string oder null",
    "email": "string oder null",
    "city": "string oder null"
  },
  "items": [
    {
      "name": "string",
      "material": "string oder null",
      "surfaceRequested": "string oder null",
      "quantity": number
    }
  ],
  "order": {
    "title": "Kurztitel der Anfrage",
    "priority": "normal oder express"
  },
  "behaviorNote": {
    "text": "Besondere Vorlieben, Verhaltensweisen des Kunden (z.B. ruft immer morgens an, will nur Email, immer ungeduldig) oder null"
  },
  "followUp": {
    "type": "callback | mail | quote | none",
    "dueAtText": "Terminwunsch/Rückruf-Wunsch (Text) oder null"
  }
}

Telefonnotiz:
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
