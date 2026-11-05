// Isolated generated-flow provider boundary. Never loaded by the product entrypoint.
const endpoint = "https://azure-generated-replay.invalid";
const database = new URL(process.env.DATABASE_URL ?? "invalid:");
if (process.env.KREILE_GENERATED_REPLAY !== "1" || database.hostname !== "127.0.0.1" || database.port !== "54322"
  || database.pathname !== "/postgres" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321"
  || process.env.AZURE_DOCINTEL_ENDPOINT !== endpoint || process.env.AZURE_DOCINTEL_KEY !== "generated-replay-only") {
  throw new Error("GENERATED_PROVIDER_ADAPTER_REQUIRES_ISOLATED_REPLAY");
}
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = options?.method ?? (input instanceof Request ? input.method : "GET");
  const headers = new Headers(options?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (url.hostname === "login.microsoftonline.com" || url.hostname === "graph.microsoft.com") {
    if (process.env.MS_GRAPH_TENANT_ID !== "generated-replay" || process.env.MS_GRAPH_CLIENT_ID !== "generated-replay"
      || process.env.MS_GRAPH_CLIENT_SECRET !== "generated-replay-only" || process.env.MS_GRAPH_MAILBOX !== "flow-replay@fixture.invalid") throw new Error("GENERATED_GRAPH_CONFIG_MISMATCH");
    if (url.hostname === "login.microsoftonline.com" && method === "POST" && url.pathname === "/generated-replay/oauth2/v2.0/token") {
      return Response.json({ access_token: "generated-replay-access-token-only", token_type: "Bearer", expires_in: 3600 });
    }
    if (url.hostname === "graph.microsoft.com" && headers.get("authorization") !== "Bearer generated-replay-access-token-only") throw new Error("GENERATED_GRAPH_TOKEN_MISMATCH");
    if (method === "POST" && decodeURIComponent(url.pathname) === "/v1.0/users/flow-replay@fixture.invalid/sendMail") {
      const payload = JSON.parse(String(options?.body));
      if (!payload.message?.subject || !payload.message?.body?.content || payload.message?.toRecipients?.length !== 1) return Response.json({ error: { code: "BadRequest" } }, { status: 400 });
      return new Response(null, { status: 202 });
    }
    if (method === "GET" && decodeURIComponent(url.pathname) === "/v1.0/users/flow-replay@fixture.invalid/mailFolders/inbox/messages") return Response.json({ value: [] });
    throw new Error("GENERATED_GRAPH_REQUEST_UNEXPECTED");
  }
  if (url.origin !== endpoint) return fetchOriginal(input, options);
  if (headers.get("Ocp-Apim-Subscription-Key") !== "generated-replay-only") throw new Error("GENERATED_AZURE_KEY_MISMATCH");
  if (method === "POST" && url.pathname === "/documentintelligence/documentModels/prebuilt-layout:analyze") {
    return new Response(null, { status: 202, headers: { "operation-location": endpoint + "/documentintelligence/documentModels/prebuilt-layout/analyzeResults/isolated-empty-layout" } });
  }
  if (method === "GET" && url.pathname === "/documentintelligence/documentModels/prebuilt-layout/analyzeResults/isolated-empty-layout") {
    // gegeben.erkennung=nichts: readable image, no extracted fields. Assertions stay in BAUPLAN.
    return Response.json({ status: "succeeded", analyzeResult: { keyValuePairs: [] } });
  }
  throw new Error("GENERATED_AZURE_REQUEST_UNEXPECTED");
};
