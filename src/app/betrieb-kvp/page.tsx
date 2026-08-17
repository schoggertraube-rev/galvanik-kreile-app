import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const metadata = {
  title: "Betriebs-KVP | Kreile App",
  description: "Betrieblicher Verbesserungsprozess",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BetriebKvpPage() {
  return <FoundationUnavailable />;
}
