import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractDocumentData } from "@/lib/ocr/geminiOcr";
import { checkAppAuthorization } from "@/lib/server/authHelper";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

export async function POST(request: Request) {
  // Authorize before any storage or DB access. Never trust client input for tenant.
  const auth = await checkAppAuthorization("write");
  if (!auth.ok) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const tenantId = auth.data.tenantId;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }

    const fileExt = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "");
    // Storage path is built only from the server-canonical tenant and a random UUID.
    const fileName = `${tenantId}/${Date.now()}-${randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("scans")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    // 'scans' is a private bucket. Store the internal storage path (not a public
    // URL); signed URLs are minted server-side on read when needed.
    const [newScan] = await db.insert(scanUploads).values({
      tenantId,
      fileUrl: fileName,
      fileType: file.type,
      status: "analyzing"
    }).returning();

    // OCR reads the file bytes directly (no URL needed).
    const buffer = await file.arrayBuffer();
    const base64Str = Buffer.from(buffer).toString("base64");

    try {
      const extraction = await extractDocumentData(base64Str);
      await db.update(scanUploads).set({
        status: "processed",
        detectedType: "Lieferschein",
        detectionConfidence: "0.9",
        extractedData: extraction
      }).where(eq(scanUploads.id, newScan.id));
    } catch (e) {
      console.error("Local OCR extraction failed:", e);
      await db.update(scanUploads).set({ status: "error" }).where(eq(scanUploads.id, newScan.id));
    }

    return NextResponse.json({ id: newScan.id });
  } catch (error) {
    console.error("Scan upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
