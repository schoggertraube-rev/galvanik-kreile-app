import { BelegDetailClient } from "./BelegDetailClient";

export default async function BelegDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BelegDetailClient id={id} />;
}
