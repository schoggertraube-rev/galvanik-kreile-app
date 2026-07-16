import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractDocumentData } from "@/lib/ocr/geminiOcr";
import { resolveAuthorization } from "@/lib/server/authorization";

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SCAN_STORAGE_MISCONFIGURED");
  return createClient(url, key);
}

export async function POST(request: Request) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    auth.data.tenantId !== "galvanik-kreile" ||
    !auth.data.permissions.includes("perm_data_orders")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
    }

    const scanId = randomUUID();
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "bin";
    const storagePath = `${auth.data.tenantId}/${scanId}/original.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const [scan] = await db.insert(scanUploads).values({
      id: scanId,
      tenantId: auth.data.tenantId,
      uploadedBy: auth.data.userId,
      fileUrl: storagePath,
      fileType: file.type,
      status: "uploading",
    }).returning();

    const { error: uploadError } = await storageClient().storage
      .from("scans")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error("Scan storage upload failed", uploadError.message);
      await db.update(scanUploads).set({ status: "error" }).where(and(
        eq(scanUploads.id, scan.id),
        eq(scanUploads.tenantId, auth.data.tenantId),
      ));
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    let update: Partial<typeof scanUploads.$inferInsert> = {
      status: "secured",
    };
    try {
      update = {
        ...update,
        status: "processed",
        extractedData: await extractDocumentData(buffer.toString("base64")),
      };
    } catch (error) {
      console.error("OCR extraction failed", error);
    }
    await db.update(scanUploads).set(update).where(and(
      eq(scanUploads.id, scan.id),
      eq(scanUploads.tenantId, auth.data.tenantId),
    ));

    return NextResponse.json({ id: scan.id });
  } catch (error) {
    console.error("Scan upload error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
