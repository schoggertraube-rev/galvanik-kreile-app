"use client";

type TimeWindow = "ganztaegig" | "vormittags" | "nachmittags" | "spaet";

type DateInfo = {
  dueDate?: string;
  timeWindow?: TimeWindow;
  calendarSync?: boolean;
};

export function DateSection({
  dateInfo,
  onChange,
}: {
  dateInfo: DateInfo;
  onChange: (info: DateInfo) => void;
}) {
  const update = <Key extends keyof DateInfo>(field: Key, value: DateInfo[Key]) => {
    onChange({ ...dateInfo, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
            Zugesagter Liefertermin
          </label>
          <input
            type="date"
            className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors"
            value={dateInfo.dueDate || ""}
            onChange={(event) => update("dueDate", event.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
            Uhrzeitfenster
          </label>
          <select
            className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors appearance-none"
            value={dateInfo.timeWindow || "ganztaegig"}
            onChange={(event) => update("timeWindow", event.target.value as TimeWindow)}
          >
            <option value="ganztaegig">Ganztägig</option>
            <option value="vormittags">Vormittags (08:00 - 12:00)</option>
            <option value="nachmittags">Nachmittags (12:00 - 16:00)</option>
            <option value="spaet">Spätnachmittag (16:00 - 18:00)</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white border border-[#e5dcd0] rounded-lg p-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Im Cockpit-Kalender vormerken</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
            Wird atomar mit dem Auftrag gespeichert
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={dateInfo.calendarSync === true}
            onChange={(event) => update("calendarSync", event.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1a1c23]" />
        </label>
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Die Rücklieferungsart ist noch kein persistiertes Auftragsfeld und wird hier deshalb nicht bestätigt.
      </p>
    </div>
  );
}
