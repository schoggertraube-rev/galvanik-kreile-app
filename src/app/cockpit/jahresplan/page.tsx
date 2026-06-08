import { PageHeader } from "@/components/ui/PageHeader";

export default function JahresplanPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader 
        title="Jahresplan & Forecast" 
        subtitle="Ziele, Budgets und strategische Planung für das Geschäftsjahr"
      />
      <div className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
        <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-neutral-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">📈</div>
          <h2 className="text-xl font-bold text-navy-900 mb-2">Jahresplanung im Aufbau</h2>
          <p className="text-text-muted max-w-md mx-auto">
            Hier entsteht das zentrale Planungsmodul. Sie werden hier bald Ihre Umsatzziele, Kostenbudgets und Personalplanung für das laufende und kommende Jahr hinterlegen können.
          </p>
        </div>
      </div>
    </div>
  );
}
