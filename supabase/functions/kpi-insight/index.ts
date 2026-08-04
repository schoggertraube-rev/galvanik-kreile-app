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
    const { kachel, daten } = await req.json()

    if (!kachel || !daten) {
      throw new Error("Missing 'kachel' or 'daten' in request body.")
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable.")
    }

    const systemPrompt = `Du bist Betriebsberater für einen Galvanik-Meisterbetrieb. Antworte auf Deutsch, maximal 3 Sätze: 1 Beobachtung, 1 Achtung-Hinweis (optional), 1 konkrete Empfehlung. Keine Fachbegriffe, die ein Handwerksmeister ohne PC-Kenntnisse nicht versteht. Keine erfundenen Zahlen — nur die übergebenen Werte verwenden. Bitte antworte im strengen JSON-Format mit den Schlüsseln: "beobachtung", "achtung" (optional), und "empfehlung".`
    
    const prompt = `Analysiere folgende Daten für den Bereich "${kachel}":\n${JSON.stringify(daten, null, 2)}`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n\n" + prompt }] }
        ],
        generationConfig: {
          temperature: 0.3,
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
