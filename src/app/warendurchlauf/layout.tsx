import { WarendurchlaufStationNav } from "@/components/warendurchlauf/WarendurchlaufStationNav";

export default function WarendurchlaufLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full w-full">
      <WarendurchlaufStationNav />
      <div className="flex-1 w-full relative">
        {children}
      </div>
    </div>
  );
}
