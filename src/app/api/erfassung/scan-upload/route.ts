import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { eq } from "drizzle-orm";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const tenantId = formData.get("tenantId") as string || "galvanik-kreile";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${tenantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
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

    // Trigger Edge Function asynchronously
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/scan-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` // To bypass anon restrictions
      },
      body: JSON.stringify({
        scan_upload_id: newScan.id,
        file_url: publicUrlData.publicUrl,
        mime_type: file.type
      })
    })
    .then(async (res) => {
      if (res.ok) {
        const analysis = await res.json();
        await db.update(scanUploads).set({
          status: "processed",
          detectedType: analysis.detected_type,
          detectionConfidence: analysis.detection_confidence ? analysis.detection_confidence.toString() : null,
          extractedData: analysis.extracted_data
        }).where(eq(scanUploads.id, newScan.id));
      } else {
        await db.update(scanUploads).set({ status: "error" }).where(eq(scanUploads.id, newScan.id));
      }
    })
    .catch(async (e) => {
      console.error("Background edge function error:", e);
      await db.update(scanUploads).set({ status: "error" }).where(eq(scanUploads.id, newScan.id));
    });

    return NextResponse.json({ id: newScan.id });
  } catch (error) {
    console.error("Scan upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
