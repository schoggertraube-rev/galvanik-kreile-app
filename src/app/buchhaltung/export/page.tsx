import { exportBelegeAction } from "@/app/buchhaltung/actions";
import { ExportClient } from "./ExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const initialFormat = (sp.format as string) || "datev";

  // Wir rufen zur Demonstration einfach den "DATEV" Export auf.
  const previewData = await exportBelegeAction("DATEV");

  return <ExportClient initialFormat={initialFormat} previewData={previewData} />;
}
