import { readFileSync } from "node:fs";

export function localReplayStorageEnvironment(databaseUrl: string): Record<string,string> {
  const database=new URL(databaseUrl);
  if(database.hostname!=="127.0.0.1"||database.port!=="54322"||database.pathname!=="/postgres"||database.username!=="postgres")throw new Error("LOCAL_REPLAY_DATABASE_REQUIRED");
  const workflow=readFileSync(".github/workflows/quality.yml","utf8");
  const segment=workflow.slice(workflow.indexOf("- name: BF-006 start app"),workflow.indexOf("- name: BF-006 synthetic local HTTP"));
  const environment:Record<string,string>={};
  for(const key of ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY"]){
    const literal=segment.match(new RegExp(`^\\s*${key}: (.+)$`,"m"))?.[1]?.trim();
    if(!literal||literal.includes("${{"))throw new Error("LOCAL_CI_LITERAL_REQUIRED");
    if(key.includes("KEY")){
      const payload=JSON.parse(Buffer.from(literal.split(".")[1],"base64url").toString("utf8"));
      if(payload.iss!=="supabase-demo"||payload.role!==(key==="SUPABASE_SERVICE_ROLE_KEY"?"service_role":"anon"))throw new Error("LOCAL_DEMO_JWT_REQUIRED");
    }else if(literal!=="http://127.0.0.1:54321")throw new Error("LOCAL_STORAGE_URL_REQUIRED");
    environment[key]=literal;
  }
  return environment;
}

/** Only public demo credentials from the committed local CI fixture, never a secret source. */
export async function withLocalReplayStorage<T>(work: () => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url || url !== process.env.H18_EXPECTED_DATABASE_URL || new URL(url).hostname !== "127.0.0.1"
    || new URL(url).port !== "54322" || process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("LOCAL_REPLAY_STORAGE_FIXTURE_REQUIRED");
  const environment=localReplayStorageEnvironment(url);
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const previous = keys.map(key => process.env[key]);
  try {
    for (const key of keys) {
      process.env[key] = environment[key];
    }
    return await work();
  } finally {
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
}
