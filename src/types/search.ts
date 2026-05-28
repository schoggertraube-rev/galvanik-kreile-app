// src/types/search.ts
// Globale Suche — Typen für Intent-Erkennung, Aktionen, Vorschläge

export type SearchableEntity =
  | "order"
  | "customer"
  | "item"
  | "inquiry"
  | "quote"
  | "invoice"
  | "file"
  | "user";

export type SearchIndexEntry = {
  id: string;
  entityType: SearchableEntity;
  entityId: string;
  primaryLabel: string;
  secondaryLabel?: string;
  aliases?: string[];
  tags?: string[];
  searchText: string;
  domainTokens?: string[];
  updatedAt: string;
};

export type SearchAction = {
  id: string;
  code: string;
  label: string;
  synonyms: string[];
  routeOnSelect: string;
  requiredRoles?: string[];
  requiredFeatureFlag?: string;
  icon?: string;
  description?: string;
};

export type SearchSuggestion = {
  type: "entity" | "action" | "recent" | "fuzzy";
  label: string;
  secondary?: string;
  routeOnSelect: string;
  score: number;
  source?: SearchableEntity | "action";
};
