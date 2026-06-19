import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASEUrl or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Checking buckets...");
  const { data: buckets, error: getError } = await supabase.storage.listBuckets();
  if (getError) {
    console.error("Error listing buckets:", getError);
    process.exit(1);
  }

  console.log("Existing buckets:", buckets.map(b => b.name));

  const hasBelege = buckets.some(b => b.name === "belege");
  if (!hasBelege) {
    console.log("Creating bucket 'belege'...");
    const { data, error } = await supabase.storage.createBucket("belege", {
      public: true,
      allowedMimeTypes: ["image/png", "image/jpeg", "application/pdf"],
      fileSizeLimit: 5242880 // 5MB
    });
    if (error) {
      console.error("Error creating bucket:", error);
    } else {
      console.log("Bucket created successfully:", data);
    }
  } else {
    console.log("Bucket 'belege' already exists.");
  }
}

run().catch(console.error);
