import { TopWorkflowBar } from "@/components/layout/TopWorkflowBar";

export default function StationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full w-full">
      <TopWorkflowBar />
      <div className="flex-1 w-full relative">
        {children}
      </div>
    </div>
  );
}
