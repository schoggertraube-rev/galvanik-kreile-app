import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  bindItemPhotoUpload,
  markItemPhotoUncertain,
  reserveItemPhotoJob,
  validateItemPhoto,
} from "@/lib/server/itemPhotoJobs";

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ITEM_PHOTO_STORAGE_MISCONFIGURED");
  return { url: url.replace(/\/$/, ""), key, client: createClient(url, key) };
}

async function signedPreview(
  client: SupabaseClient<any, "public", "public", any, any>,
  storagePath: string,
): Promise<string> {
  const { data, error } = await client.storage.from("item-photos").createSignedUrl(storagePath, 5 * 60);
  if (error || !data?.signedUrl) throw new Error("ITEM_PHOTO_PREVIEW_UNAVAILABLE");
  return data.signedUrl;
}

export async function POST(request: Request) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    auth.data.tenantId !== "galvanik-kreile" ||
    !auth.data.permissions.includes("perm_op_photos")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request" }, { status: 400 });
  }
  const keys = [...formData.keys()];
  const fileValues = formData.getAll("file");
  const itemValues = formData.getAll("itemId");
  if (
    keys.some((key) => key !== "file" && key !== "itemId") ||
    fileValues.length !== 1 || itemValues.length !== 1 ||
    !(fileValues[0] instanceof File) ||
    typeof itemValues[0] !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(itemValues[0])
  ) {
    return NextResponse.json({ error: "A single file and itemId are required" }, { status: 400 });
  }
  const file = fileValues[0];
  const itemId = itemValues[0];

  const [ownedItem] = await db.select({ id: items.id, orderId: items.orderId })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.tenantId, auth.data.tenantId)))
    .limit(1);
  if (!ownedItem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let photo;
  try {
    photo = await validateItemPhoto(file);
  } catch {
    return NextResponse.json({ error: "Unsupported or invalid image" }, { status: 415 });
  }

  try {
    const service = serviceClient();
    const proposedJobId = randomUUID();
    const proposedStoragePath = `${auth.data.tenantId}/${ownedItem.orderId}/${ownedItem.id}/${proposedJobId}.${photo.extension}`;
    const admission = await reserveItemPhotoJob({
      client: service.client,
      request,
      proposedJobId,
      tenantId: auth.data.tenantId,
      userId: auth.data.userId,
      orderId: ownedItem.orderId,
      itemId: ownedItem.id,
      photo,
      proposedStoragePath,
    });
    if (admission.kind === "rejected") {
      return NextResponse.json({ error: admission.terminal ? "Item photo already exists or limit reached" : "Item photo quota reached" }, {
        status: admission.terminal ? 409 : 429,
        headers: admission.retryAfterSeconds > 0 ? { "Retry-After": String(admission.retryAfterSeconds) } : undefined,
      });
    }
    if (admission.kind === "replay") {
      const previewUrl = await signedPreview(service.client, admission.storagePath);
      return NextResponse.json({
        jobId: admission.jobId,
        storagePath: admission.storagePath,
        previewUrl,
        analysis: admission.result,
        replayed: true,
      }, { headers: { "Cache-Control": "no-store", "X-Item-Photo-Replay": "1" } });
    }

    if (admission.uploadRequired) {
      const { error: uploadError } = await service.client.storage
        .from("item-photos")
        .upload(admission.storagePath, photo.bytes, { contentType: photo.mimeType, upsert: false });
      if (uploadError) {
        await markItemPhotoUncertain(service.client, admission.jobId, auth.data.tenantId, auth.data.userId, "storage-upload-uncertain");
        return NextResponse.json({ error: "Photo storage unavailable" }, { status: 503 });
      }
      try {
        await bindItemPhotoUpload(service.client, admission.jobId, auth.data.tenantId, auth.data.userId);
      } catch {
        await markItemPhotoUncertain(service.client, admission.jobId, auth.data.tenantId, auth.data.userId, "storage-bind-failed");
        return NextResponse.json({ error: "Photo accounting unavailable" }, { status: 503 });
      }
    }

    const analysisResponse = await fetch(`${service.url}/functions/v1/item-photo-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${service.key}`,
      },
      body: JSON.stringify({ jobId: admission.jobId }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const responseText = await analysisResponse.text();
    if (responseText.length > 262_144) throw new Error("ITEM_PHOTO_ANALYSIS_TOO_LARGE");
    let analysis: unknown;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      throw new Error("ITEM_PHOTO_ANALYSIS_INVALID");
    }
    if (!analysisResponse.ok || !analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
      return NextResponse.json({ error: "Photo analysis unavailable" }, { status: 503 });
    }
    const previewUrl = await signedPreview(service.client, admission.storagePath);
    return NextResponse.json({
      jobId: admission.jobId,
      storagePath: admission.storagePath,
      previewUrl,
      analysis,
      replayed: false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ITEM_PHOTO_ERROR";
    if (code === "INVALID_IDEMPOTENCY_KEY") {
      return NextResponse.json({ error: "Invalid idempotency key" }, { status: 400 });
    }
    console.error("Item photo workflow unavailable", code);
    return NextResponse.json({ error: "Item photo service temporarily unavailable" }, { status: 503 });
  }
}
