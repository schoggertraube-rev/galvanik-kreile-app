"use client";

export function DateSection({ dateInfo, onChange }: { dateInfo: any, onChange: (info: any) => void }) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...dateInfo, [field]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Liefertermin (Zugesagt)</label>
        <input
          type="date"
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
          value={dateInfo.dueDate || ""}
          onChange={(e) => handleChange("dueDate", e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Priorität</label>
        <select
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
          value={dateInfo.priority || "normal"}
          onChange={(e) => handleChange("priority", e.target.value)}
        >
          <option value="normal">Normal</option>
          <option value="express">Express</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Rücklieferung</label>
        <select
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
          value={dateInfo.shipping || "abholung"}
          onChange={(e) => handleChange("shipping", e.target.value)}
        >
          <option value="abholung">Abholung durch Kunden</option>
          <option value="versand">Paketversand</option>
          <option value="spedition">Spedition</option>
        </select>
      </div>
    </div>
  );
}
