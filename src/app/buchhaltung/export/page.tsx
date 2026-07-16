import { ExportClient, type ExportFormat } from "./ExportClient";

export const dynamic = "force-dynamic";

const FORMATS = new Set<ExportFormat>(["datev", "lexware", "steuerberater"]);

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = typeof params.format === "string" ? params.format : "datev";
  const initialFormat = FORMATS.has(requested as ExportFormat) ? requested as ExportFormat : "datev";
  return <ExportClient initialFormat={initialFormat} />;
}
