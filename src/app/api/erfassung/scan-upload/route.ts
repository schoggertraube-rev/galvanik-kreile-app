import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractDocumentData } from "@/lib/ocr/geminiOcr";
import { resolveAuthorization } from "@/lib/server/authorization";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  return supabaseClient;
}

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthorization();
    if (!auth.ok) {
      return NextResponse.json({ error: "Sitzung abgelaufen oder nicht angemeldet" }, { status: 401 });
    }

    const tenantId = auth.data.tenantId;
    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const file = fileEntry;
    const supabase = getSupabaseClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `${tenantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("scans")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("scans").getPublicUrl(fileName);

    const [newScan] = await db.insert(scanUploads).values({
      tenantId,
      fileUrl: publicUrlData.publicUrl,
      fileType: file.type,
      status: "analyzing"
    }).returning();

    // Convert file to Base64 for Gemini
    const buffer = await file.arrayBuffer();
    const base64Str = Buffer.from(buffer).toString('base64');
    
    // Process synchronously to ensure it completes before Vercel freezes the function
    try {
      const extraction = await extractDocumentData(base64Str);
      await db.update(scanUploads).set({
        status: "processed",
        detectedType: "Lieferschein", // default
        detectionConfidence: "0.9",
        extractedData: extraction
      }).where(and(eq(scanUploads.id, newScan.id), eq(scanUploads.tenantId, tenantId)));
    } catch (e) {
      console.error("Local OCR extraction failed:", e);
      await db.update(scanUploads).set({ status: "error" }).where(and(eq(scanUploads.id, newScan.id), eq(scanUploads.tenantId, tenantId)));
    }

    return NextResponse.json({ id: newScan.id });
  } catch (error) {
    console.error("Scan upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
