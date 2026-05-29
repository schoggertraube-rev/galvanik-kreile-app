"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Check, X, Loader2, Power } from "lucide-react";
import { getFeatureFlags, toggleFeatureFlag, initializeDefaultFlags } from "@/app/actions/admin.actions";

type FeatureFlag = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean | null;
};

export function FeatureToggles() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const data = await getFeatureFlags();
      if (data.length === 0) {
        await initializeDefaultFlags();
        const newData = await getFeatureFlags();
        setFlags(newData);
      } else {
        setFlags(data);
      }
    } catch (err) {
      console.error("Failed to load feature flags", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleToggle = async (id: string, current: boolean) => {
    try {
      // Optimistic update
      setFlags(flags.map(f => f.id === id ? { ...f, enabled: !current } : f));
      await toggleFeatureFlag(id, !current);
    } catch (err) {
      // Revert on error
      console.error(err);
      fetchFlags();
    }
  };

  if (loading && flags.length === 0) {
    return <div className="p-8 text-center text-text-muted animate-pulse">Lade Feature-Toggles...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Power className="h-5 w-5"/> Feature-Toggles</CardTitle>
        <CardDescription>Funktionen modulweise aktivieren oder deaktivieren</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flags.map(flag => (
            <div 
              key={flag.id} 
              className={`p-4 rounded-xl border transition-all ${flag.enabled ? 'border-navy-900 shadow-sm bg-white' : 'border-neutral-gray-200 bg-bg-app-soft opacity-70'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-1">
                  <h4 className={`font-bold text-sm ${flag.enabled ? 'text-navy-900' : 'text-text-muted'}`}>{flag.name}</h4>
                  <p className="text-xs text-text-muted line-clamp-2">{flag.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(flag.id, flag.enabled || false)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2 ${
                  flag.enabled ? 'bg-navy-900' : 'bg-neutral-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    flag.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs ml-2 font-bold ${flag.enabled ? 'text-navy-900' : 'text-text-muted'}`}>
                {flag.enabled ? 'Aktiviert' : 'Deaktiviert'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
