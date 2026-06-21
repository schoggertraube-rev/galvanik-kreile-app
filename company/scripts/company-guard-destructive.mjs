let input=''; for await (const c of process.stdin) input+=c;
let p={}; try{p=JSON.parse(input||'{}')}catch{process.exit(0)}
const command=String(p?.tool_input?.command??'').toLowerCase().replace(/\s+/g,' ').trim();
const patterns=[/\brm\s+-[^\n]*r[^\n]*f\b/,/\bremove-item\b[^\n]*-recurse[^\n]*-force/,/\bgit\s+reset\s+--hard\b/,/\bgit\s+clean\s+-[^\n]*f/,/\bgit\s+push\b[^\n]*(--force|-f)\b/,/\bdrop\s+(table|schema|database)\b/,/\btruncate\s+(table\s+)?\w+/,/\bdelete\s+from\s+\w+\s*;?\s*$/m,/\bvercel\s+remove\b/,/\bsupabase\s+projects\s+delete\b/];
if(!patterns.some(x=>x.test(command))) process.exit(0);
process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Destruktiver Befehl blockiert. Snapshot, betroffene Daten, Rollback und ausdrückliche Eigentümerfreigabe fehlen.'}}));
