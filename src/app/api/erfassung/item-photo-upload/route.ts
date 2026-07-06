import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthorization } from "@/lib/server/authorization";

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Item photo upload proxy misconfigured:", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthorization();
    if (!auth.ok) {
      return NextResponse.json(
        { error: "Sitzung abgelaufen oder nicht angemeldet" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    const tenantId = auth.data.tenantId;
    const itemIdValue = formData.get("itemId");
    const itemId =
      typeof itemIdValue === "string" && itemIdValue.length > 0
        ? itemIdValue
        : `temp_${Date.now()}`;
    const file = fileValue;
    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `${tenantId}/${itemId}/${randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      const storageError = uploadError as {
        message: string;
        details?: string;
        hint?: string;
      };
      console.error("Storage upload error:", {
        message: storageError.message,
        details: storageError.details,
        hint: storageError.hint,
      });
      return NextResponse.json({ error: "Failed to upload item photo" }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("item-photos").getPublicUrl(fileName);

    // Call item-photo-analyze Edge Function asynchronously and let the client fetch or we wait here.
    // Spec: "Gemini Vision bei Teile-Foto (optional, nicht blockierend)"
    // We will wait for it so we can return the hints directly to the UI for immediate display.
    const analysisRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/item-photo-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        file_url: publicUrlData.publicUrl,
        mime_type: file.type
      })
    });

    let analysis = null;
    if (analysisRes.ok) {
      analysis = await analysisRes.json();
    } else {
      console.error("Edge function analysis failed:", {
        status: analysisRes.status,
        statusText: analysisRes.statusText,
      });
    }

    return NextResponse.json({ 
      url: publicUrlData.publicUrl,
      analysis
    });

  } catch (error) {
    console.error("Item photo upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
