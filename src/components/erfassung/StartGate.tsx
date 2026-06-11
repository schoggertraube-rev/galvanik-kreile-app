"use client";

import { useErfassung } from "./ErfassungProvider";
import { UserPlus, FilePlus, X } from "lucide-react";

export function StartGate() {
  const { closeErfassung, openErfassung } = useErfassung();

  return (
    <div className="flex flex-col h-full bg-[#fcfaf6] rounded-2xl overflow-hidden relative">
      <div className="px-8 py-6 sticky top-0 z-10 bg-[#fcfaf6]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-serif text-[#1a1c23]">Was möchtest du anlegen?</h2>
          <button 
            onClick={closeErfassung}
            className="flex items-center justify-center bg-gray-200 hover:bg-red-500 hover:text-white text-gray-700 rounded-full transition-colors w-10 h-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Wähle aus, ob du einen neuen Kunden erfassen oder direkt einen Auftrag / KV anlegen möchtest.
        </p>
      </div>

      <div className="px-8 pb-8 flex flex-col gap-4 flex-1 justify-center max-w-2xl mx-auto w-full">
        <button
          onClick={() => openErfassung({ mode: "customer" })}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl p-6 text-left transition-shadow shadow-sm hover:shadow-md flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 mb-1">Kunde anlegen</h3>
            <p className="text-sm text-gray-500">
              Kunde oder Lead erfassen. Danach kannst du optional direkt einen Auftrag für diesen Kunden anlegen.
            </p>
          </div>
        </button>

        <button
          onClick={() => openErfassung({ mode: "order" })}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl p-6 text-left transition-shadow shadow-sm hover:shadow-md flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
            <FilePlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 mb-1">Auftrag anlegen</h3>
            <p className="text-sm text-gray-500">
              Auftrag oder KV-Anfrage erfassen. Wenn noch kein Kunde ausgewählt ist, wird dieser vorher gesucht oder neu angelegt.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
