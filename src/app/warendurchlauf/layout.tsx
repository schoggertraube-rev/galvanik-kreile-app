import { WarendurchlaufStationNav } from "@/components/warendurchlauf/WarendurchlaufStationNav";

export default function WarendurchlaufLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <WarendurchlaufStationNav />
      <div className="flex-1 w-full relative overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
