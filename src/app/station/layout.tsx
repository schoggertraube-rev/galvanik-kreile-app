import { WarendurchlaufStationNav } from "@/components/warendurchlauf/WarendurchlaufStationNav";

export default function StationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full w-full">
      <WarendurchlaufStationNav />
      <div className="flex-1 w-full relative">
        {children}
      </div>
    </div>
  );
}
