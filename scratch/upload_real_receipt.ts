import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASEUrl or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function upload() {
  const filePath = path.join(process.cwd(), "public", "real_receipt.png");
  if (!fs.existsSync(filePath)) {
    console.error("Source file does not exist at:", filePath);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(filePath);

  console.log("Uploading test/real_receipt.png...");
  const { data, error } = await supabase.storage
    .from("belege")
    .upload("test/real_receipt.png", fileBuffer, {
      contentType: "image/png",
      upsert: true
    });
  if (error) {
    console.error("Error uploading real receipt:", error);
    process.exit(1);
  } else {
    console.log("Uploaded successfully:", data);
    process.exit(0);
  }
}

upload().catch(console.error);
