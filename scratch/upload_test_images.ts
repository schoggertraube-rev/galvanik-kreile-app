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
  const filePath = path.join(process.cwd(), "public", "logo.png");
  if (!fs.existsSync(filePath)) {
    console.error("Source file does not exist at:", filePath);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(filePath);

  console.log("Uploading test/clear_beleg.jpg...");
  const { data: d1, error: e1 } = await supabase.storage
    .from("belege")
    .upload("test/clear_beleg.jpg", fileBuffer, {
      contentType: "image/png",
      upsert: true
    });
  if (e1) console.error("Error upload 1:", e1);
  else console.log("Uploaded 1:", d1);

  console.log("Uploading test/unclear_beleg.jpg...");
  const { data: d2, error: e2 } = await supabase.storage
    .from("belege")
    .upload("test/unclear_beleg.jpg", fileBuffer, {
      contentType: "image/png",
      upsert: true
    });
  if (e2) console.error("Error upload 2:", e2);
  else console.log("Uploaded 2:", d2);
}

upload().catch(console.error);
