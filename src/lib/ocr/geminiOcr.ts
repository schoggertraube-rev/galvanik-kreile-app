export interface OcrResult {
  customerName?: string;
  company?: string;
  address?: string;
  phone?: string;
  email?: string;
  articleDescription?: string;
  material?: string;
  surface?: string;
  quantity?: number;
  notes?: string;
  rawText: string;
}

export async function extractDocumentData(imageBase64: string): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    console.warn("OCR fehlgeschlagen: GOOGLE_AI_API_KEY is missing");
    return { rawText: "OCR fehlgeschlagen" };
  }

  // Strip the data URI prefix if present
  const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const payload = {
    system_instruction: {
      parts: [
        { text: "Du bist ein OCR-Assistent fuer eine Galvanik-Werkstatt. Extrahiere aus diesem Dokument/Foto: Kundenname, Firma, Adresse, Telefon, E-Mail, Artikelbeschreibung, Material, Oberflaeche, Stueckzahl, Sonderhinweise. Antworte NUR als JSON ohne Markdown-Backticks." }
      ]
    },
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data
            }
          }
        ]
      }
    ]
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Gemini API Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      return { rawText: "OCR fehlgeschlagen" };
    }

    const data = await response.json();
    const rawTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawTextResponse) {
      return { rawText: "OCR fehlgeschlagen" };
    }

    const cleanedJsonText = rawTextResponse.replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(cleanedJsonText);

    return {
      customerName: parsedData.Kundenname || parsedData.customerName,
      company: parsedData.Firma || parsedData.company,
      address: parsedData.Adresse || parsedData.address,
      phone: parsedData.Telefon || parsedData.phone,
      email: parsedData.Email || parsedData.email || parsedData['E-Mail'],
      articleDescription: parsedData.Artikelbeschreibung || parsedData.articleDescription,
      material: parsedData.Material || parsedData.material,
      surface: parsedData.Oberflaeche || parsedData.surface || parsedData.Oberfläche,
      quantity: parsedData.Stueckzahl ? Number(parsedData.Stueckzahl) : (parsedData.quantity ? Number(parsedData.quantity) : undefined),
      notes: parsedData.Sonderhinweise || parsedData.notes,
      rawText: rawTextResponse
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Gemini OCR Request failed:", error);
    return { rawText: "OCR fehlgeschlagen" };
  }
}
