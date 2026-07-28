"use client";

import { FoundationUnavailable } from "./FoundationUnavailable";

type UnavailableDefinition = {
  title: string;
  reason: string;
};

/**
 * Compatibility boundary for a legacy component that has no proven data,
 * authorization, or receipt contract. Its caller may keep the import and prop
 * shape; the old implementation is deliberately not executed.
 */
export function createFoundationUnavailableComponent({ title, reason }: UnavailableDefinition) {
  return function FoundationUnavailableCompatibility(_props: Record<string, unknown>) {
    void _props;
    return <FoundationUnavailable title={title} reason={reason} />;
  };
}
