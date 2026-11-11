import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH = "quality/authoritative-sources.json";
const TRUTH_SOURCE_CONTRACT = Object.freeze({ project_rules: "AGENTS.md" });
export function checkAuthorityHashPins({ checkerBytes, schemaBytes, workflowText }) {
  const errors = [];
  const checkerPin = workflowText.match(/AUTHORITY_CHECKER_SHA256:\s*["']([0-9a-f]{64})["']/i)?.[1];
  const schemaPin = workflowText.match(/AUTHORITY_SCHEMA_SHA256:\s*["']([0-9a-f]{64})["']/i)?.[1];
  if (!checkerPin) errors.push("AUTHORITY_CHECKER_PIN_MISSING");
  if (!schemaPin) errors.push("AUTHORITY_SCHEMA_PIN_MISSING");
  const checkerHash = createHash("sha256").update(checkerBytes).digest("hex");
  const schemaHash = createHash("sha256").update(schemaBytes).digest("hex");
  if (checkerPin && checkerPin.toLowerCase() !== checkerHash) errors.push(`AUTHORITY_CHECKER_PIN_MISMATCH:${checkerHash}`);
  if (schemaPin && schemaPin.toLowerCase() !== schemaHash) errors.push(`AUTHORITY_SCHEMA_PIN_MISMATCH:${schemaHash}`);
  return errors;
}


function configurationErrors(config) {
 const errors=[];
 if(!config || typeof config!=="object" || Array.isArray(config))return ["AUTHORITY_CONFIG_NOT_OBJECT"];
 if(Object.keys(config).sort().join(",")!=="schemaVersion,truthTypes")errors.push("AUTHORITY_CONFIG_CLOSED_SCHEMA");
 if(config.schemaVersion!==5)errors.push("AUTHORITY_CONFIG_SCHEMA_VERSION");
 const entries=Array.isArray(config.truthTypes)?config.truthTypes:[];
 if(entries.length!==1)errors.push("TRUTH_TYPE_TOTAL");
 for(const entry of entries)if(!entry || Object.keys(entry).sort().join(",")!=="id,source" || TRUTH_SOURCE_CONTRACT[entry.id]!==entry.source)errors.push("TRUTH_SOURCE_CONTRACT");
 if(entries.filter(entry=>entry?.id==="project_rules").length!==1)errors.push("TRUTH_TYPE_COUNT:project_rules");
 return errors;
}
function trackedSteeringErrors(files){return files.filter(file=>file==="_review" || file.startsWith("_review/") || file.includes("/_review/")).map(file=>`TRACKED_STEERING_FORBIDDEN:${file}`);}
export function checkAuthorityRepository(root=process.cwd(), configRel=CONFIG_PATH){
 const errors=[];let config;
 try{config=JSON.parse(readFileSync(path.resolve(root,configRel),"utf8"));}catch{return ["AUTHORITY_CONFIG_MISSING_OR_INVALID"];}
 errors.push(...configurationErrors(config));
 if(!existsSync(path.resolve(root,"AGENTS.md")))errors.push("TRUTH_SOURCE_PATH_MISSING:AGENTS.md");
 try{errors.push(...trackedSteeringErrors(execFileSync("git",["ls-files","-z"],{cwd:root,encoding:"utf8"}).split("\0").filter(Boolean)));}catch{errors.push("TRACKED_STEERING_CHECK_UNAVAILABLE");}
 try{errors.push(...checkAuthorityHashPins({checkerBytes:readFileSync(path.resolve(root,"scripts/quality/check-authoritative-sources.mjs")),schemaBytes:readFileSync(path.resolve(root,CONFIG_PATH)),workflowText:readFileSync(path.resolve(root,".github/workflows/eslint-ratchet.yml"),"utf8")}));}catch{errors.push("AUTHORITY_PIN_INPUT_MISSING");}
 return errors;
}
export function runSelftest(root=process.cwd()){
 const config=JSON.parse(readFileSync(path.resolve(root,CONFIG_PATH),"utf8"));
 if(configurationErrors(config).length)throw Error("Authority baseline invalid");
 const mutations=[value=>value.truthTypes.push({id:"shadow",source:"shadow.md"}),value=>value.truthTypes[0].source="docs/project/CURRENT_STATE.md",value=>value.truthTypes=[],value=>value.uiReferences=[],value=>value.schemaVersion=2];
 for(const mutate of mutations){const value=structuredClone(config);mutate(value);if(!configurationErrors(value).length)throw Error("Authority mutation did not fail closed");}
 if(trackedSteeringErrors(["_review/BAUREGELN.md","docs/archive/_review/x.md"]).length!==2 || trackedSteeringErrors(["AGENTS.md","docs/reference.md"]).length)throw Error("Steering tracking boundary failed");
 return true;
}
if(import.meta.url===pathToFileURL(path.resolve(process.argv[1]??"")).href){
 if(process.argv.includes("--selftest")){runSelftest();console.log("AUTHORITY_GATE_SELFTEST=PASS");}
 else{const errors=checkAuthorityRepository();if(errors.length){errors.forEach(error=>console.error(error));process.exitCode=1;}else console.log("AUTHORITY_GATE=PASS truth_types=1 tracked_steering=0");}
}
