/** Shared fixtures for the one German spelling rule in TypeScript and SQL. */
export const searchFoldCases=[
 ['Müller','mueller'],['Mueller','mueller'],['MÜLLER','mueller'],['mueller','mueller'],
 ['Muller','muller'],['Straße','strasse'],['Strasse','strasse'],['STRASSE','strasse'],
 ['Größe','groesse'],['Groesse','groesse'],['GRÖSSE','groesse'],['ÄÖÜ','aeoeue'],
 ['Weiß','weiss'],['ÉCOLE Çelik','école çelik'],['école çelik','école çelik'],
 ['A-2026-0042 KV_7 100%','a-2026-0042 kv_7 100%'],
] as const;
