import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const tenantId = formData.get("tenantId") as string || "galvanik-kreile";
    const itemId = formData.get("itemId") as string || `temp_${Date.now()}`;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${tenantId}/${itemId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
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
      console.error("Edge function analysis failed:", await analysisRes.text());
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
