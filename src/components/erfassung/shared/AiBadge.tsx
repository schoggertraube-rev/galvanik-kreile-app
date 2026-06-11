import { Sparkles } from "lucide-react";

export function AiBadge({ text = "KI" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
      <Sparkles className="w-3 h-3" />
      {text}
    </span>
  );
}
