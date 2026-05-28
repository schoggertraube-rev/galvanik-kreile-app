import React, { ReactNode } from "react";
import { FeatureKey } from "@/lib/license/types";
import { useFeatureFlag } from "@/lib/license/useFeatureFlag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

export interface LockedCardProps {
  featureKey: FeatureKey;
  title: string;
  children: ReactNode;
  demoPreview?: ReactNode;
}

export function LockedCard({ featureKey, title, children, demoPreview }: LockedCardProps) {
  const { available, lockReason, role } = useFeatureFlag(featureKey);

  if (available) {
    return <>{children}</>;
  }

  // Gesperrt je nach Rolle rendern
  if (role === "demo") {
    return (
      <Card className="relative overflow-hidden border-dashed">
        <div className="absolute top-2 right-2 bg-accent-orange text-white text-xs font-bold px-2 py-1 rounded-full z-10 shadow">
          Demo
        </div>
        <CardHeader>
          <CardTitle className="text-navy-900">{title}</CardTitle>
        </CardHeader>
        <CardContent className="opacity-70 pointer-events-none blur-[1px]">
          {demoPreview || <div className="h-32 bg-neutral-gray-100 rounded-lg" />}
        </CardContent>
      </Card>
    );
  }

  if (role === "mitarbeiter") {
    return (
      <Card className="bg-neutral-gray-50 border-neutral-gray-200 opacity-60">
        <CardHeader className="pb-2">
          <CardTitle className="text-navy-400 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">Nicht verfügbar</p>
        </CardContent>
      </Card>
    );
  }

  // inhaber: sichtbare Karte mit title, Lock-Grund
  const lockMessage =
    lockReason === "plan"
      ? "Im aktuellen Plan nicht enthalten"
      : lockReason === "datenreife"
      ? "Noch nicht genug Daten"
      : "Nicht verfügbar";

  return (
    <Card className="relative overflow-hidden border-neutral-gray-200 shadow-sm">
      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-4 rounded-full shadow-md mb-4">
          <Lock className="w-6 h-6 text-text-muted" />
        </div>
        <h3 className="font-bold text-navy-900 mb-1">{title}</h3>
        <p className="text-sm text-text-muted font-medium bg-neutral-gray-100 px-3 py-1 rounded-full">
          {lockMessage}
        </p>
      </div>
      <CardHeader>
        <CardTitle className="text-navy-900 opacity-30">{title}</CardTitle>
      </CardHeader>
      <CardContent className="opacity-30 pointer-events-none grayscale">
        {demoPreview || <div className="h-32 bg-neutral-gray-100 rounded-lg" />}
      </CardContent>
    </Card>
  );
}
