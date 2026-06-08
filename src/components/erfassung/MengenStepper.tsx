"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface MengenStepperProps {
  value: number;
  onChange: (n: number) => void;
  einheit: string;
  min?: number;
  step?: number;
}

export function MengenStepper({
  value,
  onChange,
  einheit,
  min = 0,
  step = 1
}: MengenStepperProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleDecrease = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    onChange(Math.max(min, value - step));
  };

  const handleIncrease = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    onChange(value + step);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(false);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, parsed));
    }
  };

  return (
    <div className="flex items-center gap-4 bg-white border-2 border-neutral-gray-200 rounded-2xl p-1 shadow-sm">
      <button
        type="button"
        onClick={handleDecrease}
        className="w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-gray-100 hover:bg-neutral-gray-200 text-navy-800 transition-colors shrink-0"
      >
        <Minus className="w-6 h-6" />
      </button>

      <div 
        className="flex-1 flex justify-center items-center cursor-pointer min-w-[60px]"
        onClick={() => !isEditing && setIsEditing(true)}
      >
        {isEditing ? (
          <Input
            autoFocus
            type="number"
            defaultValue={value}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-20 text-center font-bold text-xl h-10"
            step="any"
          />
        ) : (
          <div className="text-xl font-bold text-navy-900 select-none">
            {value} <span className="text-sm font-semibold text-text-muted">{einheit}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleIncrease}
        className="w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-gray-100 hover:bg-neutral-gray-200 text-navy-800 transition-colors shrink-0"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
