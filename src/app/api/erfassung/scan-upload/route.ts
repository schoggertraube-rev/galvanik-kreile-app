import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractDocumentData } from "@/lib/ocr/geminiOcr";
import { resolveAuthorization } from "@/lib/server/authorization";

function createServiceRoleStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SCAN_UPLOAD_STORAGE_MISCONFIGURED");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: Request) {
  try {
    // Auth is the only tenant source. Client payload fields are ignored.
    const auth = await resolveAuthorization();
    if (!auth.ok) {
      return NextResponse.json({ error: "Sitzung abgelaufen oder nicht angemeldet" }, { status: 401 });
    }

    const tenantId = auth.data.tenantId;
    const userId = auth.data.userId;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const scanId = randomUUID();
    const fileExt = file.name.split(".").pop() ?? "bin";
    const storagePath = `${tenantId}/${scanId}/original.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const originalHash = createHash("sha256").update(buffer).digest("hex");

    const [newScan] = await db.insert(scanUploads).values({
      id: scanId,
      tenantId,
      fileUrl: storagePath,
      fileType: file.type,
      uploadedBy: userId,
      status: "uploading",
    }).returning();

    // Explicit privileged upload path. The app-layer auth/tenant check above is mandatory.
    const supabase = createServiceRoleStorageClient();
    const { error: uploadError } = await supabase.storage
      .from("scans")
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      console.error("Storage upload error:", uploadError.message, uploadError.statusCode, uploadError.status);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    let scanUpdate: Partial<typeof scanUploads.$inferInsert> = {
      status: "secured",
      fileUrl: storagePath,
      fileType: file.type,
      originalHash,
      originalStoragePath: storagePath,
      originalSizeBytes: file.size,
      originalSecuredAt: new Date(),
    };

    try {
      const extraction = await extractDocumentData(buffer.toString("base64"));
      scanUpdate = {
        ...scanUpdate,
        status: "processed",
        extractedData: extraction,
        ocrProvider: "gemini",
      };
    } catch (error) {
      console.error("Local OCR extraction failed:", error);
    }

    await db
      .update(scanUploads)
      .set(scanUpdate)
      .where(and(eq(scanUploads.id, newScan.id), eq(scanUploads.tenantId, tenantId)));

    return NextResponse.json({ id: newScan.id });
  } catch (error) {
    console.error("Scan upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
