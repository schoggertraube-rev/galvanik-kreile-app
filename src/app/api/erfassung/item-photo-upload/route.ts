import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { checkAppAuthorization } from "@/lib/server/authHelper";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const SIGNED_URL_TTL_SECONDS = 300;

export async function POST(request: Request) {
  // Authorize before any storage access. Never trust client input for tenant.
  const auth = await checkAppAuthorization("write");
  if (!auth.ok) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const tenantId = auth.data.tenantId;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const rawItemId = formData.get("itemId") as string | null;
    const itemId = rawItemId && /^[a-zA-Z0-9_-]+$/.test(rawItemId) ? rawItemId : `temp_${randomUUID()}`;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }

    const fileExt = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "");
    // Path built only from server-canonical tenant, validated itemId and a UUID.
    const fileName = `${tenantId}/${itemId}/${Date.now()}-${randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload item photo" }, { status: 500 });
    }

    // 'item-photos' is private. Mint a short-lived signed URL for the analyzer
    // and the UI; never expose the internal storage path to the client.
    const { data: signed, error: signErr } = await supabase.storage
      .from("item-photos")
      .createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);

    if (signErr || !signed) {
      console.error("Signed URL error:", signErr);
      return NextResponse.json({ error: "Failed to sign file url" }, { status: 500 });
    }

    let analysis = null;
    const analysisRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/item-photo-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        file_url: signed.signedUrl,
        mime_type: file.type
      })
    });

    if (analysisRes.ok) {
      analysis = await analysisRes.json();
    } else {
      console.error("Edge function analysis failed:", await analysisRes.text());
    }

    return NextResponse.json({
      url: signed.signedUrl,
      analysis
    });
  } catch (error) {
    console.error("Item photo upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
