import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractDocumentData } from "@/lib/ocr/geminiOcr";
import { resolveAuthorization } from "@/lib/server/authorization";

export async function POST(request: Request) {
  try {
    // 1. Auth vor request.formData()
    const auth = await resolveAuthorization();
    if (!auth.ok) {
      return NextResponse.json({ error: "Sitzung abgelaufen oder nicht angemeldet" }, { status: 401 });
    }

    // Tenant ausschließlich aus der Session — client-seitige Felder werden ignoriert
    const tenantId = auth.data.tenantId;
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 2. Service-Role-Client erst nach Auth und gültiger Datei
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileExt = file.name.split('.').pop();
    const fileName = `${tenantId}/${randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("scans")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      // Storage-/Provider-Rohfehler nicht an Client leaken
      console.error("Storage upload error:", uploadError.message, uploadError.statusCode, uploadError.status);
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
